import mongoose from 'mongoose';
import { Trip } from '../models/Trip.js';
import { TripMembership } from '../models/TripMembership.js';
import { TripMessage } from '../models/TripMessage.js';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';

/**
 * Validates whether a given user has permission to access a Trip Room.
 * Access is granted ONLY to:
 * 1. The trip organiser
 * 2. An approved active member (TripMembership status === 'approved')
 *
 * @param {string|mongoose.Types.ObjectId} tripId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{
 *   allowed: boolean,
 *   reason?: string,
 *   statusCode?: number,
 *   trip?: any,
 *   userRole?: 'organiser'|'member',
 *   isOrganiser?: boolean,
 *   isMember?: boolean,
 *   isArchived?: boolean
 * }>}
 */
export async function checkRoomAccess(tripId, userId) {
  if (!mongoose.Types.ObjectId.isValid(tripId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return { allowed: false, reason: 'Invalid trip or user identifier', statusCode: 400 };
  }

  const trip = await Trip.findById(tripId).select('title destination startingCity status organiser maxGroupSize startDate endDate');
  if (!trip) {
    return { allowed: false, reason: 'Trip not found', statusCode: 404 };
  }

  // Check if current user is the organiser
  const isOrganiser = trip.organiser.toString() === userId.toString();
  if (isOrganiser) {
    return {
      allowed: true,
      trip,
      userRole: 'organiser',
      isOrganiser: true,
      isMember: false,
      isArchived: trip.status === 'cancelled' || trip.status === 'completed',
    };
  }

  // Check if user is an approved member
  const membership = await TripMembership.findOne({
    trip: tripId,
    traveller: userId,
  });

  if (membership && membership.status === 'approved') {
    return {
      allowed: true,
      trip,
      userRole: 'member',
      isOrganiser: false,
      isMember: true,
      isArchived: trip.status === 'cancelled' || trip.status === 'completed',
    };
  }

  // Non-member or pending / rejected / withdrawn
  return {
    allowed: false,
    reason: membership?.status
      ? `Join request status is '${membership.status}'. Only approved members and the host may access the Trip Room.`
      : 'You must be a confirmed trip member or the organiser to access this private Trip Room.',
    statusCode: 403,
    membershipStatus: membership?.status || 'none',
  };
}

/**
 * Retrieves room metadata and active member roster.
 */
export async function getRoomDetails(tripId, userId) {
  const access = await checkRoomAccess(tripId, userId);
  if (!access.allowed) {
    const error = new Error(access.reason);
    error.statusCode = access.statusCode;
    error.code = 'ROOM_ACCESS_DENIED';
    throw error;
  }

  const { trip, userRole, isArchived } = access;

  // Organiser info
  const organiserUser = await User.findById(trip.organiser).select('email');
  const organiserProfile = await Profile.findOne({ user: trip.organiser }).select('fullName profilePhotoUrl verification');

  // Approved members info
  const memberships = await TripMembership.find({
    trip: tripId,
    status: 'approved',
  }).populate('traveller', 'email');

  const travellerIds = memberships.map((m) => m.traveller?._id).filter(Boolean);
  const memberProfiles = await Profile.find({ user: { $in: travellerIds } }).select('user fullName profilePhotoUrl verification');
  const memberProfileMap = new Map(memberProfiles.map((p) => [p.user.toString(), p]));

  const members = memberships.map((m) => {
    const p = memberProfileMap.get(m.traveller?._id?.toString());
    return {
      userId: m.traveller?._id,
      email: m.traveller?.email,
      fullName: p?.fullName || m.traveller?.email,
      profilePhotoUrl: p?.profilePhotoUrl || null,
      isVerified: p?.verification?.status === 'verified',
      role: 'member',
      joinedAt: m.decidedAt || m.updatedAt,
    };
  });

  return {
    tripId: trip._id,
    title: trip.title,
    destination: trip.destination,
    startingCity: trip.startingCity,
    startDate: trip.startDate,
    endDate: trip.endDate,
    tripStatus: trip.status,
    isArchived,
    userRole,
    organiser: {
      userId: organiserUser?._id,
      email: organiserUser?.email,
      fullName: organiserProfile?.fullName || organiserUser?.email,
      profilePhotoUrl: organiserProfile?.profilePhotoUrl || null,
      isVerified: organiserProfile?.verification?.status === 'verified',
      role: 'organiser',
    },
    members,
    totalCount: members.length + 1, // Organiser + approved members
  };
}

/**
 * Retrieves paginated chronological messages for a Trip Room.
 */
export async function getRoomMessages(tripId, { before, limit = 50 }) {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  const query = {
    trip: tripId,
    'moderation.status': { $ne: 'hidden' },
  };

  if (before) {
    if (mongoose.Types.ObjectId.isValid(before)) {
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    } else {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }
  }

  // Fetch in reverse chronological order (newest first)
  const rawMessages = await TripMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(parsedLimit + 1)
    .populate('sender', 'email')
    .lean();

  const hasMore = rawMessages.length > parsedLimit;
  const messagesSlice = hasMore ? rawMessages.slice(0, parsedLimit) : rawMessages;

  const senderIds = [...new Set(messagesSlice.map((m) => m.sender?._id || m.sender).filter(Boolean))];
  const profiles = await Profile.find({ user: { $in: senderIds } }).select('user fullName profilePhotoUrl verification');
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  // Format messages safely
  const formattedMessages = messagesSlice.map((msg) => {
    const senderId = (msg.sender?._id || msg.sender)?.toString();
    const p = profileMap.get(senderId);
    return {
      _id: msg._id,
      tripId: msg.trip,
      sender: {
        _id: msg.sender?._id || msg.sender,
        email: msg.sender?.email,
        fullName: p?.fullName || msg.sender?.email || 'Traveller',
        profilePhotoUrl: p?.profilePhotoUrl || null,
        isVerified: p?.verification?.status === 'verified',
      },
      message: msg.moderation?.status === 'deleted' ? 'This message was deleted.' : msg.message,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt,
      isDeleted: msg.moderation?.status === 'deleted',
    };
  });

  // Reverse so the client receives chronological order (oldest to newest)
  formattedMessages.reverse();

  const nextCursor = hasMore && messagesSlice.length > 0 ? messagesSlice[messagesSlice.length - 1]._id : null;

  return {
    messages: formattedMessages,
    hasMore,
    nextCursor,
  };
}

/**
 * Validates and persists a new message in MongoDB.
 */
export async function saveRoomMessage(tripId, userId, messageText) {
  const access = await checkRoomAccess(tripId, userId);
  if (!access.allowed) {
    const error = new Error(access.reason);
    error.statusCode = access.statusCode;
    error.code = 'ROOM_ACCESS_DENIED';
    throw error;
  }

  // If trip is cancelled, message creation is forbidden
  if (access.trip.status === 'cancelled') {
    const error = new Error('Cannot send messages: This trip has been cancelled and the Trip Room is archived in read-only mode.');
    error.statusCode = 400;
    error.code = 'TRIP_CANCELLED';
    throw error;
  }

  const cleanText = (messageText || '').trim();
  if (!cleanText) {
    const error = new Error('Message text cannot be empty.');
    error.statusCode = 400;
    error.code = 'INVALID_MESSAGE';
    throw error;
  }

  if (cleanText.length > 2000) {
    const error = new Error('Message text exceeds maximum length of 2000 characters.');
    error.statusCode = 400;
    error.code = 'MESSAGE_TOO_LONG';
    throw error;
  }

  const newMessage = await TripMessage.create({
    trip: tripId,
    sender: userId,
    message: cleanText,
  });

  const populated = await TripMessage.findById(newMessage._id).populate('sender', 'email').lean();
  const senderProfile = await Profile.findOne({ user: userId }).select('fullName profilePhotoUrl verification');

  return {
    _id: populated._id,
    tripId: populated.trip,
    sender: {
      _id: populated.sender?._id,
      email: populated.sender?.email,
      fullName: senderProfile?.fullName || populated.sender?.email,
      profilePhotoUrl: senderProfile?.profilePhotoUrl || null,
      isVerified: senderProfile?.verification?.status === 'verified',
    },
    message: populated.message,
    createdAt: populated.createdAt,
    editedAt: populated.editedAt,
    isDeleted: false,
  };
}

/**
 * Report a message for moderation.
 */
export async function reportRoomMessage(tripId, messageId, userId, reportReason = '') {
  const access = await checkRoomAccess(tripId, userId);
  if (!access.allowed) {
    const error = new Error(access.reason);
    error.statusCode = access.statusCode;
    error.code = 'ROOM_ACCESS_DENIED';
    throw error;
  }

  const message = await TripMessage.findOne({ _id: messageId, trip: tripId });
  if (!message) {
    const error = new Error('Message not found.');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (!message.moderation.reportedBy.includes(userId)) {
    message.moderation.reportedBy.push(userId);
  }
  message.moderation.status = 'reported';
  if (reportReason) {
    message.moderation.reportReason = reportReason.slice(0, 500);
  }
  await message.save();

  return { success: true, messageId: message._id, status: message.moderation.status };
}
