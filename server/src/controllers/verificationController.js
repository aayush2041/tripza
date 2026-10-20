import { Profile } from '../models/Profile.js';
import mongoose from 'mongoose';

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
