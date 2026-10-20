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

let mongoServer;
let httpServer;
let serverPort;
let serverUrl;
let ioServer;

describe('TripZa Private Trip Rooms & Real-Time Group Chat Suite', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create real HTTP server and bind Socket.IO for integration tests
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
  });

  async function getCsrfTokenAndCookie(agent) {
    const res = await agent.get('/api/auth/csrf-token').expect(200);
    return res.body.data.csrfToken;
  }

  // Helper to create and authenticate a user with specific verification status
  async function createAuthUser(email, verificationStatus = 'verified') {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    const regRes = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: `User ${email.split('@')[0]}`,
        email,
        password: 'Password123!',
      })
      .expect(201);

    const userId = regRes.body.data.user.id;

    if (verificationStatus === 'verified') {
      await Profile.findOneAndUpdate(
        { user: userId },
        { 'verification.status': 'verified', 'verification.reviewedAt': new Date() }
      );
    }

    // Extract cookie string for Socket.IO handshake
    const cookieHeader = regRes.headers['set-cookie']
      ? regRes.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ')
      : '';

    return { agent, userId, email, csrfToken, cookieHeader };
  }

  // Helper to create a published trip
  async function createTestTrip(hostUser, overrides = {}) {
    const res = await hostUser.agent
      .post('/api/trips')
      .set('X-CSRF-Token', hostUser.csrfToken)
      .send({
        title: 'Spiti Valley Group Expedition',
        description: 'Exploring High Himalaya mountain passes and remote monasteries.',
        category: 'road trip',
        startingCity: 'Chandigarh',
        meetingPoint: 'ISBT Sector 43',
        destination: 'Kaza',
        startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 12).toISOString(),
        budget: { amount: 15000, currency: 'INR', included: ['Fuel'], excluded: ['Gear'] },
        maxGroupSize: 5,
        joinPolicy: 'approval_required',
        status: 'published',
        ...overrides,
      })
      .expect(201);

    return res.body.data;
  }

  it('1. Organiser can access their trip room metadata and message history', async () => {
    const host = await createAuthUser('host1@tripza.in');
    const trip = await createTestTrip(host);

    // Organiser accesses room metadata
    const roomRes = await host.agent
      .get(`/api/trips/${trip._id}/room`)
      .expect(200);

    assert.strictEqual(roomRes.body.status, 'success');
    assert.strictEqual(roomRes.body.data.room.title, 'Spiti Valley Group Expedition');
    assert.strictEqual(roomRes.body.data.room.userRole, 'organiser');
    assert.strictEqual(roomRes.body.data.room.organiser.email, host.email);

    // Organiser accesses messages
    const msgRes = await host.agent
      .get(`/api/trips/${trip._id}/messages`)
      .expect(200);

    assert.strictEqual(msgRes.body.status, 'success');
    assert.ok(Array.isArray(msgRes.body.data.messages));
  });

  it('2. Approved member can access the trip room', async () => {
    const host = await createAuthUser('host2@tripza.in');
    const member = await createAuthUser('member2@tripza.in');
    const trip = await createTestTrip(host);

    // Member joins (requires approval)
    await member.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', member.csrfToken)
      .send({ message: 'Excited to join!' })
      .expect(201);

    // Host approves member
    const reqs = await host.agent.get(`/api/trips/${trip._id}/requests`).expect(200);
    const requestId = reqs.body.data.requests[0]._id;

    await host.agent
      .post(`/api/trips/${trip._id}/requests/${requestId}/approve`)
      .set('X-CSRF-Token', host.csrfToken)
      .expect(200);

    // Approved member now accesses room
    const roomRes = await member.agent
      .get(`/api/trips/${trip._id}/room`)
      .expect(200);

    assert.strictEqual(roomRes.body.status, 'success');
    assert.strictEqual(roomRes.body.data.room.userRole, 'member');
  });

  it('3. Pending applicant cannot access the trip room (blocked with 403)', async () => {
    const host = await createAuthUser('host3@tripza.in');
    const applicant = await createAuthUser('applicant3@tripza.in');
    const trip = await createTestTrip(host);

    // Applicant joins (status is pending)
    await applicant.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', applicant.csrfToken)
      .send({ message: 'Requesting to join' })
      .expect(201);

    // Attempt to access room metadata -> 403 Forbidden
    const roomRes = await applicant.agent
      .get(`/api/trips/${trip._id}/room`)
      .expect(403);

    assert.strictEqual(roomRes.body.status, 'fail');
    assert.strictEqual(roomRes.body.error.code, 'ROOM_ACCESS_DENIED');

    // Attempt to retrieve messages -> 403 Forbidden
    await applicant.agent
      .get(`/api/trips/${trip._id}/messages`)
      .expect(403);
  });

  it('4. Non-member cannot retrieve room metadata or message history', async () => {
    const host = await createAuthUser('host4@tripza.in');
    const outsider = await createAuthUser('outsider4@tripza.in');
    const trip = await createTestTrip(host);

    await outsider.agent
      .get(`/api/trips/${trip._id}/room`)
      .expect(403);

    await outsider.agent
      .get(`/api/trips/${trip._id}/messages`)
      .expect(403);
  });

  it('5. Unauthenticated Socket.IO connection is rejected', async () => {
    let connectionError = null;

    const socket = ioClient(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
    });

    await new Promise((resolve) => {
      socket.on('connect_error', (err) => {
        connectionError = err;
        socket.disconnect();
        resolve();
      });
      socket.on('connect', () => {
        socket.disconnect();
        resolve();
      });
    });

    assert.ok(connectionError, 'Unauthenticated socket should fail to connect');
    assert.match(connectionError.message, /AUTHENTICATION_REQUIRED/i);
  });

  it('6. Unauthorized socket cannot join a trip room', async () => {
    const host = await createAuthUser('host6@tripza.in');
    const outsider = await createAuthUser('outsider6@tripza.in');
    const trip = await createTestTrip(host);

    // Connect outsider socket with valid session cookie
    const socket = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: {
        cookie: outsider.cookieHeader,
      },
      reconnection: false,
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    // Attempt to join room
    let joinResponse = null;
    await new Promise((resolve) => {
      socket.emit('trip-room:join', { tripId: trip._id.toString() }, (res) => {
        joinResponse = res;
        resolve();
      });
    });

    assert.strictEqual(joinResponse?.status, 'fail');
    assert.strictEqual(joinResponse?.error?.code, 'ROOM_ACCESS_DENIED');

    socket.disconnect();
  });

  it('7. Authorized member can send and receive a persisted message via Socket.IO', async () => {
    const host = await createAuthUser('host7@tripza.in');
    const member = await createAuthUser('member7@tripza.in');
    const trip = await createTestTrip(host, { joinPolicy: 'direct_join' });

    // Member direct-joins
    await member.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', member.csrfToken)
      .expect(201);

    // Connect both sockets
    const hostSocket = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: host.cookieHeader },
      reconnection: false,
    });
    const memberSocket = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: member.cookieHeader },
      reconnection: false,
    });

    await Promise.all([
      new Promise((r) => hostSocket.on('connect', r)),
      new Promise((r) => memberSocket.on('connect', r)),
    ]);

    // Both join the room
    await new Promise((r) => hostSocket.emit('trip-room:join', { tripId: trip._id.toString() }, r));
    await new Promise((r) => memberSocket.emit('trip-room:join', { tripId: trip._id.toString() }, r));

    // Member sends message; Host listens for real-time broadcast
    let receivedMessage = null;
    hostSocket.on('trip-room:message:new', (payload) => {
      receivedMessage = payload.message;
    });

    let sendAck = null;
    await new Promise((resolve) => {
      memberSocket.emit(
        'trip-room:message',
        { tripId: trip._id.toString(), text: 'Hello companions! Ready with my trekking gear.' },
        (ack) => {
          sendAck = ack;
          resolve();
        }
      );
    });

    assert.strictEqual(sendAck?.status, 'success');
    assert.strictEqual(sendAck?.data?.message?.message, 'Hello companions! Ready with my trekking gear.');

    // Wait briefly for broadcast
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(receivedMessage);
    assert.strictEqual(receivedMessage.message, 'Hello companions! Ready with my trekking gear.');
    assert.strictEqual(receivedMessage.sender.email, member.email);

    // Verify persisted in MongoDB
    const dbMsg = await TripMessage.findById(receivedMessage._id);
    assert.ok(dbMsg);
    assert.strictEqual(dbMsg.message, 'Hello companions! Ready with my trekking gear.');

    hostSocket.disconnect();
    memberSocket.disconnect();
  });

  it('8. Client cannot impersonate another sender (sender ID is server-enforced)', async () => {
    const host = await createAuthUser('host8@tripza.in');
    const member = await createAuthUser('member8@tripza.in');
    const trip = await createTestTrip(host, { joinPolicy: 'direct_join' });

    await member.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', member.csrfToken)
      .expect(201);

    const memberSocket = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: member.cookieHeader },
      reconnection: false,
    });
    await new Promise((r) => memberSocket.on('connect', r));
    await new Promise((r) => memberSocket.emit('trip-room:join', { tripId: trip._id.toString() }, r));

    // Member attempts to forge sender as host._id in payload
    let sendAck = null;
    await new Promise((resolve) => {
      memberSocket.emit(
        'trip-room:message',
        {
          tripId: trip._id.toString(),
          sender: host.userId, // Fake sender ID
          text: 'Trying to impersonate host',
        },
        (ack) => {
          sendAck = ack;
          resolve();
        }
      );
    });

    assert.strictEqual(sendAck?.status, 'success');
    // Actual sender in response and database MUST be member's userId, ignoring forged sender field
    assert.strictEqual(sendAck?.data?.message?.sender?._id.toString(), member.userId.toString());

    memberSocket.disconnect();
  });

  it('9. Message length and rate limits are enforced', async () => {
    const host = await createAuthUser('host9@tripza.in');
    const trip = await createTestTrip(host);

    const hostSocket = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: host.cookieHeader },
      reconnection: false,
    });
    await new Promise((r) => hostSocket.on('connect', r));
    await new Promise((r) => hostSocket.emit('trip-room:join', { tripId: trip._id.toString() }, r));

    // Empty message
    let emptyAck = null;
    await new Promise((resolve) => {
      hostSocket.emit('trip-room:message', { tripId: trip._id.toString(), text: '   ' }, (ack) => {
        emptyAck = ack;
        resolve();
      });
    });
    assert.strictEqual(emptyAck?.status, 'fail');
    assert.strictEqual(emptyAck?.error?.code, 'INVALID_MESSAGE');

    // Message exceeding 2000 chars
    const giantText = 'A'.repeat(2001);
    let giantAck = null;
    await new Promise((resolve) => {
      hostSocket.emit('trip-room:message', { tripId: trip._id.toString(), text: giantText }, (ack) => {
        giantAck = ack;
        resolve();
      });
    });
    assert.strictEqual(giantAck?.status, 'fail');
    assert.strictEqual(giantAck?.error?.code, 'INVALID_MESSAGE');

    // Rate limit: send 6 rapid messages
    let rateLimitTriggered = false;
    for (let i = 0; i < 6; i++) {
      const ack = await new Promise((resolve) => {
        hostSocket.emit('trip-room:message', { tripId: trip._id.toString(), text: `Fast msg ${i}` }, resolve);
      });
      if (ack?.error?.code === 'RATE_LIMIT_EXCEEDED') {
        rateLimitTriggered = true;
        break;
      }
    }
    assert.ok(rateLimitTriggered, 'Rate limit should be triggered upon rapid message spam');

    hostSocket.disconnect();
  });

  it('10. Messages from one trip are not broadcast to another trip', async () => {
    const hostA = await createAuthUser('hostA@tripza.in');
    const hostB = await createAuthUser('hostB@tripza.in');

    const tripA = await createTestTrip(hostA, { title: 'Trip Alpha' });
    const tripB = await createTestTrip(hostB, { title: 'Trip Beta' });

    const socketA = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostA.cookieHeader },
      reconnection: false,
    });
    const socketB = ioClient(serverUrl, {
      transports: ['websocket'],
      extraHeaders: { cookie: hostB.cookieHeader },
      reconnection: false,
    });

    await Promise.all([
      new Promise((r) => socketA.on('connect', r)),
      new Promise((r) => socketB.on('connect', r)),
    ]);

    await new Promise((r) => socketA.emit('trip-room:join', { tripId: tripA._id.toString() }, r));
    await new Promise((r) => socketB.emit('trip-room:join', { tripId: tripB._id.toString() }, r));

    let socketBReceivedMessage = null;
    socketB.on('trip-room:message:new', (payload) => {
      socketBReceivedMessage = payload.message;
    });

    // Send in Trip A
    await new Promise((resolve) => {
      socketA.emit('trip-room:message', { tripId: tripA._id.toString(), text: 'Confidential to Trip A' }, resolve);
    });

    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(socketBReceivedMessage, null, 'Socket in Trip B should not receive messages from Trip A');

    socketA.disconnect();
    socketB.disconnect();
  });

  it('11. Removed or withdrawn members lose room access', async () => {
    const host = await createAuthUser('host11@tripza.in');
    const member = await createAuthUser('member11@tripza.in');
    const trip = await createTestTrip(host, { joinPolicy: 'direct_join' });

    // Join
    await member.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', member.csrfToken)
      .expect(201);

    // Room access initially works
    await member.agent.get(`/api/trips/${trip._id}/room`).expect(200);

    // Member leaves/withdraws
    await member.agent
      .post(`/api/trips/${trip._id}/leave`)
      .set('X-CSRF-Token', member.csrfToken)
      .expect(200);

    // Subsequent room access is immediately denied with 403
    await member.agent.get(`/api/trips/${trip._id}/room`).expect(403);
    await member.agent.get(`/api/trips/${trip._id}/messages`).expect(403);
  });

  it('12. Cancelled-trip room behavior follows documented read-only policy', async () => {
    const host = await createAuthUser('host12@tripza.in');
    const member = await createAuthUser('member12@tripza.in');
    const trip = await createTestTrip(host, { joinPolicy: 'direct_join' });

    await member.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', member.csrfToken)
      .expect(201);

    // Post an initial message while active
    await host.agent
      .post(`/api/trips/${trip._id}/messages`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ message: 'Welcome before cancellation' })
      .expect(201);

    // Host cancels trip
    await host.agent
      .post(`/api/trips/${trip._id}/cancel`)
      .set('X-CSRF-Token', host.csrfToken)
      .expect(200);

    // Room metadata still accessible to confirmed member, marked as archived
    const roomRes = await member.agent.get(`/api/trips/${trip._id}/room`).expect(200);
    assert.strictEqual(roomRes.body.data.room.isArchived, true);
    assert.strictEqual(roomRes.body.data.room.tripStatus, 'cancelled');

    // Message history is still readable in read-only mode
    const msgRes = await member.agent.get(`/api/trips/${trip._id}/messages`).expect(200);
    assert.strictEqual(msgRes.body.data.messages.length, 1);

    // Sending a new message via HTTP is blocked with TRIP_CANCELLED
    const sendRes = await member.agent
      .post(`/api/trips/${trip._id}/messages`)
      .set('X-CSRF-Token', member.csrfToken)
      .send({ message: 'Trying to post to cancelled trip' })
      .expect(400);

    assert.strictEqual(sendRes.body.error.code, 'TRIP_CANCELLED');
  });

  it('13. Message history pagination is stable and cursor-based', async () => {
    const host = await createAuthUser('host13@tripza.in');
    const trip = await createTestTrip(host);

    // Insert 5 sequential messages
    for (let i = 1; i <= 5; i++) {
      await host.agent
        .post(`/api/trips/${trip._id}/messages`)
        .set('X-CSRF-Token', host.csrfToken)
        .send({ message: `Message number ${i}` })
        .expect(201);
    }

    // Page 1: Limit 3
    const page1 = await host.agent
      .get(`/api/trips/${trip._id}/messages?limit=3`)
      .expect(200);

    assert.strictEqual(page1.body.data.messages.length, 3);
    assert.strictEqual(page1.body.data.hasMore, true);
    assert.ok(page1.body.data.nextCursor);

    // Page 2: Before nextCursor
    const page2 = await host.agent
      .get(`/api/trips/${trip._id}/messages?limit=3&before=${page1.body.data.nextCursor}`)
      .expect(200);

    assert.strictEqual(page2.body.data.messages.length, 2);
    assert.strictEqual(page2.body.data.hasMore, false);
  });
});
