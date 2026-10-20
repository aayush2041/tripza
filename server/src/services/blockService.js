import mongoose from 'mongoose';
import { Block } from '../models/Block.js';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';

/**
 * Creates a persistent block relationship from blocker to blockedUser.
 */
export async function blockUser(blockerId, blockedUserId, reason = '') {
  if (!mongoose.Types.ObjectId.isValid(blockerId) || !mongoose.Types.ObjectId.isValid(blockedUserId)) {
    const error = new Error('Invalid user identifier.');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  if (blockerId.toString() === blockedUserId.toString()) {
    const error = new Error('You cannot block yourself.');
    error.statusCode = 400;
    error.code = 'CANNOT_BLOCK_SELF';
    throw error;
  }

  const targetUser = await User.findById(blockedUserId);
  if (!targetUser) {
    const error = new Error('User to block does not exist.');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const existing = await Block.findOne({ blocker: blockerId, blocked: blockedUserId });
  if (existing) {
    return existing;
  }

  const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : '';

  const blockRecord = await Block.create({
    blocker: blockerId,
    blocked: blockedUserId,
    reason: cleanReason,
  });

  return blockRecord;
}

/**
 * Removes a block relationship.
 */
export async function unblockUser(blockerId, blockedUserId) {
  if (!mongoose.Types.ObjectId.isValid(blockerId) || !mongoose.Types.ObjectId.isValid(blockedUserId)) {
    const error = new Error('Invalid user identifier.');
    error.statusCode = 400;
    error.code = 'INVALID_ID';
    throw error;
  }

  const deleted = await Block.findOneAndDelete({
    blocker: blockerId,
    blocked: blockedUserId,
  });

  if (!deleted) {
    const error = new Error('Block relationship not found.');
    error.statusCode = 404;
    error.code = 'BLOCK_NOT_FOUND';
    throw error;
  }

  return { success: true, unblockedUserId: blockedUserId };
}

/**
 * Retrieves the list of users blocked by the specified user.
 */
export async function getBlockedUsers(blockerId) {
  const blocks = await Block.find({ blocker: blockerId })
    .populate('blocked', 'email accountStatus')
    .sort({ createdAt: -1 })
    .lean();

  const blockedUserIds = blocks.map((b) => b.blocked?._id).filter(Boolean);
  const profiles = await Profile.find({ user: { $in: blockedUserIds } })
    .select('user fullName profilePhotoUrl homeCity')
    .lean();

  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  return blocks.map((b) => {
    const p = profileMap.get(b.blocked?._id?.toString());
    return {
      blockId: b._id,
      blockedUser: {
        _id: b.blocked?._id,
        email: b.blocked?.email,
        fullName: p?.fullName || b.blocked?.email,
        profilePhotoUrl: p?.profilePhotoUrl || null,
        homeCity: p?.homeCity || null,
      },
      reason: b.reason,
      createdAt: b.createdAt,
    };
  });
}

/**
 * Checks if a bidirectional block exists between userA and userB.
 */
export async function isBlocked(userAId, userBId) {
  if (!userAId || !userBId) return false;
  if (userAId.toString() === userBId.toString()) return false;

  const exists = await Block.exists({
    $or: [
      { blocker: userAId, blocked: userBId },
      { blocker: userBId, blocked: userAId },
    ],
  });

  return Boolean(exists);
}

/**
 * Returns an array of user IDs that either blocked or were blocked by userId.
 */
export async function getMutualBlockedUserIds(userId) {
  if (!userId) return [];

  const blocks = await Block.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).select('blocker blocked').lean();

  const idSet = new Set();
  for (const b of blocks) {
    if (b.blocker.toString() === userId.toString()) {
      idSet.add(b.blocked.toString());
    } else {
      idSet.add(b.blocker.toString());
    }
  }

  return Array.from(idSet);
}
