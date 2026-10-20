import { getUserNotifications, markNotificationRead } from '../services/notificationService.js';
import mongoose from 'mongoose';

/**
 * GET /api/notifications
 * Retrieve notifications for current logged-in user.
 */
export async function getMyNotifications(req, res, next) {
  try {
    const notifications = await getUserNotifications(req.user._id);
    res.status(200).json({
      success: true,
      data: { notifications },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read.
 */
export async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid notification ID.' },
      });
    }

    const updated = await markNotificationRead(id, req.user._id);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found.' },
      });
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
