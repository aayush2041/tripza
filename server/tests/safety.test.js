process.env.NODE_ENV = 'test';

import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server');

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as ioClient } from 'socket.io-client';

import app from '../src/app.js';
import { initSockets } from '../src/sockets/index.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { Trip } from '../src/models/Trip.js';
import { TripMembership } from '../src/models/TripMembership.js';
import { TripMessage } from '../src/models/TripMessage.js';
import { Report } from '../src/models/Report.js';
import { Block } from '../src/models/Block.js';
import { Notification } from '../src/models/Notification.js';

let mongoServer;
let httpServer;
let serverPort;
let serverUrl;
let ioServer;

describe('TripZa Safety, Reporting, Notifications & Account Safety Suite', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    httpServer = createServer(app);
    ioServer = initSockets(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    serverPort = httpServer.address().port;
    serverUrl = `http://localhost:${serverPort}`;
  });

  after(async () => {
    if (ioServer) {
      ioServer.close();
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Profile.deleteMany({});
    await Trip.deleteMany({});
    await TripMembership.deleteMany({});
    await TripMessage.deleteMany({});
    await Report.deleteMany({});
    await Block.deleteMany({});
    await Notification.deleteMany({});
  });

  // Helper to register user and obtain agent + CSRF token + user doc
  async function createAuthenticatedUser(email, password = 'Password123!', role = 'traveller', verificationStatus = 'verified') {
    const agent = request.agent(httpServer);

    // Get CSRF token
    const csrfRes = await agent.get('/api/auth/csrf-token');
    const csrfToken = csrfRes.body.data.csrfToken;

    // Register user
    const regRes = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        email,
        password,
        fullName: email.split('@')[0],
      });

    const userId = regRes.body.data.user.id;

    // Update role / verification if needed
    if (role !== 'traveller') {
      await User.findByIdAndUpdate(userId, { role });
    }
    if (verificationStatus !== 'unverified') {
      await Profile.findOneAndUpdate(
        { user: userId },
        {
          'verification.status': verificationStatus,
          verificationStatus,
          fullName: email.split('@')[0],
        }
      );
    }

    const cookieHeader = regRes.headers['set-cookie'];
    return { agent, csrfToken, userId, email, cookieHeader };
  }

  // Helper to create a published trip
  async function createPublishedTrip(organiserAgent, csrfToken, title = 'Spiti Valley Road Trip') {
    const res = await organiserAgent
      .post('/api/trips')
      .set('X-CSRF-Token', csrfToken)
      .send({
        title,
        description: 'Spectacular road trip across Himachal and Spiti Valley with high altitude passes.',
        destination: 'Kaza',
        startingCity: 'Chandigarh',
        meetingPoint: 'ISBT Sector 43',
        startDate: '2027-06-01',
        endDate: '2027-06-10',
        category: 'road trip',
        budget: { amount: 25000, currency: 'INR', included: ['Fuel', 'Homestays'], excluded: ['Gear'] },
        maxGroupSize: 4,
        joinPolicy: 'approval_required',
        status: 'published',
      });
    return res.body.data;
  }

  // ========================================================
  // 1. Centralized Safety Reporting
  // ========================================================
  it('1. Authenticated user can report a user, trip, and message with valid categories', async () => {
    const userA = await createAuthenticatedUser('reporter1@tripza.in');
    const userB = await createAuthenticatedUser('reported1@tripza.in');
    const trip = await createPublishedTrip(userB.agent, userB.csrfToken, 'Unsafe Trek');

    // Create a message in the trip
    const msg = await TripMessage.create({
      trip: trip._id,
      sender: userB.userId,
      message: 'Abusive message text here',
    });

    // Report user
    const repUserRes = await userA.agent
      .post('/api/reports')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({
        targetType: 'user',
        targetId: userB.userId,
        category: 'harassment',
        explanation: 'User sent abusive messages repeatedly.',
      });
    assert.strictEqual(repUserRes.status, 201);
    assert.strictEqual(repUserRes.body.data.targetType, 'user');
    assert.strictEqual(repUserRes.body.data.status, 'open');

    // Report trip
    const repTripRes = await userA.agent
      .post('/api/reports')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({
        targetType: 'trip',
        targetId: trip._id,
        category: 'misleading',
        explanation: 'Inaccurate itinerary and hidden costs.',
      });
    assert.strictEqual(repTripRes.status, 201);
    assert.strictEqual(repTripRes.body.data.targetType, 'trip');

    // Report message
    const repMsgRes = await userA.agent
      .post('/api/reports')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({
        targetType: 'message',
        targetId: msg._id,
        category: 'inappropriate_content',
        explanation: 'Offensive language.',
      });
    assert.strictEqual(repMsgRes.status, 201);
    assert.strictEqual(repMsgRes.body.data.targetType, 'message');

    // Verify message moderation status was flagged
    const updatedMsg = await TripMessage.findById(msg._id);
    assert.strictEqual(updatedMsg.moderation.status, 'reported');
  });

  it('2. Users cannot report themselves, and invalid target IDs or categories are rejected', async () => {
    const user = await createAuthenticatedUser('selfreporter@tripza.in');

    // Cannot report self
    const selfRes = await user.agent
      .post('/api/reports')
      .set('X-CSRF-Token', user.csrfToken)
      .send({
        targetType: 'user',
        targetId: user.userId,
        category: 'spam',
      });
    assert.strictEqual(selfRes.status, 400);
    assert.strictEqual(selfRes.body.error.code, 'CANNOT_REPORT_SELF');

    // Invalid category
    const badCatRes = await user.agent
      .post('/api/reports')
      .set('X-CSRF-Token', user.csrfToken)
      .send({
        targetType: 'user',
        targetId: new mongoose.Types.ObjectId(),
        category: 'unknown_category_xyz',
      });
    assert.strictEqual(badCatRes.status, 400);
    assert.strictEqual(badCatRes.body.error.code, 'INVALID_CATEGORY');

    // Nonexistent target
    const notFoundRes = await user.agent
      .post('/api/reports')
      .set('X-CSRF-Token', user.csrfToken)
      .send({
        targetType: 'trip',
        targetId: new mongoose.Types.ObjectId(),
        category: 'misleading',
      });
    assert.strictEqual(notFoundRes.status, 404);
    assert.strictEqual(notFoundRes.body.error.code, 'TARGET_NOT_FOUND');
  });

  it('3. Duplicate open reports from the same user for the same target are prevented', async () => {
    const userA = await createAuthenticatedUser('reporter3@tripza.in');
    const userB = await createAuthenticatedUser('target3@tripza.in');

    const firstRes = await userA.agent
      .post('/api/reports')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({
        targetType: 'user',
        targetId: userB.userId,
        category: 'spam',
        explanation: 'First report.',
      });
    assert.strictEqual(firstRes.status, 201);

    // Second attempt should be rejected with 409 Conflict
    const dupRes = await userA.agent
      .post('/api/reports')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({
        targetType: 'user',
        targetId: userB.userId,
        category: 'spam',
        explanation: 'Duplicate report.',
      });
    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.error.code, 'DUPLICATE_REPORT');
  });

  it('4. Ordinary users cannot access admin moderation queue; admins can inspect and resolve reports', async () => {
    const userA = await createAuthenticatedUser('ordinary@tripza.in');
    const admin = await createAuthenticatedUser('admin@tripza.in', 'AdminPass123!', 'admin');
    const badActor = await createAuthenticatedUser('badactor@tripza.in');

    // User submits report
    const repRes = await userA.agent
      .post('/api/reports')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({
        targetType: 'user',
        targetId: badActor.userId,
        category: 'unsafe_conduct',
        explanation: 'Threatening conduct.',
      });
    const reportId = repRes.body.data._id;

    // Ordinary user tries to access admin reports -> 403 Forbidden
    const unauthRes = await userA.agent.get('/api/admin/reports');
    assert.strictEqual(unauthRes.status, 403);

    // Admin accesses queue -> 200 OK
    const adminRes = await admin.agent.get('/api/admin/reports');
    assert.strictEqual(adminRes.status, 200);
    assert.ok(adminRes.body.data.reports.length >= 1);

    // Admin resolves report with suspension
    const resolveRes = await admin.agent
      .patch(`/api/admin/reports/${reportId}`)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({
        status: 'action_taken',
        resolutionAction: 'user_suspended',
        moderatorNotes: 'Verified threat in logs. Suspended immediately.',
      });
    assert.strictEqual(resolveRes.status, 200);
    assert.strictEqual(resolveRes.body.data.status, 'action_taken');
    assert.strictEqual(resolveRes.body.data.resolutionAction, 'user_suspended');

    // Verify badActor user was suspended
    const updatedActor = await User.findById(badActor.userId);
    assert.strictEqual(updatedActor.accountStatus, 'suspended');

    // Suspended user cannot log in or use protected routes
    const suspendedLoginRes = await badActor.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', badActor.csrfToken)
      .send({ email: badActor.email, password: 'Password123!' });
    assert.strictEqual(suspendedLoginRes.status, 403);
    assert.strictEqual(suspendedLoginRes.body.error.code, 'ACCOUNT_SUSPENDED');
  });

  it('5. Message removal via moderation masks text and marks status removed in room history', async () => {
    const host = await createAuthenticatedUser('host5@tripza.in');
    const admin = await createAuthenticatedUser('admin5@tripza.in', 'AdminPass123!', 'admin');
    const trip = await createPublishedTrip(host.agent, host.csrfToken, 'Rohtang Pass Trek');

    const message = await TripMessage.create({
      trip: trip._id,
      sender: host.userId,
      message: 'Sensitive or offensive content to be removed',
    });

    // Admin moderates message directly
    const modRes = await admin.agent
      .patch(`/api/admin/messages/${message._id}/moderate`)
      .set('X-CSRF-Token', admin.csrfToken)
      .send({ action: 'remove' });
    assert.strictEqual(modRes.status, 200);

    // Fetch messages from room endpoint as host -> text is masked
    const roomMsgRes = await host.agent.get(`/api/trips/${trip._id}/messages`);
    assert.strictEqual(roomMsgRes.status, 200);
    const retrievedMsg = roomMsgRes.body.data.messages.find((m) => m._id.toString() === message._id.toString());
    assert.ok(retrievedMsg.message.includes('removed by moderation'));
    assert.strictEqual(retrievedMsg.isDeleted, true);
  });

  // ========================================================
  // 2. Blocking & Account Safety
  // ========================================================
  it('6. User can block and unblock another user; self-blocking and duplicate blocking are rejected', async () => {
    const userA = await createAuthenticatedUser('blocker6@tripza.in');
    const userB = await createAuthenticatedUser('blocked6@tripza.in');

    // Cannot block self
    const selfRes = await userA.agent
      .post('/api/blocks')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ blockedUserId: userA.userId });
    assert.strictEqual(selfRes.status, 400);
    assert.strictEqual(selfRes.body.error.code, 'CANNOT_BLOCK_SELF');

    // Block userB
    const blockRes = await userA.agent
      .post('/api/blocks')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ blockedUserId: userB.userId, reason: 'Unsolicited spam messages.' });
    assert.strictEqual(blockRes.status, 201);

    // Retrieve blocked list
    const listRes = await userA.agent.get('/api/blocks');
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.data.blockedUsers.length, 1);
    assert.strictEqual(listRes.body.data.blockedUsers[0].blockedUser._id.toString(), userB.userId.toString());

    // Duplicate block returns cleanly or existing
    const dupRes = await userA.agent
      .post('/api/blocks')
      .set('X-CSRF-Token', userA.csrfToken)
      .send({ blockedUserId: userB.userId });
    assert.strictEqual(dupRes.status, 201); // Safe idempotency

    // Unblock userB
    const unblockRes = await userA.agent
      .delete(`/api/blocks/${userB.userId}`)
      .set('X-CSRF-Token', userA.csrfToken);
    assert.strictEqual(unblockRes.status, 200);

    const afterListRes = await userA.agent.get('/api/blocks');
    assert.strictEqual(afterListRes.body.data.blockedUsers.length, 0);
  });

  it('7. Blocked relationship prevents new trip join requests between the two users', async () => {
    const host = await createAuthenticatedUser('blockhost7@tripza.in');
    const traveller = await createAuthenticatedUser('blocktraveller7@tripza.in');
    const trip = await createPublishedTrip(host.agent, host.csrfToken, 'Ladakh Motorcycle Expedition');

    // Host blocks traveller
    await host.agent
      .post('/api/blocks')
      .set('X-CSRF-Token', host.csrfToken)
      .send({ blockedUserId: traveller.userId, reason: 'Incompatible travel style.' });

    // Traveller tries to join trip hosted by host -> blocked with 403
    const joinRes = await traveller.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'Can I join your ride?' });
    assert.strictEqual(joinRes.status, 403);
    assert.strictEqual(joinRes.body.error.code, 'BLOCKED_INTERACTION');

    // Host unblocks traveller
    await host.agent
      .delete(`/api/blocks/${traveller.userId}`)
      .set('X-CSRF-Token', host.csrfToken);

    // Now traveller can join
    const joinAfterRes = await traveller.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'Can I join now?' });
    assert.strictEqual(joinAfterRes.status, 201);
  });

  // ========================================================
  // 3. Notifications System
  // ========================================================
  it('8. In-app notifications are generated for join requests, approvals, rejections, trip edits, and member leave', async () => {
    const host = await createAuthenticatedUser('notifhost8@tripza.in');
    const traveller = await createAuthenticatedUser('notiftraveller8@tripza.in');
    const trip = await createPublishedTrip(host.agent, host.csrfToken, 'Gokarna Beach Camping');

    // 1. Join request submitted -> host receives join_request_received notification
    const joinRes = await traveller.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'Looking forward to beach camping!' });
    const requestId = joinRes.body.data.membership._id;

    const hostNotifs1 = await host.agent.get('/api/notifications');
    assert.strictEqual(hostNotifs1.status, 200);
    const joinNotif = hostNotifs1.body.data.notifications.find((n) => n.type === 'join_request_received');
    assert.ok(joinNotif);
    assert.strictEqual(joinNotif.read, false);

    // 2. Host approves request -> traveller receives request_approved notification
    await host.agent
      .post(`/api/trips/${trip._id}/requests/${requestId}/approve`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ reason: 'Welcome to the group!' });

    const travNotifs1 = await traveller.agent.get('/api/notifications');
    const approvedNotif = travNotifs1.body.data.notifications.find((n) => n.type === 'request_approved');
    assert.ok(approvedNotif);

    // 3. Host updates published trip -> approved traveller receives trip_updated notification
    await host.agent
      .patch(`/api/trips/${trip._id}`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ description: 'Updated itinerary: Added sunset boat ride in Gokarna!' });

    const travNotifs2 = await traveller.agent.get('/api/notifications');
    const updatedNotif = travNotifs2.body.data.notifications.find((n) => n.type === 'trip_updated');
    assert.ok(updatedNotif);

    // 4. Approved member leaves trip -> host receives member_left notification
    await traveller.agent
      .post(`/api/trips/${trip._id}/leave`)
      .set('X-CSRF-Token', traveller.csrfToken);

    const hostNotifs2 = await host.agent.get('/api/notifications');
    const leaveNotif = hostNotifs2.body.data.notifications.find((n) => n.type === 'member_left');
    assert.ok(leaveNotif);
  });

  it('9. Users can only access and mark their own notifications as read; bulk mark-all-read updates unread counts', async () => {
    const userA = await createAuthenticatedUser('user9a@tripza.in');
    const userB = await createAuthenticatedUser('user9b@tripza.in');

    const notifA = await Notification.create({
      recipient: userA.userId,
      type: 'moderation_notice',
      title: 'Notice for User A',
      message: 'Private notice for user A only.',
    });

    // User B tries to mark User A's notification as read -> 404 Not Found (ownership check)
    const badMarkRes = await userB.agent
      .patch(`/api/notifications/${notifA._id}/read`)
      .set('X-CSRF-Token', userB.csrfToken);
    assert.strictEqual(badMarkRes.status, 404);

    // User A checks unread count -> 1
    const countRes = await userA.agent.get('/api/notifications/unread-count');
    assert.strictEqual(countRes.status, 200);
    assert.strictEqual(countRes.body.data.unreadCount, 1);

    // User A marks single notification as read -> 200
    const markRes = await userA.agent
      .patch(`/api/notifications/${notifA._id}/read`)
      .set('X-CSRF-Token', userA.csrfToken);
    assert.strictEqual(markRes.status, 200);
    assert.strictEqual(markRes.body.data.read, true);

    // Check count is now 0
    const countAfter = await userA.agent.get('/api/notifications/unread-count');
    assert.strictEqual(countAfter.body.data.unreadCount, 0);

    // Create 2 more unread notifications
    await Notification.create({ recipient: userA.userId, type: 'moderation_notice', title: 'N1', message: 'M1' });
    await Notification.create({ recipient: userA.userId, type: 'moderation_notice', title: 'N2', message: 'M2' });

    const bulkRes = await userA.agent
      .patch('/api/notifications/read-all')
      .set('X-CSRF-Token', userA.csrfToken);
    assert.strictEqual(bulkRes.status, 200);

    const finalCount = await userA.agent.get('/api/notifications/unread-count');
    assert.strictEqual(finalCount.body.data.unreadCount, 0);
  });

  // ========================================================
  // 4. Socket Disconnection for Suspended Accounts
  // ========================================================
  it('10. Suspended user cannot connect or send messages via Socket.IO', async () => {
    const host = await createAuthenticatedUser('activehost10@tripza.in');
    const trip = await createPublishedTrip(host.agent, host.csrfToken, 'Meghalaya Caving Tour');

    const suspendedUser = await createAuthenticatedUser('suspended10@tripza.in');
    await User.findByIdAndUpdate(suspendedUser.userId, { accountStatus: 'suspended' });

    const cookieStr = suspendedUser.cookieHeader
      ? suspendedUser.cookieHeader.map((c) => c.split(';')[0]).join('; ')
      : '';

    // Attempt Socket connection with suspended session cookie
    const socket = ioClient(serverUrl, {
      extraHeaders: {
        cookie: cookieStr,
      },
      reconnection: false,
      timeout: 2000,
    });

    const connectError = await new Promise((resolve) => {
      socket.on('connect_error', (err) => resolve(err.message));
      socket.on('connect', () => resolve('connected_unexpectedly'));
    });

    socket.close();
    assert.ok(
      connectError === 'ACCOUNT_INACTIVE' || connectError === 'AUTHENTICATION_REQUIRED' || connectError.includes('ACCOUNT'),
      `Expected account inactive or auth error, got: ${connectError}`
    );
  });

  // ========================================================
  // 5. Room Message Reporting Centralized Integration
  // ========================================================
  it('11. Message reported in Trip Room reaches the centralized Report collection', async () => {
    const host = await createAuthenticatedUser('roomhost11@tripza.in');
    const member = await createAuthenticatedUser('roommember11@tripza.in');
    const trip = await createPublishedTrip(host.agent, host.csrfToken, 'Kasol & Kheerganga Trek');

    // Directly approve member
    await TripMembership.create({
      trip: trip._id,
      traveller: member.userId,
      status: 'approved',
    });

    const message = await TripMessage.create({
      trip: trip._id,
      sender: host.userId,
      message: 'Suspicious commercial advertisement message',
    });

    // Member reports message via room endpoint
    const repRes = await member.agent
      .post(`/api/trips/${trip._id}/messages/${message._id}/report`)
      .set('X-CSRF-Token', member.csrfToken)
      .send({ reason: 'Commercial spam promotion' });
    assert.strictEqual(repRes.status, 200);

    // Verify report exists in centralized Report model
    const centralizedReport = await Report.findOne({
      targetType: 'message',
      targetId: message._id,
      reporter: member.userId,
    });
    assert.ok(centralizedReport, 'Expected report in centralized Report collection');
    assert.strictEqual(centralizedReport.category, 'inappropriate_content');
    assert.strictEqual(centralizedReport.status, 'open');
  });
});
