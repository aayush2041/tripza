import { Profile } from '../models/Profile.js';
import { validateUpdateProfile } from '../validators/profileValidator.js';
import mongoose from 'mongoose';

/**
 * Retrieve the current user's private profile.
 */
export async function getMyProfile(req, res, next) {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Traveller profile could not be found.',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: profile.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update current user's profile with strict field whitelisting.
 * Mass assignment attempts to modify roles or verification status are safely ignored.
 */
export async function updateMyProfile(req, res, next) {
  try {
    const validation = validateUpdateProfile(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors[0],
          details: validation.errors,
        },
      });
    }

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

    // Apply only sanitized, allowed fields
    const { fullName, bio, homeCity, travelInterests, languages, profilePhotoUrl } = validation.data;

    if (fullName !== undefined) profile.fullName = fullName;
    if (bio !== undefined) profile.bio = bio;
    if (homeCity !== undefined) profile.homeCity = homeCity;
    if (travelInterests !== undefined) profile.travelInterests = travelInterests;
    if (languages !== undefined) profile.languages = languages;
    if (profilePhotoUrl !== undefined) profile.profilePhotoUrl = profilePhotoUrl;

    await profile.save();

    res.status(200).json({
      success: true,
      data: profile.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve a public traveller profile by profile ID.
 */
export async function getPublicProfile(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid profile identifier.',
        },
      });
    }

    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Traveller profile not found.',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: profile.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
}
