import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { validateRegister, validateLogin } from '../validators/authValidator.js';
import crypto from 'crypto';

/**
 * Helper to regenerate session securely to mitigate session fixation attacks.
 */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    const oldCsrfToken = req.session?.csrfToken;
    req.session.regenerate((err) => {
      if (err) return reject(err);
      // Re-initialize CSRF token in the fresh session
      req.session.csrfToken = oldCsrfToken || crypto.randomBytes(32).toString('hex');
      resolve();
    });
  });
}

/**
 * Register a new traveller account and profile.
 */
export async function register(req, res, next) {
  try {
    const validation = validateRegister(req.body);
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

    const { fullName, email, password } = validation.data;

    // Check email uniqueness at application level
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    // Securely hash password with bcrypt
    const passwordHash = await User.hashPassword(password);

    // Create User record with default safe fields
    const user = await User.create({
      email,
      passwordHash,
      role: 'traveller',
      accountStatus: 'active',
      emailVerified: false,
    });

    // Create Profile record linked to user
    const profile = await Profile.create({
      user: user._id,
      fullName,
      verification: {
        status: 'unverified',
      },
    });

    // Regenerate session to bind authenticated state safely
    await regenerateSession(req);
    req.session.userId = user._id;

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        profile: profile.toPublicJSON(),
      },
    });
  } catch (error) {
    // Handle database duplicate key error (E11000)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }
    next(error);
  }
}

/**
 * Authenticate user credentials and create server-managed session.
 */
export async function login(req, res, next) {
  try {
    const validation = validateLogin(req.body);
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

    const { email, password } = validation.data;

    // Explicitly query passwordHash which is select: false by default
    const user = await User.findOne({ email }).select('+passwordHash');

    // Generic error message preventing account enumeration
    const genericAuthError = {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    };

    if (!user) {
      return res.status(401).json(genericAuthError);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json(genericAuthError);
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account is suspended or deactivated. Contact support for assistance.',
        },
      });
    }

    // Regenerate session identifier upon successful login to defeat session fixation
    await regenerateSession(req);
    req.session.userId = user._id;

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    const profile = await Profile.findOne({ user: user._id });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
        profile: profile ? profile.toPublicJSON() : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Destroy the server-managed session and invalidate cookies.
 */
export function logout(req, res, next) {
  if (!req.session) {
    return res.status(200).json({
      success: true,
      message: 'Successfully signed out.',
    });
  }

  req.session.destroy((err) => {
    if (err) return next(err);

    // Clear session and CSRF cookies
    res.clearCookie('tripza_sid', { path: '/' });
    res.clearCookie('tripza_csrf', { path: '/' });

    res.status(200).json({
      success: true,
      message: 'Successfully signed out.',
    });
  });
}

/**
 * Get current authenticated user and profile state.
 */
export function getMe(req, res) {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        accountStatus: req.user.accountStatus,
        emailVerified: req.user.emailVerified,
        createdAt: req.user.createdAt,
      },
      profile: req.profile ? req.profile.toPublicJSON() : null,
    },
  });
}

/**
 * Retrieve the active CSRF token for the session.
 */
export function getCsrfToken(req, res) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.cookie('tripza_csrf', req.session.csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  res.status(200).json({
    success: true,
    data: {
      csrfToken: req.session.csrfToken,
    },
  });
}
