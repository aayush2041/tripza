import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config/env.js';
import { sessionMiddleware } from '../config/session.js';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import * as roomService from '../services/roomService.js';
import { logger } from '../utils/logger.js';

let io = null;

// Per-user rate-limiting map: Map<userId, { count: number, resetAt: number }>
const messageRateLimits = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const limitWindowMs = 3000; // 3 seconds
  const maxPerWindow = 5;

  const current = messageRateLimits.get(userId.toString());
  if (!current || now > current.resetAt) {
    messageRateLimits.set(userId.toString(), { count: 1, resetAt: now + limitWindowMs });
    return true;
  }

  if (current.count >= maxPerWindow) {
    return false;
  }

  current.count += 1;
  return true;
}

/**
 * Initializes Socket.IO on the Node.js HTTP server.
 * Implements session-based socket authentication, room-scoped authorization,
 * MongoDB message persistence, and rate limiting.
 *
 * @param {import('http').Server} httpServer
 * @returns {SocketIOServer}
 */
export function initSockets(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientOrigin.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e5, // 100 KB max payload size
  });

  // 1. Authentication Middleware for Socket Connections
  io.use((socket, next) => {
    // Run express-session on the handshake request
    const dummyRes = {
      end: () => {},
      getHeader: () => {},
      setHeader: () => {},
      writeHead: () => {},
    };

    sessionMiddleware(socket.request, dummyRes, async (err) => {
      if (err) {
        logger.error(`Socket session middleware error: ${err.message}`);
        return next(new Error('SESSION_ERROR'));
      }

      const session = socket.request.session;
      if (!session || !session.userId) {
        logger.debug('Socket connection rejected: No active authenticated session found.');
        return next(new Error('AUTHENTICATION_REQUIRED'));
      }

      try {
        const user = await User.findById(session.userId).select('email role accountStatus');
        if (!user || user.accountStatus !== 'active') {
          return next(new Error('ACCOUNT_INACTIVE'));
        }

        const profile = await Profile.findOne({ user: user._id }).select('fullName profilePhotoUrl verificationStatus');

        // Attach securely identified user and profile to socket data
        socket.data.user = user;
        socket.data.profile = profile;
        return next();
      } catch (dbErr) {
        logger.error(`Socket user lookup error: ${dbErr.message}`);
        return next(new Error('AUTH_LOOKUP_FAILED'));
      }
    });
  });

  // 2. Connection Handler
  io.on('connection', (socket) => {
    const user = socket.data.user;
    const profile = socket.data.profile;
    logger.debug(`Socket authenticated: ${socket.id} (User: ${user.email}, ID: ${user._id})`);

    /**
     * Event: trip-room:join
     * Verifies user is the organiser or an approved member before allowing room join.
     */
    socket.on('trip-room:join', async (payload, callback) => {
      try {
        const tripId = payload?.tripId;
        if (!tripId) {
          const errData = { code: 'INVALID_TRIP_ID', message: 'Trip ID is required.' };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        const access = await roomService.checkRoomAccess(tripId, user._id);
        if (!access.allowed) {
          const errData = { code: 'ROOM_ACCESS_DENIED', message: access.reason };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        const roomName = `trip:${tripId}`;
        socket.join(roomName);
        logger.debug(`User ${user.email} joined Socket room ${roomName}`);

        const joinData = {
          tripId,
          userRole: access.userRole,
          isArchived: access.isArchived,
        };

        socket.emit('trip-room:joined', joinData);
        if (typeof callback === 'function') callback({ status: 'success', data: joinData });
      } catch (err) {
        logger.error(`Error in trip-room:join: ${err.message}`);
        const errData = { code: 'JOIN_ERROR', message: 'Unable to join Trip Room.' };
        socket.emit('trip-room:message:error', errData);
        if (typeof callback === 'function') callback({ status: 'fail', error: errData });
      }
    });

    /**
     * Event: trip-room:leave
     */
    socket.on('trip-room:leave', (payload, callback) => {
      const tripId = payload?.tripId;
      if (tripId) {
        const roomName = `trip:${tripId}`;
        socket.leave(roomName);
        logger.debug(`User ${user.email} left Socket room ${roomName}`);
      }
      if (typeof callback === 'function') callback({ status: 'success' });
    });

    /**
     * Event: trip-room:message
     * Re-authenticates and authorizes on every message; validates, rate-limits,
     * persists in MongoDB, and broadcasts only to that trip's room.
     */
    socket.on('trip-room:message', async (payload, callback) => {
      try {
        const tripId = payload?.tripId;
        const text = payload?.text;

        if (!tripId) {
          const errData = { code: 'INVALID_TRIP_ID', message: 'Trip ID is required.' };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        // Re-verify authorization on every message
        const access = await roomService.checkRoomAccess(tripId, user._id);
        if (!access.allowed) {
          const errData = { code: 'ROOM_ACCESS_DENIED', message: access.reason };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        // Check if trip is cancelled (read-only/archived policy)
        if (access.trip.status === 'cancelled') {
          const errData = {
            code: 'TRIP_CANCELLED',
            message: 'Cannot send messages: This trip has been cancelled and the Trip Room is archived in read-only mode.',
          };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        // Rate limit check
        if (!checkRateLimit(user._id)) {
          const errData = { code: 'RATE_LIMIT_EXCEEDED', message: 'Sending messages too fast. Please slow down.' };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        // Validate text length
        const cleanText = (text || '').trim();
        if (!cleanText || cleanText.length > 2000) {
          const errData = {
            code: 'INVALID_MESSAGE',
            message: !cleanText ? 'Message cannot be empty.' : 'Message cannot exceed 2000 characters.',
          };
          socket.emit('trip-room:message:error', errData);
          if (typeof callback === 'function') callback({ status: 'fail', error: errData });
          return;
        }

        // Persist message in MongoDB (client cannot impersonate sender; user._id is server-enforced)
        const savedMessage = await roomService.saveRoomMessage(tripId, user._id, cleanText);

        // Broadcast to all sockets in this trip room
        const roomName = `trip:${tripId}`;
        io.to(roomName).emit('trip-room:message:new', { message: savedMessage });

        if (typeof callback === 'function') {
          callback({ status: 'success', data: { message: savedMessage } });
        }
      } catch (err) {
        logger.error(`Error in trip-room:message: ${err.message}`);
        const errData = { code: 'MESSAGE_SEND_FAILED', message: err.message || 'Failed to send message.' };
        socket.emit('trip-room:message:error', errData);
        if (typeof callback === 'function') callback({ status: 'fail', error: errData });
      }
    });

    /**
     * Event: trip-room:typing
     * Broadcasts typing status to other members of the room
     */
    socket.on('trip-room:typing', async (payload) => {
      try {
        const tripId = payload?.tripId;
        const isTyping = Boolean(payload?.isTyping);
        if (!tripId) return;

        const access = await roomService.checkRoomAccess(tripId, user._id);
        if (!access.allowed) return;

        const roomName = `trip:${tripId}`;
        socket.to(roomName).emit('trip-room:typing', {
          tripId,
          userId: user._id,
          userName: profile?.fullName || user.email,
          isTyping,
        });
      } catch (err) {
        logger.debug(`Typing event error: ${err.message}`);
      }
    });

    /**
     * Event: trip-room:read
     */
    socket.on('trip-room:read', async (payload) => {
      try {
        const tripId = payload?.tripId;
        const messageId = payload?.messageId;
        if (!tripId || !messageId) return;

        const access = await roomService.checkRoomAccess(tripId, user._id);
        if (!access.allowed) return;

        const roomName = `trip:${tripId}`;
        socket.to(roomName).emit('trip-room:read', {
          tripId,
          messageId,
          userId: user._id,
        });
      } catch (err) {
        logger.debug(`Read receipt error: ${err.message}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  logger.info(`Socket.IO initialized with session authentication and Trip Room handlers.`);
  return io;
}

/**
 * Get active Socket.IO server instance.
 */
export function getIO() {
  return io;
}

/**
 * Forcefully disconnects all active sockets belonging to a specific user.
 * Invoked when an account is suspended or credentials are invalidated.
 */
export function disconnectUserSockets(userId) {
  if (!io || !userId) return;
  const targetIdStr = userId.toString();
  for (const [, socket] of io.sockets.sockets) {
    if (socket.data?.user?._id?.toString() === targetIdStr) {
      socket.emit('auth:revoked', { message: 'Your session has been terminated or suspended.' });
      socket.disconnect(true);
      logger.info(`Forced disconnect on socket ${socket.id} for user ${targetIdStr}`);
    }
  }
}

/**
 * Removes a user's active sockets from a specific trip room.
 * Invoked when a member is removed or leaves a trip.
 */
export function removeUserFromTripRoom(userId, tripId) {
  if (!io || !userId || !tripId) return;
  const targetIdStr = userId.toString();
  const roomName = `trip:${tripId}`;
  for (const [, socket] of io.sockets.sockets) {
    if (socket.data?.user?._id?.toString() === targetIdStr) {
      socket.leave(roomName);
      socket.emit('trip-room:evicted', { tripId, message: 'You have left or been removed from this Trip Room.' });
      logger.info(`Evicted user ${targetIdStr} socket ${socket.id} from room ${roomName}`);
    }
  }
}

