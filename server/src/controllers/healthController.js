import { getHealthStatus } from '../services/healthService.js';

/**
 * Health check controller.
 * Responds with system health status and database connectivity.
 */
export function getHealth(req, res) {
  const healthData = getHealthStatus();
  // Server is responsive, return 200 with honest status
  res.status(200).json({
    success: true,
    data: healthData,
  });
}
