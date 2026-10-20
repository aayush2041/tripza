import * as roomService from '../services/roomService.js';
import { getIO } from '../sockets/index.js';
import { logger } from '../utils/logger.js';

/**
 * Controller for Trip Room HTTP endpoints
 */

export async function getRoomMetadata(req, res, next) {
  try {
    const { tripId } = req.params;
    const roomDetails = await roomService.getRoomDetails(tripId, req.user._id);
    return res.status(200).json({
      status: 'success',
      data: { room: roomDetails },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        status: 'fail',
        error: { code: error.code || 'ROOM_ERROR', message: error.message },
      });
    }
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const { tripId } = req.params;
    const { before, limit } = req.query;

    const access = await roomService.checkRoomAccess(tripId, req.user._id);
    if (!access.allowed) {
      return res.status(access.statusCode || 403).json({
        status: 'fail',
        error: { code: 'ROOM_ACCESS_DENIED', message: access.reason },
      });
    }

    const result = await roomService.getRoomMessages(tripId, { before, limit });
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        status: 'fail',
        error: { code: error.code || 'ROOM_ERROR', message: error.message },
      });
    }
    next(error);
  }
}

export async function postMessage(req, res, next) {
  try {
    const { tripId } = req.params;
    const { message } = req.body;

    const savedMessage = await roomService.saveRoomMessage(tripId, req.user._id, message);

    // Broadcast in real-time to active Socket.IO room members
    try {
      const io = getIO();
      if (io) {
        io.to(`trip:${tripId}`).emit('trip-room:message:new', { message: savedMessage });
      }
    } catch (socketErr) {
      // In tests or non-socket context, getIO might be uninitialized; log gracefully
      logger.debug(`Socket broadcast omitted: ${socketErr.message}`);
    }

    return res.status(201).json({
      status: 'success',
      data: { message: savedMessage },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        status: 'fail',
        error: { code: error.code || 'ROOM_ERROR', message: error.message },
      });
    }
    next(error);
  }
}

export async function reportMessage(req, res, next) {
  try {
    const { tripId, messageId } = req.params;
    const { reason } = req.body;

    const result = await roomService.reportRoomMessage(tripId, messageId, req.user._id, reason);
    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        status: 'fail',
        error: { code: error.code || 'ROOM_ERROR', message: error.message },
      });
    }
    next(error);
  }
}
