import { Router } from 'express';
import {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  publishTrip,
  cancelTrip,
  joinTrip,
  getTripRequests,
  approveRequest,
  rejectRequest,
  leaveTrip,
  getMyOrganizedTrips,
  getMyJoinedTrips,
  getMyTripRequests,
} from '../controllers/tripController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

import {
  getRoomMetadata,
  getMessages,
  postMessage,
  reportMessage,
} from '../controllers/roomController.js';

const router = Router();

// 1. Discovery & Public Endpoints
router.get('/', getTrips);

// 2. Personal Trip Dashboard (Must precede /:id)
router.get('/mine/organized', requireAuth, getMyOrganizedTrips);
router.get('/mine/joined', requireAuth, getMyJoinedTrips);
router.get('/mine/requests', requireAuth, getMyTripRequests);

// 3. Trip Creation
router.post('/', requireAuth, verifyCsrf, createTrip);

// 4. Trip Details (with optional auth to show user membership state)
router.get('/:id', optionalAuth, getTripById);

// 5. Trip Editing & Lifecycle Management
router.patch('/:id', requireAuth, verifyCsrf, updateTrip);
router.post('/:id/publish', requireAuth, verifyCsrf, publishTrip);
router.post('/:id/cancel', requireAuth, verifyCsrf, cancelTrip);

// 6. Join Requests & Membership Operations
router.post('/:id/join', requireAuth, verifyCsrf, joinTrip);
router.get('/:id/requests', requireAuth, getTripRequests);
router.post('/:id/requests/:requestId/approve', requireAuth, verifyCsrf, approveRequest);
router.post('/:id/requests/:requestId/reject', requireAuth, verifyCsrf, rejectRequest);
router.post('/:id/leave', requireAuth, verifyCsrf, leaveTrip);

// 7. Private Trip Room & Chat History Endpoints
router.get('/:tripId/room', requireAuth, getRoomMetadata);
router.get('/:tripId/messages', requireAuth, getMessages);
router.post('/:tripId/messages', requireAuth, verifyCsrf, postMessage);
router.post('/:tripId/messages/:messageId/report', requireAuth, verifyCsrf, reportMessage);

export default router;
