/**
 * 404 Not Found middleware for unmatched API endpoints.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested resource '${req.method} ${req.originalUrl}' does not exist on this server.`,
    },
  });
}
