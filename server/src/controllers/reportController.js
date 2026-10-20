import {
  createReport,
  getReporterReports,
  getAdminReportsQueue,
  resolveReport,
} from '../services/reportService.js';
import { User } from '../models/User.js';
import { TripMessage } from '../models/TripMessage.js';
import { disconnectUserSockets } from '../sockets/index.js';

/**
 * POST /api/reports
 * Submit a report for a user, trip, or message.
 */
export async function submitReport(req, res, next) {
  try {
    const { targetType, targetId, category, explanation } = req.body;
    const report = await createReport({
      reporterId: req.user._id,
      targetType,
      targetId,
      category,
      explanation,
    });

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report submitted successfully. Our safety team will review it.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/mine
 * List reports submitted by current user.
 */
export async function getMyReports(req, res, next) {
  try {
    const reports = await getReporterReports(req.user._id);
    res.status(200).json({
      success: true,
      data: { reports },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/reports
 * Admin: Retrieve paginated moderation queue.
 */
export async function getAdminReports(req, res, next) {
  try {
    const { status, targetType, page, limit } = req.query;
    const result = await getAdminReportsQueue({ status, targetType, page, limit });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/reports/:id
 * Admin: Resolve or update status on a moderation report.
 */
export async function updateAdminReport(req, res, next) {
  try {
    const { id } = req.params;
    const { status, resolutionAction, moderatorNotes } = req.body;

    const updated = await resolveReport({
      reportId: id,
      adminId: req.user._id,
      status,
      resolutionAction,
      moderatorNotes,
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Report updated successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Admin: Suspend or reactivate user account.
 */
export async function updateAdminUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { accountStatus } = req.body;

    if (!['active', 'suspended', 'deactivated'].includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: 'accountStatus must be active, suspended, or deactivated.' },
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      });
    }

    user.accountStatus = accountStatus;
    await user.save();

    if (accountStatus === 'suspended' || accountStatus === 'deactivated') {
      disconnectUserSockets(user._id);
    }

    res.status(200).json({
      success: true,
      data: { userId: user._id, email: user.email, accountStatus: user.accountStatus },
      message: `User account status set to ${accountStatus}.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/messages/:id/moderate
 * Admin: Directly remove or restore a message.
 */
export async function moderateMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'remove' or 'restore'

    const message = await TripMessage.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found.' },
      });
    }

    if (action === 'remove') {
      message.moderation.status = 'removed';
      message.message = '[This message was removed by moderation for violating community guidelines]';
    } else if (action === 'restore') {
      message.moderation.status = 'active';
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'Action must be remove or restore.' },
      });
    }

    await message.save();

    res.status(200).json({
      success: true,
      data: { messageId: message._id, moderation: message.moderation },
      message: `Message moderation updated to ${message.moderation.status}.`,
    });
  } catch (error) {
    next(error);
  }
}
