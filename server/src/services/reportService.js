import mongoose from 'mongoose';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { Trip } from '../models/Trip.js';
import { TripMessage } from '../models/TripMessage.js';
import { createNotification } from './notificationService.js';
import { disconnectUserSockets } from '../sockets/index.js';
import { logger } from '../utils/logger.js';

const ALLOWED_TARGET_TYPES = ['user', 'trip', 'message'];
const ALLOWED_CATEGORIES = [
  'harassment',
  'spam',
  'misleading',
  'impersonation',
  'unsafe_conduct',
  'inappropriate_content',
  'other',
];
const ALLOWED_STATUSES = ['open', 'under_review', 'action_taken', 'dismissed'];
const ALLOWED_ACTIONS = ['none', 'warning_issued', 'content_removed', 'user_suspended', 'dismissed'];

/**
 * Creates a persistent safety report.
 */
export async function createReport({
  reporterId,
  targetType,
  targetId,
  category,
  explanation = '',
}) {
  if (!mongoose.Types.ObjectId.isValid(reporterId) || !mongoose.Types.ObjectId.isValid(targetId)) {
    const error = new Error('Invalid identifier provided.');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  if (!ALLOWED_TARGET_TYPES.includes(targetType)) {
    const error = new Error(`Target type must be one of: ${ALLOWED_TARGET_TYPES.join(', ')}`);
    error.statusCode = 400;
    error.code = 'INVALID_TARGET_TYPE';
    throw error;
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    const error = new Error(`Report category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
    error.statusCode = 400;
    error.code = 'INVALID_CATEGORY';
    throw error;
  }

  // 1. Target existence validation and target-specific rules
  let targetSummary = null;
  if (targetType === 'user') {
    if (reporterId.toString() === targetId.toString()) {
      const error = new Error('You cannot report yourself.');
      error.statusCode = 400;
      error.code = 'CANNOT_REPORT_SELF';
      throw error;
    }
    const user = await User.findById(targetId).select('email accountStatus');
    if (!user) {
      const error = new Error('The reported user does not exist.');
      error.statusCode = 404;
      error.code = 'TARGET_NOT_FOUND';
      throw error;
    }
    targetSummary = { email: user.email, status: user.accountStatus };
  } else if (targetType === 'trip') {
    const trip = await Trip.findById(targetId).select('title destination status organiser');
    if (!trip) {
      const error = new Error('The reported trip listing does not exist.');
      error.statusCode = 404;
      error.code = 'TARGET_NOT_FOUND';
      throw error;
    }
    targetSummary = { title: trip.title, destination: trip.destination, status: trip.status };
  } else if (targetType === 'message') {
    const msg = await TripMessage.findById(targetId);
    if (!msg) {
      const error = new Error('The reported message does not exist.');
      error.statusCode = 404;
      error.code = 'TARGET_NOT_FOUND';
      throw error;
    }
    // Update message moderation status
    if (!msg.moderation.reportedBy.includes(reporterId)) {
      msg.moderation.reportedBy.push(reporterId);
    }
    msg.moderation.status = 'reported';
    if (explanation) {
      msg.moderation.reportReason = explanation.slice(0, 500);
    }
    await msg.save();
    targetSummary = { tripId: msg.trip, senderId: msg.sender };
  }

  // 2. Prevent duplicate open reports from the same user for the same target
  const existingOpen = await Report.findOne({
    reporter: reporterId,
    targetType,
    targetId,
    status: { $in: ['open', 'under_review'] },
  });

  if (existingOpen) {
    const error = new Error('You already have an active report open for this item. Our moderation team is reviewing it.');
    error.statusCode = 409;
    error.code = 'DUPLICATE_REPORT';
    throw error;
  }

  // 3. Create the report
  const cleanExplanation = typeof explanation === 'string' ? explanation.trim().slice(0, 1000) : '';

  const report = await Report.create({
    reporter: reporterId,
    targetType,
    targetId,
    category,
    explanation: cleanExplanation,
    status: 'open',
  });

  logger.info(`Safety report created [${report._id}] by user ${reporterId} on ${targetType}:${targetId} (${category})`);

  return {
    _id: report._id,
    targetType: report.targetType,
    targetId: report.targetId,
    category: report.category,
    explanation: report.explanation,
    status: report.status,
    createdAt: report.createdAt,
    targetSummary,
  };
}

/**
 * Retrieves reports submitted by the logged-in user.
 * Moderator notes and internal review metadata are never selected.
 */
export async function getReporterReports(reporterId) {
  return Report.find({ reporter: reporterId })
    .select('-moderatorNotes')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Admin: Retrieve paginated moderation queue.
 */
export async function getAdminReportsQueue({
  status,
  targetType,
  page = 1,
  limit = 20,
}) {
  const query = {};
  if (status && ALLOWED_STATUSES.includes(status)) {
    query.status = status;
  }
  if (targetType && ALLOWED_TARGET_TYPES.includes(targetType)) {
    query.targetType = targetType;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [reports, total] = await Promise.all([
    Report.find(query)
      .select('+moderatorNotes')
      .populate('reporter', 'email')
      .populate('resolvedBy', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    Report.countDocuments(query),
  ]);

  // Enrich reports with target previews where applicable
  const enrichedReports = await Promise.all(
    reports.map(async (r) => {
      let targetDetails = null;
      try {
        if (r.targetType === 'user') {
          const u = await User.findById(r.targetId).select('email accountStatus');
          targetDetails = u ? { email: u.email, accountStatus: u.accountStatus } : null;
        } else if (r.targetType === 'trip') {
          const t = await Trip.findById(r.targetId).select('title destination status');
          targetDetails = t ? { title: t.title, destination: t.destination, status: t.status } : null;
        } else if (r.targetType === 'message') {
          const m = await TripMessage.findById(r.targetId).populate('sender', 'email').select('message moderation trip sender');
          targetDetails = m ? { message: m.message, sender: m.sender?.email, moderation: m.moderation } : null;
        }
      } catch {
        targetDetails = null;
      }

      return {
        ...r,
        targetDetails,
      };
    })
  );

  return {
    reports: enrichedReports,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
  };
}

/**
 * Admin: Resolve or update status on a moderation report.
 */
export async function resolveReport({
  reportId,
  adminId,
  status,
  resolutionAction = 'none',
  moderatorNotes = '',
}) {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    const error = new Error('Invalid report ID.');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    const error = new Error(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
    error.statusCode = 400;
    error.code = 'INVALID_STATUS';
    throw error;
  }

  if (resolutionAction && !ALLOWED_ACTIONS.includes(resolutionAction)) {
    const error = new Error(`Resolution action must be one of: ${ALLOWED_ACTIONS.join(', ')}`);
    error.statusCode = 400;
    error.code = 'INVALID_ACTION';
    throw error;
  }

  const report = await Report.findById(reportId).select('+moderatorNotes');
  if (!report) {
    const error = new Error('Report not found.');
    error.statusCode = 404;
    error.code = 'REPORT_NOT_FOUND';
    throw error;
  }

  report.status = status || report.status;
  report.resolutionAction = resolutionAction;
  report.moderatorNotes = typeof moderatorNotes === 'string' ? moderatorNotes.trim().slice(0, 2000) : report.moderatorNotes;
  report.resolvedBy = adminId;
  report.resolvedAt = new Date();

  // Execute moderation actions if specified
  let targetUserToNotify = null;
  if (resolutionAction === 'content_removed') {
    if (report.targetType === 'message') {
      const msg = await TripMessage.findById(report.targetId);
      if (msg) {
        msg.moderation.status = 'removed';
        msg.message = '[This message was removed by moderation for violating community guidelines]';
        await msg.save();
        targetUserToNotify = msg.sender;
      }
    } else if (report.targetType === 'trip') {
      const trip = await Trip.findById(report.targetId);
      if (trip && trip.status !== 'cancelled') {
        trip.status = 'cancelled';
        await trip.save();
        targetUserToNotify = trip.organiser;
      }
    }
  } else if (resolutionAction === 'user_suspended') {
    let targetUserId = null;
    if (report.targetType === 'user') {
      targetUserId = report.targetId;
    } else if (report.targetType === 'message') {
      const msg = await TripMessage.findById(report.targetId);
      targetUserId = msg?.sender;
    } else if (report.targetType === 'trip') {
      const trip = await Trip.findById(report.targetId);
      targetUserId = trip?.organiser;
    }

    if (targetUserId) {
      await User.findByIdAndUpdate(targetUserId, { accountStatus: 'suspended' });
      // Terminate any active socket sessions immediately
      try {
        disconnectUserSockets(targetUserId);
      } catch (err) {
        logger.error(`Error disconnecting sockets for suspended user ${targetUserId}: ${err.message}`);
      }
      targetUserToNotify = targetUserId;
    }
  }

  await report.save();

  // Notify reporter that their report was reviewed
  await createNotification({
    recipient: report.reporter,
    type: 'moderation_notice',
    title: 'Report Update',
    message: 'Your report has been reviewed by the moderation team. Thank you for helping keep TripZa safe.',
  });

  // If action was taken against a user, notify them without revealing reporter info
  if (targetUserToNotify && resolutionAction !== 'dismissed') {
    await createNotification({
      recipient: targetUserToNotify,
      type: 'moderation_notice',
      title: 'Moderation Action Notice',
      message:
        resolutionAction === 'user_suspended'
          ? 'Your account has been suspended for violating TripZa safety policies.'
          : 'Content you published was moderated for violating TripZa community safety guidelines.',
    });
  }

  logger.info(`Report ${report._id} resolved by admin ${adminId}: status=${report.status}, action=${resolutionAction}`);

  return report.toJSON();
}
