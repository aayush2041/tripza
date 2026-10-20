import http from 'http';
import app from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSockets } from './sockets/index.js';
import { logger } from './utils/logger.js';

const httpServer = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSockets(httpServer);

// Start server listening
const server = httpServer.listen(config.port, async () => {
  logger.info(`=========================================`);
  logger.info(` TripZa Server running on port ${config.port}`);
  logger.info(` Environment: ${config.env}`);
  logger.info(` CORS Allowed Origin: ${config.clientOrigin}`);
  logger.info(` Health endpoint: http://localhost:${config.port}/api/health`);
  logger.info(`=========================================`);

  // Connect to MongoDB
  await connectDatabase();
});

// Handle graceful shutdown
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Close HTTP server (stop accepting new connections)
  server.close(async () => {
    logger.info('HTTP server closed.');

    // Disconnect from database
    await disconnectDatabase();

    logger.info('Graceful shutdown complete. Exiting.');
    process.exit(0);
  });

  // Force shutdown after 10s if connections remain open
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  handleShutdown('uncaughtException');
});
