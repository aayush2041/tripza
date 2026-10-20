import { Notification } from '../models/Notification.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a persistent notification for a trip event.
 */
export async function createNotification({ recipient, type, title, message, trip = null }) {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      trip,
    });
    return notification;
  } catch (error) {
    logger.error(`Failed to create notification for ${recipient}: ${error.message}`);
    return null;
  }
}

/**
 * Retrieve notifications for a specific user.
 */
export async function getUserNotifications(userId, limit = 20) {
  return Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

/**
 * Mark a single notification as read by its recipient.
 */
export async function markNotificationRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { read: true } },
    { new: true }
  );
}
