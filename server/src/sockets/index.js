import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let io = null;

/**
 * Initializes Socket.IO on the provided Node.js HTTP server.
 * Prepares the architectural foundation for future Trip Room real-time messaging
 * with secure CORS origins and connection logging.
 *
 * @param {import('http').Server} httpServer
 * @returns {SocketIOServer}
 */
export function initSockets(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Safe ping/pong timeouts
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  logger.info(`Socket.IO initialized. Allowed origin: ${config.clientOrigin}`);

  // Base connection listener for future Trip Room events
  io.on('connection', (socket) => {
    logger.debug(`Socket client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Get the active Socket.IO server instance.
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSockets(httpServer) first.');
  }
  return io;
}
