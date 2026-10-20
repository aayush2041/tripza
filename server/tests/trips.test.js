process.env.NODE_ENV = 'test';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server');

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { Trip } from '../src/models/Trip.js';
import { TripMembership } from '../src/models/TripMembership.js';

let mongoServer;

describe('TripZa Trip Creation, Discovery, Capacity & Join Requests Suite', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Profile.deleteMany({});
    await Trip.deleteMany({});
    await TripMembership.deleteMany({});
  });

  async function getCsrfTokenAndCookie(agent) {
    const res = await agent.get('/api/auth/csrf-token').expect(200);
    return res.body.data.csrfToken;
  }

  // Helper to create and authenticate a user with specific verification status
  async function createAuthUser(email, verificationStatus = 'unverified') {
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

    if (verificationStatus !== 'unverified') {
      await Profile.findOneAndUpdate(
        { user: userId },
        { 'verification.status': verificationStatus }
      );
    }

    return { agent, csrfToken, userId, email };
  }

  // 1. Verified traveller can create and publish a trip
  it('1. Verified traveller can create and publish a trip', async () => {
    const host = await createAuthUser('host@tripza.in', 'verified');

    const tripData = {
      title: 'Spiti Valley High Altitude Road Trip',
      description: 'Join our self-drive convoy through Manali, Kaza, Tabo, and Chandratal Lake.',
      startingCity: 'Chandigarh',
      meetingPoint: 'Zirakpur Flyover, 6:00 AM',
      destination: 'Spiti Valley',
      category: 'road trip',
      startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 18).toISOString(),
      budget: {
        amount: 25000,
        currency: 'INR',
        included: ['Fuel', 'Homestays', 'Permits'],
        excluded: ['Personal snacks'],
      },
      maxGroupSize: 6,
      joinPolicy: 'approval_required',
      status: 'published',
    };

    const res = await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send(tripData)
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.title, tripData.title);
    assert.strictEqual(res.body.data.status, 'published');
    assert.strictEqual(res.body.data.availableSpots, 5); // 6 max - 1 host = 5 spots
    assert.strictEqual(res.body.data.approvedMembersCount, 0);
  });

  // 2. Unverified traveller cannot publish a trip
  it('2. Unverified traveller cannot publish a trip (blocked with 403), but can save draft', async () => {
    const unverifiedUser = await createAuthUser('unverified@tripza.in', 'unverified');

    const tripData = {
      title: 'Western Ghats Monsoon Trek',
      description: 'Lush green trails and waterfalls in Kudremukh.',
      startingCity: 'Bengaluru',
      meetingPoint: 'Majestic Metro Station, 10:00 PM',
      destination: 'Kudremukh',
      category: 'trekking',
      startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      budget: { amount: 4500, included: ['Guide', 'Forest Permit'], excluded: [] },
      maxGroupSize: 10,
      status: 'published', // Attempting to publish
    };

    // Publishing must be blocked with 403
    const publishRes = await unverifiedUser.agent
      .post('/api/trips')
      .set('X-CSRF-Token', unverifiedUser.csrfToken)
      .send(tripData)
      .expect(403);

    assert.strictEqual(publishRes.body.success, false);
    assert.strictEqual(publishRes.body.error.code, 'VERIFICATION_REQUIRED');

    // Saving as draft must succeed
    tripData.status = 'draft';
    const draftRes = await unverifiedUser.agent
      .post('/api/trips')
      .set('X-CSRF-Token', unverifiedUser.csrfToken)
      .send(tripData)
      .expect(201);

    assert.strictEqual(draftRes.body.data.status, 'draft');

    // Attempting to publish draft while unverified must also fail
    const draftId = draftRes.body.data.id;
    await unverifiedUser.agent
      .post(`/api/trips/${draftId}/publish`)
      .set('X-CSRF-Token', unverifiedUser.csrfToken)
      .expect(403);
  });

  // 3. Anonymous user cannot create a trip
  it('3. Anonymous unauthenticated user cannot create a trip', async () => {
    await request(app).post('/api/trips').send({ title: 'Anonymous Trek' }).expect(401);
  });

  // 4. Published trips appear in discovery results
  it('4. Published trips appear in discovery results, drafts do not', async () => {
    const host = await createAuthUser('host2@tripza.in', 'verified');

    // Create 1 published trip
    await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Gokarna Beach Camping & Trail',
        description: 'Explore Paradise, Om, and Half Moon beaches with tent stays.',
        startingCity: 'Goa',
        meetingPoint: 'Madgaon Junction',
        destination: 'Gokarna',
        category: 'camping',
        startDate: new Date(Date.now() + 86400000 * 12).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        budget: { amount: 3500 },
        maxGroupSize: 8,
        status: 'published',
      })
      .expect(201);

    // Create 1 draft trip
    await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Secret Unfinished Plan',
        description: 'Draft plan not yet ready to share with the public.',
        startingCity: 'Delhi',
        meetingPoint: 'ISBT',
        destination: 'Rishikesh',
        category: 'weekend getaway',
        startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 22).toISOString(),
        budget: { amount: 2000 },
        maxGroupSize: 5,
        status: 'draft',
      })
      .expect(201);

    // Call discovery endpoint
    const res = await request(app).get('/api/trips').expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.trips.length, 1);
    assert.strictEqual(res.body.data.trips[0].title, 'Gokarna Beach Camping & Trail');
    assert.ok(res.body.data.trips[0].organiserProfile.fullName);
  });

  // 5. Search and filters work correctly
  it('5. Discovery search, destination, category, and budget filters work correctly', async () => {
    const host = await createAuthUser('filterhost@tripza.in', 'verified');

    // Trip A: Manali Trekking ₹6000
    await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Hampta Pass Trek Expedition',
      description: 'Cross over from Manali valley to the barren mountains of Spiti.',
      startingCity: 'Manali',
      meetingPoint: 'Mall Road',
      destination: 'Hampta Pass',
      category: 'trekking',
      startDate: new Date(Date.now() + 86400000 * 15).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 20).toISOString(),
      budget: { amount: 6000 },
      maxGroupSize: 10,
      status: 'published',
    });

    // Trip B: Jaipur Heritage Weekend ₹3000
    await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Jaipur Forts and Street Food',
      description: 'Explore Amer, Nahargarh, and Chokhi Dhani.',
      startingCity: 'Delhi',
      meetingPoint: 'Dhaula Kuan',
      destination: 'Jaipur',
      category: 'weekend getaway',
      startDate: new Date(Date.now() + 86400000 * 8).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      budget: { amount: 3000 },
      maxGroupSize: 4,
      status: 'published',
    });

    // Search query: "Hampta"
    const searchRes = await request(app).get('/api/trips?search=Hampta').expect(200);
    assert.strictEqual(searchRes.body.data.trips.length, 1);
    assert.strictEqual(searchRes.body.data.trips[0].destination, 'Hampta Pass');

    // Filter category: "weekend getaway"
    const catRes = await request(app).get('/api/trips?category=weekend getaway').expect(200);
    assert.strictEqual(catRes.body.data.trips.length, 1);
    assert.strictEqual(catRes.body.data.trips[0].destination, 'Jaipur');

    // Filter max budget: 4000
    const budgetRes = await request(app).get('/api/trips?maxBudget=4000').expect(200);
    assert.strictEqual(budgetRes.body.data.trips.length, 1);
    assert.strictEqual(budgetRes.body.data.trips[0].budget.amount, 3000);
  });

  // 6. Invalid dates, budget, and capacity are rejected
  it('6. Invalid dates, negative budget, and invalid group sizes are rejected', async () => {
    const host = await createAuthUser('validator@tripza.in', 'verified');

    // End date before start date
    await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Invalid Date Trip',
        description: 'Should fail validation test.',
        startingCity: 'Delhi',
        meetingPoint: 'Station',
        destination: 'Agra',
        category: 'sightseeing',
        startDate: '2026-12-10',
        endDate: '2026-12-05', // Earlier than start
        budget: { amount: 1000 },
        maxGroupSize: 4,
      })
      .expect(400);

    // Negative budget
    await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Negative Budget Trip',
        description: 'Should fail validation test.',
        startingCity: 'Delhi',
        meetingPoint: 'Station',
        destination: 'Agra',
        category: 'sightseeing',
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        budget: { amount: -500 },
        maxGroupSize: 4,
      })
      .expect(400);

    // Group size less than 2
    await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Tiny Group Trip',
        description: 'Should fail validation test.',
        startingCity: 'Delhi',
        meetingPoint: 'Station',
        destination: 'Agra',
        category: 'sightseeing',
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        budget: { amount: 1000 },
        maxGroupSize: 1, // Invalid
      })
      .expect(400);
  });

  // 7. Non-organisers cannot edit or cancel another user's trip
  it("7. Non-organisers cannot edit or cancel another user's trip", async () => {
    const host = await createAuthUser('owner@tripza.in', 'verified');
    const stranger = await createAuthUser('stranger@tripza.in', 'verified');

    const tripRes = await host.agent
      .post('/api/trips')
      .set('X-CSRF-Token', host.csrfToken)
      .send({
        title: 'Original Host Trip',
        description: 'Only the host should be able to edit this.',
        startingCity: 'Pune',
        meetingPoint: 'Swargate',
        destination: 'Mahabaleshwar',
        category: 'road trip',
        startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        budget: { amount: 2000 },
        maxGroupSize: 4,
        status: 'published',
      })
      .expect(201);

    const tripId = tripRes.body.data.id;

    // Stranger tries to edit
    await stranger.agent
      .patch(`/api/trips/${tripId}`)
      .set('X-CSRF-Token', stranger.csrfToken)
      .send({ title: 'Hijacked Title' })
      .expect(403);

    // Stranger tries to cancel
    await stranger.agent
      .post(`/api/trips/${tripId}/cancel`)
      .set('X-CSRF-Token', stranger.csrfToken)
      .expect(403);
  });

  // 8. Approval-required join requests begin as pending
  it('8. Approval-required join requests begin with pending status', async () => {
    const host = await createAuthUser('host8@tripza.in', 'verified');
    const traveller = await createAuthUser('traveller8@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Coorg Coffee Trail',
      description: 'Relaxed plantation walk and estate stay.',
      startingCity: 'Bengaluru',
      meetingPoint: 'Kengeri Bus Stand',
      destination: 'Coorg',
      category: 'weekend getaway',
      startDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 9).toISOString(),
      budget: { amount: 3500 },
      maxGroupSize: 4,
      joinPolicy: 'approval_required',
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    const joinRes = await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'I love plantation walks!' })
      .expect(201);

    assert.strictEqual(joinRes.body.data.approved, false);
    assert.strictEqual(joinRes.body.data.membership.status, 'pending');
  });

  // 9. Direct joining works only when permitted and capacity is available
  it('9. Direct join immediately approves applicant when capacity is available', async () => {
    const host = await createAuthUser('host9@tripza.in', 'verified');
    const traveller = await createAuthUser('traveller9@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Direct Join Munnar Drive',
      description: 'Tea gardens and misty hills.',
      startingCity: 'Kochi',
      meetingPoint: 'Aluva Metro',
      destination: 'Munnar',
      category: 'road trip',
      startDate: new Date(Date.now() + 86400000 * 6).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 8).toISOString(),
      budget: { amount: 4000 },
      maxGroupSize: 3, // 1 host + 2 joiners
      joinPolicy: 'direct_join',
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    const joinRes = await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'Joining directly!' })
      .expect(201);

    assert.strictEqual(joinRes.body.data.approved, true);
    assert.strictEqual(joinRes.body.data.membership.status, 'approved');

    // Verify trip approvedMembersCount increased to 1
    const updatedTrip = await Trip.findById(tripId);
    assert.strictEqual(updatedTrip.approvedMembersCount, 1);
  });

  // 10. Organiser can approve and reject requests
  it('10. Organiser can approve and reject requests with count updates', async () => {
    const host = await createAuthUser('host10@tripza.in', 'verified');
    const travellerA = await createAuthUser('travellerA@tripza.in');
    const travellerB = await createAuthUser('travellerB@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Triund Snow Trek',
      description: 'Camp under the Dhauladhar stars.',
      startingCity: 'Dharamshala',
      meetingPoint: 'McLeod Ganj Square',
      destination: 'Triund',
      category: 'trekking',
      startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 12).toISOString(),
      budget: { amount: 2500 },
      maxGroupSize: 4,
      joinPolicy: 'approval_required',
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    // A and B apply
    const resA = await travellerA.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', travellerA.csrfToken)
      .send({ message: 'Trekker A' })
      .expect(201);
    const reqAId = resA.body.data.membership._id;

    const resB = await travellerB.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', travellerB.csrfToken)
      .send({ message: 'Trekker B' })
      .expect(201);
    const reqBId = resB.body.data.membership._id;

    // Organiser approves A
    const approveRes = await host.agent
      .post(`/api/trips/${tripId}/requests/${reqAId}/approve`)
      .set('X-CSRF-Token', host.csrfToken)
      .expect(200);

    assert.strictEqual(approveRes.body.data.membership.status, 'approved');
    assert.strictEqual(approveRes.body.data.tripApprovedCount, 1);

    // Organiser rejects B
    const rejectRes = await host.agent
      .post(`/api/trips/${tripId}/requests/${reqBId}/reject`)
      .set('X-CSRF-Token', host.csrfToken)
      .send({ reason: 'Group preferences not aligned' })
      .expect(200);

    assert.strictEqual(rejectRes.body.data.status, 'rejected');

    // Verify final DB state
    const tripInDb = await Trip.findById(tripId);
    assert.strictEqual(tripInDb.approvedMembersCount, 1);
  });

  // 11. Non-organisers cannot approve or reject requests
  it('11. Non-organisers cannot approve or reject join requests', async () => {
    const host = await createAuthUser('host11@tripza.in', 'verified');
    const traveller = await createAuthUser('traveller11@tripza.in');
    const bystander = await createAuthUser('bystander11@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Ladakh Bike Expedition',
      description: 'Manali-Leh highway journey.',
      startingCity: 'Manali',
      meetingPoint: 'Old Manali Bridge',
      destination: 'Leh',
      category: 'road trip',
      startDate: new Date(Date.now() + 86400000 * 20).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      budget: { amount: 35000 },
      maxGroupSize: 5,
      joinPolicy: 'approval_required',
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    const joinRes = await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'I have a Himalayan 450.' })
      .expect(201);
    const reqId = joinRes.body.data.membership._id;

    // Bystander attempts to approve
    await bystander.agent
      .post(`/api/trips/${tripId}/requests/${reqId}/approve`)
      .set('X-CSRF-Token', bystander.csrfToken)
      .expect(403);
  });

  // 12. Duplicate join requests are prevented
  it('12. Duplicate join requests by the same traveller are prevented', async () => {
    const host = await createAuthUser('host12@tripza.in', 'verified');
    const traveller = await createAuthUser('traveller12@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Hampi Bouldering & Ruins',
      description: 'Historical architecture and sunsets.',
      startingCity: 'Bengaluru',
      meetingPoint: 'Yesvantpur Station',
      destination: 'Hampi',
      category: 'sightseeing',
      startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 12).toISOString(),
      budget: { amount: 3000 },
      maxGroupSize: 4,
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    // First request succeeds
    await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .expect(201);

    // Second request while first is pending returns 400 ALREADY_PENDING
    const dupRes = await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .expect(400);

    assert.strictEqual(dupRes.body.error.code, 'ALREADY_PENDING');
  });

  // 13. Capacity cannot be exceeded during join attempts
  it('13. Trip capacity cannot be exceeded; further requests are blocked', async () => {
    const host = await createAuthUser('host13@tripza.in', 'verified');
    const t1 = await createAuthUser('t1@tripza.in');
    const t2 = await createAuthUser('t2@tripza.in');

    // maxGroupSize: 2 (1 host + 1 joiner max)
    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Solo Plus One Road Trip',
      description: 'Only 1 companion spot available.',
      startingCity: 'Delhi',
      meetingPoint: 'Connaught Place',
      destination: 'Kasol',
      category: 'road trip',
      startDate: new Date(Date.now() + 86400000 * 8).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 11).toISOString(),
      budget: { amount: 4000 },
      maxGroupSize: 2,
      joinPolicy: 'direct_join',
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    // T1 joins directly (fills the 1 spot)
    await t1.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', t1.csrfToken)
      .expect(201);

    // T2 attempts to join full trip (must fail with TRIP_FULL)
    const fullRes = await t2.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', t2.csrfToken)
      .expect(400);

    assert.strictEqual(fullRes.body.error.code, 'TRIP_FULL');
  });

  // 14. Cancelled trips cannot accept new members
  it('14. Cancelled trips cannot accept new members', async () => {
    const host = await createAuthUser('host14@tripza.in', 'verified');
    const traveller = await createAuthUser('traveller14@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Cancelled Trek Plan',
      description: 'Will be cancelled shortly.',
      startingCity: 'Shimla',
      meetingPoint: 'Old Bus Stand',
      destination: 'Chanshal Pass',
      category: 'trekking',
      startDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      budget: { amount: 3000 },
      maxGroupSize: 5,
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    // Host cancels trip
    await host.agent
      .post(`/api/trips/${tripId}/cancel`)
      .set('X-CSRF-Token', host.csrfToken)
      .expect(200);

    // Traveller tries to join cancelled trip
    const joinRes = await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .expect(400);

    assert.strictEqual(joinRes.body.error.code, 'TRIP_NOT_PUBLISHED');
  });

  // 15. Private participant details are not exposed publicly
  it('15. Public trip endpoints do not expose private applicant records', async () => {
    const host = await createAuthUser('host15@tripza.in', 'verified');
    const traveller = await createAuthUser('traveller15@tripza.in');

    const tripRes = await host.agent.post('/api/trips').set('X-CSRF-Token', host.csrfToken).send({
      title: 'Public Inspection Trip',
      description: 'Public endpoint verification.',
      startingCity: 'Mumbai',
      meetingPoint: 'Dadar TT',
      destination: 'Alibaug',
      category: 'weekend getaway',
      startDate: new Date(Date.now() + 86400000 * 4).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      budget: { amount: 1500 },
      maxGroupSize: 6,
      status: 'published',
    });

    const tripId = tripRes.body.data.id;

    // Traveller joins
    await traveller.agent
      .post(`/api/trips/${tripId}/join`)
      .set('X-CSRF-Token', traveller.csrfToken)
      .send({ message: 'Secret contact number: 9876543210' });

    // Anonymous visitor views trip
    const anonRes = await request(app).get(`/api/trips/${tripId}`).expect(200);

    // Ensure private requests are not in the public response
    assert.strictEqual(anonRes.body.data.trip.requests, undefined);
    assert.strictEqual(anonRes.body.data.userMembership, null);
  });
});
