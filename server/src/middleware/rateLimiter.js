import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * Standard API rate limiter to protect against brute-force and DoS attempts.
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP. Please try again later.',
    },
  },
  skip: () => config.isTest, // Disable rate limiting in automated tests to prevent test flake
});
