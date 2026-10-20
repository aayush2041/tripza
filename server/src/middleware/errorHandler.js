import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized error-handling middleware.
 * Formats errors into a consistent JSON response.
 * Sanitizes stack traces and internal secrets in production.
 */
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Log error with safe logger
  logger.error(`${req.method} ${req.originalUrl} - ${statusCode} - ${err.message}`);
  if (!config.isProduction && err.stack) {
    logger.debug(err.stack);
  }

  // Consistent API error response contract
  const errorResponse = {
    success: false,
    error: {
      code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR'),
      message:
        config.isProduction && statusCode === 500
          ? 'An internal server error occurred. Please try again later.'
          : err.message || 'An unexpected error occurred.',
    },
  };

  if (!config.isProduction && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}
