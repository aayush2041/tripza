import { blockUser, unblockUser, getBlockedUsers } from '../services/blockService.js';

/**
 * POST /api/blocks
 * Block a user.
 */
export async function createBlock(req, res, next) {
  try {
    const { blockedUserId, reason } = req.body;
    if (!blockedUserId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'blockedUserId is required.' },
      });
    }

    const blockRecord = await blockUser(req.user._id, blockedUserId, reason);

    res.status(201).json({
      success: true,
      data: blockRecord,
      message: 'User blocked successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/blocks/:userId
 * Unblock a user.
 */
export async function deleteBlock(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await unblockUser(req.user._id, userId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'User unblocked successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/blocks
 * Retrieve list of blocked users.
 */
export async function getMyBlockedUsers(req, res, next) {
  try {
    const blockedList = await getBlockedUsers(req.user._id);

    res.status(200).json({
      success: true,
      data: { blockedUsers: blockedList },
    });
  } catch (error) {
    next(error);
  }
}
