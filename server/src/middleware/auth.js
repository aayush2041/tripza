import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * Authentication enforcement middleware.
 * Verifies that the client possesses an active, valid server-managed session.
 */
export async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'You must be signed in to perform this action.',
      },
    });
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      // Session references a deleted or nonexistent user; destroy invalid session
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'User account not found. Please sign in again.',
        },
      });
    }

    if (user.accountStatus !== 'active') {
      req.session.destroy(() => {});
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account is suspended or deactivated. Contact support for assistance.',
        },
      });
    }

    const profile = await Profile.findOne({ user: user._id });

    req.user = user;
    req.profile = profile;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorization middleware requiring administrator privileges.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrator authorization required for this resource.',
      },
    });
  }
  next();
}

/**
 * Reusable authorization middleware requiring verified traveller status.
 * Prepared for future trip hosting and publishing features.
 */
export function requireVerifiedTraveller(req, res, next) {
  if (!req.profile || req.profile.verification?.status !== 'verified') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'VERIFICATION_REQUIRED',
        message: 'This action requires verified traveller status. Please complete profile verification.',
      },
    });
  }
  next();
}

/**
 * Sensitive rate limiter for registration and login endpoints.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
    },
  },
  skip: () => process.env.NODE_ENV === 'test' || config.isTest,
});
