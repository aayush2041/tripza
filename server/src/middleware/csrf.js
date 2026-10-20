import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * CSRF Protection Middleware for Session-Based SPAs.
 *
 * Implements the Double-Submit / Synchronizer Token Pattern:
 * 1. An unpredictable CSRF token is maintained in the authenticated server session (req.session.csrfToken).
 * 2. The token is mirrored in a client-readable cookie ('tripza_csrf') and via GET /api/auth/csrf-token.
 * 3. On all state-changing requests (POST, PUT, PATCH, DELETE), the client must supply the token
 *    in the 'X-CSRF-Token' header.
 * 4. The Origin / Referer header is also validated against CLIENT_ORIGIN.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function ensureCsrfToken(req, res, next) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Set the CSRF token cookie so client-side fetch can read it
  res.cookie('tripza_csrf', req.session.csrfToken, {
    httpOnly: false, // Must be readable by client JS to attach to request headers
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });

  next();
}

export function verifyCsrf(req, res, next) {
  // Safe read-only HTTP methods do not require CSRF token validation
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Skip CSRF verification only in automated unit testing when explicitly opted out
  if (config.isTest && req.headers['x-test-bypass-csrf'] === 'true') {
    return next();
  }

  // 1. Validate Origin header if present
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    const allowedOrigins = config.clientOrigin.split(',').map((o) => o.trim());
    let isAllowedOrigin = false;
    try {
      const originUrl = new URL(origin);
      isAllowedOrigin = allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed);
          return originUrl.origin === allowedUrl.origin;
        } catch {
          return false;
        }
      });
    } catch {
      isAllowedOrigin = false;
    }

    if (!isAllowedOrigin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ORIGIN_FORBIDDEN',
          message: 'Cross-origin request rejected.',
        },
      });
    }
  }

  // 2. Validate CSRF Token
  const expectedToken = req.session?.csrfToken;
  const providedToken = req.headers['x-csrf-token'];

  if (!expectedToken || !providedToken || expectedToken !== providedToken) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_INVALID',
        message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
      },
    });
  }

  next();
}
