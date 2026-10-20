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

import app from '../src/app.js';
import { initSockets } from '../src/sockets/index.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { Trip } from '../src/models/Trip.js';
import { TripMembership } from '../src/models/TripMembership.js';
import { Notification } from '../src/models/Notification.js';

let mongoServer;
let httpServer;
let serverPort;
let serverUrl;
let ioServer;

describe('TripZa Audit & Regression Suite (Prompt 6)', () => {
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
    await Notification.deleteMany({});
  });

  async function createAuthenticatedUser(email, fullName = 'Test Traveller', role = 'traveller') {
    const agent = request.agent(httpServer);
    const csrfRes = await agent.get('/api/auth/csrf-token');
    const csrfToken = csrfRes.body.data.csrfToken;

    const regRes = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        email,
        password: 'Password123!',
        fullName,
      });

    assert.strictEqual(regRes.status, 201);
    const user = regRes.body.data.user;

    if (role === 'admin') {
      await User.findByIdAndUpdate(user.id, { role: 'admin' });
      user.role = 'admin';
    }

    return {
      agent,
      user,
      profile: regRes.body.data.profile,
      csrfToken,
    };
  }

  async function createPublishedTrip(organiser) {
    await Profile.findOneAndUpdate(
      { user: organiser.user.id },
      { 'verification.status': 'verified' }
    );

    const tripRes = await organiser.agent
      .post('/api/trips')
      .set('X-CSRF-Token', organiser.csrfToken)
      .send({
        title: 'Manali High Altitude Trek',
        description: 'An adventurous trek across Solang Valley and Rohtang.',
        startingCity: 'Manali',
        meetingPoint: 'Mall Road Fountain',
        destination: 'Rohtang Pass',
        startDate: '2026-11-01',
        endDate: '2026-11-10',
        category: 'trekking',
        budget: { amount: 12000, included: ['Guide'], excluded: ['Flights'] },
        maxGroupSize: 5,
        joinPolicy: 'approval_required',
        status: 'published',
      });

    assert.strictEqual(tripRes.status, 201);
    return tripRes.body.data;
  }

  it('1. Strict CSRF origin check prevents attacker domain with shared prefix', async () => {
    const user = await createAuthenticatedUser('csrf_victim@tripza.in');

    // Attempting state-changing request from attacker domain starting with http://localhost:5173
    const attackRes = await user.agent
      .post('/api/trips')
      .set('Origin', 'http://localhost:5173.attacker.evil')
      .set('X-CSRF-Token', user.csrfToken)
      .send({ title: 'Malicious Trip' });

    assert.strictEqual(attackRes.status, 403);
    assert.strictEqual(attackRes.body.error.code, 'ORIGIN_FORBIDDEN');
  });

  it('2. GET /api/trips/:id returns isOrganiser true for host and false for non-host', async () => {
    const host = await createAuthenticatedUser('host_test@tripza.in', 'Host User');
    const guest = await createAuthenticatedUser('guest_test@tripza.in', 'Guest User');
    const trip = await createPublishedTrip(host);

    // Host inspects their own trip
    const hostRes = await host.agent.get(`/api/trips/${trip._id}`);
    assert.strictEqual(hostRes.status, 200);
    assert.strictEqual(hostRes.body.data.isOrganiser, true);

    // Guest inspects the trip
    const guestRes = await guest.agent.get(`/api/trips/${trip._id}`);
    assert.strictEqual(guestRes.status, 200);
    assert.strictEqual(guestRes.body.data.isOrganiser, false);

    // Anonymous inspects the trip
    const anonRes = await request(httpServer).get(`/api/trips/${trip._id}`);
    assert.strictEqual(anonRes.status, 200);
    assert.strictEqual(anonRes.body.data.isOrganiser, false);
  });

  it('3. Single-date trip update cannot invert date range (endDate < startDate)', async () => {
    const host = await createAuthenticatedUser('date_host@tripza.in', 'Date Host');
    const trip = await createPublishedTrip(host); // startDate: 2026-11-01, endDate: 2026-11-10

    // Attempt to update startDate to 2026-11-15 without passing endDate
    const invalidUpdateRes = await host.agent
      .patch(`/api/trips/${trip._id}`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ startDate: '2026-11-15' });

    assert.strictEqual(invalidUpdateRes.status, 400);
    assert.strictEqual(invalidUpdateRes.body.error.code, 'INVALID_DATES');

    // Valid update updating both dates
    const validUpdateRes = await host.agent
      .patch(`/api/trips/${trip._id}`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ startDate: '2026-11-15', endDate: '2026-11-20' });

    assert.strictEqual(validUpdateRes.status, 200);
    assert.strictEqual(validUpdateRes.body.data.startDate.slice(0, 10), '2026-11-15');
  });

  it('4. Itinerary items map both description and activities seamlessly', async () => {
    const host = await createAuthenticatedUser('itin_host@tripza.in', 'Itin Host');
    await Profile.findOneAndUpdate(
      { user: host.user.id },
      { 'verification.status': 'verified' }
    );

    const tripRes = await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Goa Coastal Exploration',
        description: 'Explore North and South Goa beaches.',
        startingCity: 'Panaji',
        meetingPoint: 'Panaji Bus Stand',
        destination: 'Palolem Beach',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        category: 'sightseeing',
        budget: { amount: 8000 },
        maxGroupSize: 4,
        status: 'published',
        itinerary: [
          { day: 1, title: 'Arrival', description: 'Arrive in Panaji and check in' },
          { day: 2, title: 'Old Goa', activities: 'Visit churches and heritage quarters' },
        ],
      });

    assert.strictEqual(tripRes.status, 201);
    const created = tripRes.body.data;
    assert.strictEqual(created.itinerary.length, 2);
    assert.strictEqual(created.itinerary[0].description, 'Arrive in Panaji and check in');
    assert.strictEqual(created.itinerary[0].activities, 'Arrive in Panaji and check in');
    assert.strictEqual(created.itinerary[1].activities, 'Visit churches and heritage quarters');
  });

  it('5. Rejecting an already rejected request returns 400 ALREADY_REJECTED', async () => {
    const host = await createAuthenticatedUser('rej_host@tripza.in', 'Reject Host');
    const applicant = await createAuthenticatedUser('rej_app@tripza.in', 'Applicant');
    const trip = await createPublishedTrip(host);

    // Apply
    const joinRes = await applicant.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', applicant.csrfToken)
      .send({ message: 'Can I join?' });
    assert.strictEqual(joinRes.status, 201);
    const reqId = joinRes.body.data.membership._id;

    // Reject first time
    const rej1 = await host.agent
      .post(`/api/trips/${trip._id}/requests/${reqId}/reject`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ reason: 'Trip full' });
    assert.strictEqual(rej1.status, 200);

    // Reject second time
    const rej2 = await host.agent
      .post(`/api/trips/${trip._id}/requests/${reqId}/reject`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ reason: 'Trip full' });
    assert.strictEqual(rej2.status, 400);
    assert.strictEqual(rej2.body.error.code, 'ALREADY_REJECTED');
  });

  it('6. Host rejecting an approved member decrements capacity safely and evicts socket', async () => {
    const host = await createAuthenticatedUser('evict_host@tripza.in', 'Evict Host');
    const member = await createAuthenticatedUser('evict_mem@tripza.in', 'Evict Member');
    const trip = await createPublishedTrip(host);

    // Member joins
    const joinRes = await member.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', member.csrfToken)
      .send({ message: 'Excited to join' });
    const reqId = joinRes.body.data.membership._id;

    // Host approves
    const appRes = await host.agent
      .post(`/api/trips/${trip._id}/requests/${reqId}/approve`)
      .set('X-CSRF-Token', host.csrfToken)
      .send();
    assert.strictEqual(appRes.status, 200);
    assert.strictEqual(appRes.body.data.tripApprovedCount, 1);

    // Host now revokes/rejects the approved member
    const rejRes = await host.agent
      .post(`/api/trips/${trip._id}/requests/${reqId}/reject`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ reason: 'Member violated group conduct rules' });
    assert.strictEqual(rejRes.status, 200);

    // Verify trip capacity decremented safely back to 0
    const tripAfter = await Trip.findById(trip._id);
    assert.strictEqual(tripAfter.approvedMembersCount, 0);

    // Member cannot access the private trip room
    const roomAccess = await member.agent.get(`/api/trips/${trip._id}/room`);
    assert.strictEqual(roomAccess.status, 403);
  });

  it('7. Pending applicant withdrawing join request does NOT send member_left notification to host', async () => {
    const host = await createAuthenticatedUser('leave_host@tripza.in', 'Leave Host');
    const applicant = await createAuthenticatedUser('leave_app@tripza.in', 'Leave App');
    const trip = await createPublishedTrip(host);

    // Applicant submits request
    await applicant.agent
      .post(`/api/trips/${trip._id}/join`)
      .set('X-CSRF-Token', applicant.csrfToken)
      .send({ message: 'Applying' });

    // Clear notifications
    await Notification.deleteMany({});

    // Applicant withdraws pending request
    const withdrawRes = await applicant.agent
      .post(`/api/trips/${trip._id}/leave`)
      .set('X-CSRF-Token', applicant.csrfToken)
      .send();
    assert.strictEqual(withdrawRes.status, 200);

    // Verify host was NOT sent a 'member_left' notification
    const hostNotifs = await Notification.find({ recipient: host.user.id, type: 'member_left' });
    assert.strictEqual(hostNotifs.length, 0);
  });

  it('8. Verification review notifies traveller and GET /api/verification/pending lists applications for admins', async () => {
    const admin = await createAuthenticatedUser('admin_ver@tripza.in', 'Lead Admin', 'admin');
    const traveller = await createAuthenticatedUser('trav_ver@tripza.in', 'Traveller Ver');

    // Traveller submits verification
    const subRes = await traveller.agent
      .post('/api/verification/submit')
      .set('X-CSRF-Token', traveller.csrfToken)
      .send();
    assert.strictEqual(subRes.status, 200);

    // Ordinary user cannot access /api/verification/pending
    const guestPending = await traveller.agent.get('/api/verification/pending');
    assert.strictEqual(guestPending.status, 403);

    // Admin can access /api/verification/pending
    const adminPending = await admin.agent.get('/api/verification/pending');
    assert.strictEqual(adminPending.status, 200);
    assert.strictEqual(adminPending.body.data.pending.length, 1);
    assert.strictEqual(adminPending.body.data.pending[0].email, 'trav_ver@tripza.in');

    // Admin verifies the traveller
    const reviewRes = await admin.agent
      .post('/api/verification/review')
      .set('X-CSRF-Token', admin.csrfToken)
      .send({
        targetUserId: traveller.user.id,
        decision: 'verified',
        notes: 'Community trust verification approved',
      });
    assert.strictEqual(reviewRes.status, 200);

    // Traveller received an in-app notification
    const travellerNotifs = await Notification.find({
      recipient: traveller.user.id,
      type: 'moderation_notice',
    });
    assert.strictEqual(travellerNotifs.length, 1);
    assert.match(travellerNotifs[0].title, /Verified/);
  });
});
