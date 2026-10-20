import { Notification } from '../models/Notification.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a persistent notification for a user or trip event.
 */
export async function createNotification({ recipient, type, title, message, trip = null, data = {} }) {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      trip,
      data,
    });
    return notification;
  } catch (error) {
    logger.error(`Failed to create notification for ${recipient}: ${error.message}`);
    return null;
  }
}

/**
 * Retrieve paginated notifications for a specific user.
 * Supports legacy signature (userId, limitNumber) as well as options object.
 */
export async function getUserNotifications(userId, options = {}) {
  let page = 1;
  let limit = 20;
  let unreadOnly = false;

  if (typeof options === 'number') {
    limit = options;
  } else if (options && typeof options === 'object') {
    page = Math.max(1, parseInt(options.page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
    unreadOnly = Boolean(options.unreadOnly);
  }

  const query = { recipient: userId };
  if (unreadOnly) {
    query.read = false;
  }

  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('trip', 'title destination startingCity status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    notifications,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    unreadCount,
  };
}

/**
 * Get count of unread notifications for a user.
 */
export async function getUnreadCount(userId) {
  return Notification.countDocuments({ recipient: userId, read: false });
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

/**
 * Mark all notifications as read for a recipient.
 */
export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true } }
  );
  return { updatedCount: result.modifiedCount };
}
