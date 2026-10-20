import { Profile } from '../models/Profile.js';
import mongoose from 'mongoose';
import { createNotification } from '../services/notificationService.js';

/**
 * Submit profile for community verification.
 * Transitions status: 'unverified' | 'rejected' -> 'pending_review'.
 */
export async function submitVerification(req, res, next) {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found.',
        },
      });
    }

    const currentStatus = profile.verification?.status || 'unverified';

    if (currentStatus === 'verified') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'Your profile is already verified as a trusted traveller.',
        },
      });
    }

    if (currentStatus === 'pending_review') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VERIFICATION_PENDING',
          message: 'Your profile verification is already under review.',
        },
      });
    }

    // Basic profile check before submission
    if (!profile.fullName || profile.fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INCOMPLETE_PROFILE',
          message: 'Please complete your full name before submitting for verification.',
        },
      });
    }

    // Update verification subdocument
    profile.verification.status = 'pending_review';
    profile.verification.submittedAt = new Date();
    profile.verification.rejectionReason = null;
    await profile.save();

    res.status(200).json({
      success: true,
      data: {
        verificationStatus: profile.verification.status,
        submittedAt: profile.verification.submittedAt,
        message: 'Profile submitted for verification review.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Review verification submission.
 * Strictly restricted to authenticated administrators.
 */
export async function reviewVerification(req, res, next) {
  try {
    const { targetUserId, decision, reason, notes } = req.body;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TARGET_USER',
          message: 'A valid target user ID is required.',
        },
      });
    }

    if (!['verified', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DECISION',
          message: "Decision must be either 'verified' or 'rejected'.",
        },
      });
    }

    if (decision === 'rejected' && (!reason || typeof reason !== 'string' || reason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REASON_REQUIRED',
          message: 'A clear rejection reason is required when rejecting verification.',
        },
      });
    }

    const targetProfile = await Profile.findOne({ user: targetUserId });
    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Target profile not found.',
        },
      });
    }

    // Record review decision with administrator attribution
    targetProfile.verification.status = decision;
    targetProfile.verification.reviewedAt = new Date();
    targetProfile.verification.reviewedBy = req.user._id;
    targetProfile.verification.rejectionReason = decision === 'rejected' ? reason.trim() : null;
    targetProfile.verification.reviewNotes = notes && typeof notes === 'string' ? notes.trim() : null;

    await targetProfile.save();

    // Send in-app notification to the traveller
    try {
      await createNotification({
        recipient: targetUserId,
        type: 'moderation_notice',
        title: decision === 'verified' ? 'Profile Verified! 🎉' : 'Verification Update',
        message:
          decision === 'verified'
            ? 'Congratulations! Your traveller profile has been verified by the TripZa community team. You can now publish trips.'
            : `Your verification submission was reviewed. Decision: rejected. Reason: ${reason.trim()}`,
      });
    } catch {
      // Best-effort notification
    }

    res.status(200).json({
      success: true,
      data: {
        userId: targetUserId,
        verificationStatus: targetProfile.verification.status,
        reviewedAt: targetProfile.verification.reviewedAt,
        message: `Profile verification has been updated to '${decision}'.`,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Retrieve pending traveller profiles awaiting verification.
 */
export async function getPendingVerifications(req, res, next) {
  try {
    const profiles = await Profile.find({ 'verification.status': 'pending_review' })
      .populate('user', 'email createdAt')
      .sort({ 'verification.submittedAt': -1 });

    res.status(200).json({
      success: true,
      data: {
        pending: profiles.map((p) => ({
          userId: p.user?._id || p.user,
          email: p.user?.email || null,
          fullName: p.fullName,
          homeCity: p.homeCity,
          travelInterests: p.travelInterests,
          verificationStatus: p.verification?.status,
          submittedAt: p.verification?.submittedAt,
          bio: p.bio,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}
