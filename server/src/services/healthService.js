import { getDatabaseStatus } from '../config/database.js';
import { config } from '../config/env.js';

/**
 * Health check service.
 * Gathers system health, server uptime, environment, and honest database connectivity status.
 */
export function getHealthStatus() {
  const dbStatus = getDatabaseStatus();

  // If database is connected, overall status is 'ok'.
  // If database is disconnected, status is 'degraded' (server running, DB offline).
  const isHealthy = dbStatus.isConnected;
  const overallStatus = isHealthy ? 'ok' : 'degraded';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: 'tripza-backend',
    environment: config.env,
    uptimeSeconds: Math.floor(process.uptime()),
    server: {
      status: 'healthy',
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    database: {
      status: dbStatus.status,
      readyState: dbStatus.readyState,
      connected: dbStatus.isConnected,
      connectedAt: dbStatus.connectedAt,
      message: dbStatus.isConnected
        ? 'Database connection active.'
        : dbStatus.lastError
        ? `Database unavailable: ${dbStatus.lastError}`
        : 'Database is disconnected. Configure MONGODB_URI in .env to connect.',
    },
  };
}
