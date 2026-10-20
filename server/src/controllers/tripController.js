import mongoose from 'mongoose';
import { Trip } from '../models/Trip.js';
import { TripMembership } from '../models/TripMembership.js';
import { Profile } from '../models/Profile.js';
import { validateTripInput, validateDiscoveryQuery } from '../validators/tripValidator.js';
import { createNotification } from '../services/notificationService.js';
import { isBlocked } from '../services/blockService.js';
import { removeUserFromTripRoom } from '../sockets/index.js';

/**
 * Helper to fetch public organiser profile details.
 */
async function getPublicOrganiserProfile(userId) {
  const profile = await Profile.findOne({ user: userId });
  if (!profile) {
    return {
      userId,
      fullName: 'Trip Host',
      verificationStatus: 'unverified',
    };
  }
  return {
    userId: profile.user,
    fullName: profile.fullName,
    profilePhotoUrl: profile.profilePhotoUrl,
    homeCity: profile.homeCity,
    verificationStatus: profile.verification?.status || 'unverified',
  };
}

/**
 * POST /api/trips
 * Create a new trip (draft or published).
 */
export async function createTrip(req, res, next) {
  try {
    const validation = validateTripInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors[0],
          details: validation.errors,
        },
      });
    }

    const tripData = validation.data;

    // Rule: Publishing a trip directly requires verified traveller status
    if (tripData.status === 'published') {
      const isVerified = req.profile?.verification?.status === 'verified';
      if (!isVerified) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'VERIFICATION_REQUIRED',
            message: 'Only verified travellers can publish trips. You may save your trip as a draft until your profile is verified.',
          },
        });
      }
    }

    tripData.organiser = req.user._id;
    tripData.approvedMembersCount = 0;

    const trip = await Trip.create(tripData);
    const organiserProfile = await getPublicOrganiserProfile(req.user._id);

    res.status(201).json({
      success: true,
      data: {
        ...trip.toJSON(),
        organiserProfile,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trips
 * Paginated discovery of published trips with search and filters.
 */
export async function getTrips(req, res, next) {
  try {
    const query = validateDiscoveryQuery(req.query);

    // Strictly enforce status: 'published' for discovery
    const filter = { status: 'published' };

    // Search query in title, destination, or startingCity
    if (query.search) {
      const searchRegex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: searchRegex },
        { destination: searchRegex },
        { startingCity: searchRegex },
      ];
    }

    if (query.destination) {
      filter.destination = new RegExp(query.destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    if (query.startingCity) {
      filter.startingCity = new RegExp(query.startingCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.minBudget !== null || query.maxBudget !== null) {
      filter['budget.amount'] = {};
      if (query.minBudget !== null) filter['budget.amount'].$gte = query.minBudget;
      if (query.maxBudget !== null) filter['budget.amount'].$lte = query.maxBudget;
    }

    if (query.startDateFrom || query.startDateTo) {
      filter.startDate = {};
      if (query.startDateFrom) filter.startDate.$gte = query.startDateFrom;
      if (query.startDateTo) filter.startDate.$lte = query.startDateTo;
    }

    if (query.availableSpots) {
      // approvedMembersCount < (maxGroupSize - 1)
      filter.$expr = {
        $lt: ['$approvedMembersCount', { $subtract: ['$maxGroupSize', 1] }],
      };
    }

    // Determine sort order
    let sortOptions = { startDate: 1 };
    if (query.sort === 'newest') sortOptions = { createdAt: -1 };
    if (query.sort === 'budget_low') sortOptions = { 'budget.amount': 1 };
    if (query.sort === 'budget_high') sortOptions = { 'budget.amount': -1 };

    const total = await Trip.countDocuments(filter);
    const trips = await Trip.find(filter)
      .sort(sortOptions)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit);

    // Populate public organiser details for each trip
    const organiserIds = [...new Set(trips.map((t) => String(t.organiser)))];
    const profiles = await Profile.find({ user: { $in: organiserIds } });
    const profileMap = new Map();
    for (const p of profiles) {
      profileMap.set(String(p.user), {
        userId: p.user,
        fullName: p.fullName,
        profilePhotoUrl: p.profilePhotoUrl,
        homeCity: p.homeCity,
        verificationStatus: p.verification?.status || 'unverified',
      });
    }

    const enrichedTrips = trips.map((trip) => ({
      ...trip.toJSON(),
      organiserProfile: profileMap.get(String(trip.organiser)) || {
        userId: trip.organiser,
        fullName: 'Trip Host',
        verificationStatus: 'unverified',
      },
    }));

    res.status(200).json({
      success: true,
      data: {
        trips: enrichedTrips,
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trips/:id
 * Retrieve trip details and organiser information.
 */
export async function getTripById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID format.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    // If trip is a draft, only the organiser can access it
    if (trip.status === 'draft') {
      const isOrganiser = req.user && trip.organiser.equals(req.user._id);
      if (!isOrganiser) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'This trip draft can only be viewed by its organiser.',
          },
        });
      }
    }

    const organiserProfile = await getPublicOrganiserProfile(trip.organiser);

    // If caller is authenticated, include their current membership status on this trip
    let userMembership = null;
    if (req.user) {
      const membership = await TripMembership.findOne({
        trip: trip._id,
        traveller: req.user._id,
      });
      if (membership) {
        userMembership = {
          id: membership._id,
          status: membership.status,
          message: membership.message,
          createdAt: membership.createdAt,
        };
      }
    }

    const isOrganiser = Boolean(req.user && trip.organiser.equals(req.user._id));

    res.status(200).json({
      success: true,
      data: {
        trip: {
          ...trip.toJSON(),
          organiserProfile,
        },
        userMembership,
        isOrganiser,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/trips/:id
 * Edit an organiser-owned trip.
 */
export async function updateTrip(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    // Ownership check
    if (!trip.organiser.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the trip organiser can edit this trip.' },
      });
    }

    if (trip.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: { code: 'TRIP_CANCELLED', message: 'Cancelled trips cannot be edited.' },
      });
    }

    const validation = validateTripInput(req.body, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors[0],
          details: validation.errors,
        },
      });
    }

    const updates = validation.data;

    // If transitioning to published, require verified status
    if (updates.status === 'published' && trip.status !== 'published') {
      const isVerified = req.profile?.verification?.status === 'verified';
      if (!isVerified) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'VERIFICATION_REQUIRED',
            message: 'Only verified travellers can publish trips.',
          },
        });
      }
    }

    // Ensure updated maxGroupSize is not less than currently approved members + organiser
    if (updates.maxGroupSize !== undefined) {
      const minAllowed = (trip.approvedMembersCount || 0) + 1;
      if (updates.maxGroupSize < minAllowed) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CAPACITY',
            message: `Maximum group size cannot be less than current member count (${minAllowed}).`,
          },
        });
      }
    }

    // Ensure effective date range remains valid (endDate >= startDate)
    const effectiveStartDate = updates.startDate || trip.startDate;
    const effectiveEndDate = updates.endDate || trip.endDate;
    if (effectiveStartDate && effectiveEndDate && new Date(effectiveEndDate) < new Date(effectiveStartDate)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'End date must be on or after the start date.',
        },
      });
    }

    Object.assign(trip, updates);
    await trip.save();

    // If trip is published, notify approved members of changes
    if (trip.status === 'published') {
      const approvedMemberships = await TripMembership.find({
        trip: trip._id,
        status: 'approved',
      });

      for (const m of approvedMemberships) {
        await createNotification({
          recipient: m.traveller,
          type: 'trip_updated',
          title: `Trip Updated: ${trip.title}`,
          message: `The organiser updated details for "${trip.title}". Please review the updated itinerary.`,
          trip: trip._id,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: trip.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/trips/:id/publish
 * Publish a draft trip.
 */
export async function publishTrip(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    if (!trip.organiser.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the trip organiser can publish this trip.' },
      });
    }

    if (trip.status === 'published') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_PUBLISHED', message: 'Trip is already published.' },
      });
    }

    const isVerified = req.profile?.verification?.status === 'verified';
    if (!isVerified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'VERIFICATION_REQUIRED',
          message: 'Only verified travellers can publish trips. Complete profile verification first.',
        },
      });
    }

    trip.status = 'published';
    await trip.save();

    res.status(200).json({
      success: true,
      data: trip.toJSON(),
      message: 'Trip published successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/trips/:id/cancel
 * Cancel an organiser-owned trip and notify members.
 */
export async function cancelTrip(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    if (!trip.organiser.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the organiser can cancel this trip.' },
      });
    }

    if (trip.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_CANCELLED', message: 'Trip is already cancelled.' },
      });
    }

    trip.status = 'cancelled';
    await trip.save();

    // Notify all active participants (approved and pending)
    const activeMembers = await TripMembership.find({
      trip: trip._id,
      status: { $in: ['approved', 'pending'] },
    });

    for (const member of activeMembers) {
      await createNotification({
        recipient: member.traveller,
        type: 'trip_cancelled',
        title: `Trip Cancelled: ${trip.title}`,
        message: `The organiser has cancelled the trip "${trip.title}".`,
        trip: trip._id,
      });
    }

    res.status(200).json({
      success: true,
      data: trip.toJSON(),
      message: 'Trip cancelled and participants notified.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/trips/:id/join
 * Request to join or direct join a published trip.
 */
export async function joinTrip(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    // Organiser cannot join their own trip
    if (trip.organiser.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'CANNOT_JOIN_OWN_TRIP', message: 'You are the organiser of this trip.' },
      });
    }

    // Only published trips can accept members
    if (trip.status !== 'published') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TRIP_NOT_PUBLISHED',
          message: `Cannot join a trip with status '${trip.status}'.`,
        },
      });
    }

    // Safety check: Block relationship between traveller and organiser
    const blocked = await isBlocked(req.user._id, trip.organiser);
    if (blocked) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BLOCKED_INTERACTION',
          message: 'Cannot request to join this trip due to an active block relationship between you and the host.',
        },
      });
    }

    // Check existing membership record
    const existingMembership = await TripMembership.findOne({
      trip: trip._id,
      traveller: req.user._id,
    });

    if (existingMembership) {
      if (existingMembership.status === 'approved') {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_APPROVED', message: 'You are already an approved member of this trip.' },
        });
      }
      if (existingMembership.status === 'pending') {
        return res.status(400).json({
          success: false,
          error: { code: 'ALREADY_PENDING', message: 'You already have a pending join request for this trip.' },
        });
      }
    }

    const maxJoiners = Math.max(0, trip.maxGroupSize - 1);

    // Policy: Direct Join
    if (trip.joinPolicy === 'direct_join') {
      // Concurrency-safe atomic capacity increment
      const updatedTrip = await Trip.findOneAndUpdate(
        {
          _id: trip._id,
          status: 'published',
          approvedMembersCount: { $lt: maxJoiners },
        },
        { $inc: { approvedMembersCount: 1 } },
        { new: true }
      );

      if (!updatedTrip) {
        return res.status(400).json({
          success: false,
          error: { code: 'TRIP_FULL', message: 'This trip has reached maximum capacity.' },
        });
      }

      const membership = await TripMembership.findOneAndUpdate(
        { trip: trip._id, traveller: req.user._id },
        {
          status: 'approved',
          message: typeof message === 'string' ? message.trim().slice(0, 500) : '',
          reviewedAt: new Date(),
          decisionReason: 'Direct join policy auto-approval',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Notify organiser
      const travellerProfile = await Profile.findOne({ user: req.user._id });
      await createNotification({
        recipient: trip.organiser,
        type: 'join_request_received',
        title: `New member joined: ${trip.title}`,
        message: `${travellerProfile?.fullName || 'A traveller'} directly joined "${trip.title}".`,
        trip: trip._id,
      });

      return res.status(201).json({
        success: true,
        data: {
          membership: membership.toJSON(),
          approved: true,
          message: 'You have successfully joined the trip!',
        },
      });
    }

    // Policy: Approval Required
    if ((trip.approvedMembersCount || 0) >= maxJoiners) {
      return res.status(400).json({
        success: false,
        error: { code: 'TRIP_FULL', message: 'This trip has reached maximum capacity.' },
      });
    }

    const membership = await TripMembership.findOneAndUpdate(
      { trip: trip._id, traveller: req.user._id },
      {
        status: 'pending',
        message: typeof message === 'string' ? message.trim().slice(0, 500) : '',
        decisionReason: null,
        reviewedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Notify organiser
    const travellerProfile = await Profile.findOne({ user: req.user._id });
    await createNotification({
      recipient: trip.organiser,
      type: 'join_request_received',
      title: `Join Request: ${trip.title}`,
      message: `${travellerProfile?.fullName || 'A traveller'} requested to join "${trip.title}".`,
      trip: trip._id,
    });

    res.status(201).json({
      success: true,
      data: {
        membership: membership.toJSON(),
        approved: false,
        message: 'Join request submitted. Awaiting organiser approval.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trips/:id/requests
 * Organiser-only request list with applicant public profiles.
 */
export async function getTripRequests(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    if (!trip.organiser.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the organiser can view join requests.' },
      });
    }

    const memberships = await TripMembership.find({ trip: trip._id }).sort({ createdAt: -1 });

    const travellerIds = memberships.map((m) => m.traveller);
    const profiles = await Profile.find({ user: { $in: travellerIds } });
    const profileMap = new Map();
    for (const p of profiles) {
      profileMap.set(String(p.user), {
        userId: p.user,
        fullName: p.fullName,
        profilePhotoUrl: p.profilePhotoUrl,
        homeCity: p.homeCity,
        verificationStatus: p.verification?.status || 'unverified',
        bio: p.bio,
      });
    }

    const enriched = memberships.map((m) => ({
      ...m.toJSON(),
      travellerProfile: profileMap.get(String(m.traveller)) || {
        userId: m.traveller,
        fullName: 'Traveller',
        verificationStatus: 'unverified',
      },
    }));

    res.status(200).json({
      success: true,
      data: { requests: enriched },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/trips/:id/requests/:requestId/approve
 * Organiser approves a pending request with concurrency-safe capacity check.
 */
export async function approveRequest(req, res, next) {
  try {
    const { id, requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid ID parameters.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    if (!trip.organiser.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the organiser can approve join requests.' },
      });
    }

    const membership = await TripMembership.findOne({ _id: requestId, trip: trip._id });
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: 'Join request not found.' },
      });
    }

    if (membership.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_APPROVED', message: 'This request is already approved.' },
      });
    }

    const maxJoiners = Math.max(0, trip.maxGroupSize - 1);

    // Atomic capacity increment
    const updatedTrip = await Trip.findOneAndUpdate(
      {
        _id: trip._id,
        approvedMembersCount: { $lt: maxJoiners },
      },
      { $inc: { approvedMembersCount: 1 } },
      { new: true }
    );

    if (!updatedTrip) {
      return res.status(400).json({
        success: false,
        error: { code: 'CAPACITY_EXCEEDED', message: 'Cannot approve request: group capacity has been reached.' },
      });
    }

    membership.status = 'approved';
    membership.reviewedAt = new Date();
    membership.reviewedBy = req.user._id;
    membership.decisionReason = req.body.reason || 'Approved by organiser';
    await membership.save();

    // Notify traveller
    await createNotification({
      recipient: membership.traveller,
      type: 'request_approved',
      title: `Request Approved: ${trip.title}`,
      message: `Your request to join "${trip.title}" has been approved! You are now a member.`,
      trip: trip._id,
    });

    res.status(200).json({
      success: true,
      data: {
        membership: membership.toJSON(),
        tripApprovedCount: updatedTrip.approvedMembersCount,
      },
      message: 'Request approved successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/trips/:id/requests/:requestId/reject
 * Organiser rejects a join request.
 */
export async function rejectRequest(req, res, next) {
  try {
    const { id, requestId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid ID parameters.' },
      });
    }

    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Trip not found.' },
      });
    }

    if (!trip.organiser.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the organiser can reject requests.' },
      });
    }

    const membership = await TripMembership.findOne({ _id: requestId, trip: trip._id });
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: { code: 'REQUEST_NOT_FOUND', message: 'Join request not found.' },
      });
    }

    if (membership.status === 'rejected') {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_REJECTED', message: 'This request is already rejected.' },
      });
    }

    if (membership.status === 'withdrawn') {
      return res.status(400).json({
        success: false,
        error: { code: 'REQUEST_WITHDRAWN', message: 'This request was withdrawn by the applicant.' },
      });
    }

    const wasApproved = membership.status === 'approved';

    // If previously approved, safely decrement count and evict from room
    if (wasApproved) {
      await Trip.findOneAndUpdate(
        { _id: trip._id, approvedMembersCount: { $gt: 0 } },
        { $inc: { approvedMembersCount: -1 } }
      );
      try {
        removeUserFromTripRoom(membership.traveller, trip._id);
      } catch {
        // Best-effort socket removal
      }
    }

    membership.status = 'rejected';
    membership.reviewedAt = new Date();
    membership.reviewedBy = req.user._id;
    membership.decisionReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : 'Declined by organiser';
    await membership.save();

    // Notify traveller
    await createNotification({
      recipient: membership.traveller,
      type: 'request_rejected',
      title: `Request Update: ${trip.title}`,
      message: `Your request to join "${trip.title}" was declined by the organiser.`,
      trip: trip._id,
    });

    res.status(200).json({
      success: true,
      data: membership.toJSON(),
      message: 'Request rejected.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/trips/:id/leave
 * Traveller leaves a trip or withdraws their request.
 */
export async function leaveTrip(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid trip ID.' },
      });
    }

    const membership = await TripMembership.findOne({ trip: id, traveller: req.user._id });
    if (!membership || membership.status === 'withdrawn') {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_A_MEMBER', message: 'You do not have an active membership or request on this trip.' },
      });
    }

    const wasApproved = membership.status === 'approved';

    // If user was an approved member, decrement capacity safely
    if (wasApproved) {
      await Trip.findOneAndUpdate(
        { _id: id, approvedMembersCount: { $gt: 0 } },
        { $inc: { approvedMembersCount: -1 } }
      );
    }

    membership.status = 'withdrawn';
    await membership.save();

    const trip = await Trip.findById(id);
    if (trip && wasApproved) {
      const travellerProfile = await Profile.findOne({ user: req.user._id });
      await createNotification({
        recipient: trip.organiser,
        type: 'member_left',
        title: `Member Left: ${trip.title}`,
        message: `${travellerProfile?.fullName || 'A member'} has left the trip "${trip.title}".`,
        trip: trip._id,
      });

      // Revoke socket access from the Trip Room immediately
      try {
        removeUserFromTripRoom(req.user._id, trip._id);
      } catch {
        // Best-effort socket removal
      }
    }

    res.status(200).json({
      success: true,
      message: 'You have left the trip successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trips/mine/organized
 * Returns trips created by the logged-in user.
 */
export async function getMyOrganizedTrips(req, res, next) {
  try {
    const trips = await Trip.find({ organiser: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: { trips: trips.map((t) => t.toJSON()) },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trips/mine/joined
 * Returns trips where the logged-in user is an approved member.
 */
export async function getMyJoinedTrips(req, res, next) {
  try {
    const memberships = await TripMembership.find({
      traveller: req.user._id,
      status: 'approved',
    });

    const tripIds = memberships.map((m) => m.trip);
    const trips = await Trip.find({ _id: { $in: tripIds } }).sort({ startDate: 1 });

    const organiserIds = [...new Set(trips.map((t) => String(t.organiser)))];
    const profiles = await Profile.find({ user: { $in: organiserIds } });
    const profileMap = new Map();
    for (const p of profiles) {
      profileMap.set(String(p.user), {
        userId: p.user,
        fullName: p.fullName,
        profilePhotoUrl: p.profilePhotoUrl,
        homeCity: p.homeCity,
        verificationStatus: p.verification?.status || 'unverified',
      });
    }

    const enrichedTrips = trips.map((trip) => ({
      ...trip.toJSON(),
      organiserProfile: profileMap.get(String(trip.organiser)),
    }));

    res.status(200).json({
      success: true,
      data: { trips: enrichedTrips },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/trips/mine/requests
 * Returns pending and historical requests submitted by the logged-in user.
 */
export async function getMyTripRequests(req, res, next) {
  try {
    const memberships = await TripMembership.find({
      traveller: req.user._id,
      status: { $in: ['pending', 'rejected', 'withdrawn'] },
    }).sort({ createdAt: -1 });

    const tripIds = memberships.map((m) => m.trip);
    const trips = await Trip.find({ _id: { $in: tripIds } });
    const tripMap = new Map();
    for (const t of trips) {
      tripMap.set(String(t._id), t.toJSON());
    }

    const enriched = memberships.map((m) => ({
      ...m.toJSON(),
      trip: tripMap.get(String(m.trip)) || null,
    }));

    res.status(200).json({
      success: true,
      data: { requests: enriched },
    });
  } catch (error) {
    next(error);
  }
}
