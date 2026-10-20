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

let mongoServer;

describe('TripZa Authentication, Sessions, Profiles & Verification Suite', () => {
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
  });

  // Helper to obtain a valid CSRF token and cookie from a supertest agent
  async function getCsrfTokenAndCookie(agent) {
    const res = await agent.get('/api/auth/csrf-token').expect(200);
    const token = res.body.data.csrfToken;
    return token;
  }

  // 1. Successful registration
  it('1. Successful registration should create user, profile, and return safe data', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Aarav Sharma',
        email: 'Aarav@TripZa.in', // Mixed case to test normalization
        password: 'ValidPassword123!',
      })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, 'aarav@tripza.in'); // Normalized lowercase
    assert.strictEqual(res.body.data.user.role, 'traveller');
    assert.strictEqual(res.body.data.profile.fullName, 'Aarav Sharma');
    assert.strictEqual(res.body.data.profile.verificationStatus, 'unverified');

    // Verify session cookie was set
    const cookies = res.headers['set-cookie'] || [];
    assert.ok(cookies.some((c) => c.includes('tripza_sid')));
  });

  // 2. Invalid registration input
  it('2. Invalid registration input should be rejected with 400 and clear error', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    // Missing password
    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Test User',
        email: 'invalid-email',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  // 3. Duplicate email registration
  it('3. Duplicate email registration should return 409 Conflict', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Original User',
        email: 'duplicate@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    // Attempt second registration with same email (even with different casing)
    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Another User',
        email: 'DUPLICATE@tripza.in',
        password: 'Password456!',
      })
      .expect(409);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  // 4. Passwords stored only as hashes
  it('4. Passwords must be stored only as secure bcrypt hashes, never plaintext', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);
    const plainPassword = 'PlainSecretPassword123!';

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Security Test',
        email: 'security@tripza.in',
        password: plainPassword,
      })
      .expect(201);

    const userInDb = await User.findOne({ email: 'security@tripza.in' }).select('+passwordHash');
    assert.ok(userInDb);
    assert.notStrictEqual(userInDb.passwordHash, plainPassword);
    assert.ok(userInDb.passwordHash.startsWith('$2')); // bcrypt salt identifier
    const matches = await userInDb.comparePassword(plainPassword);
    assert.strictEqual(matches, true);
  });

  // 5. Successful login
  it('5. Successful login should regenerate session and authenticate user', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    // Register user first
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Rohan Mehra',
        email: 'rohan@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    // Log out
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrfToken).expect(200);

    // After session destruction on logout, obtain fresh CSRF token for the new unauthenticated session
    const freshCsrf = await getCsrfTokenAndCookie(agent);

    // Login with valid credentials
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', freshCsrf)
      .send({
        email: 'ROHAN@tripza.in', // Test case insensitivity
        password: 'Password123!',
      })
      .expect(200);

    assert.strictEqual(loginRes.body.success, true);
    assert.strictEqual(loginRes.body.data.user.email, 'rohan@tripza.in');
    assert.strictEqual(loginRes.body.data.profile.fullName, 'Rohan Mehra');
  });

  // 6. Invalid login credentials
  it('6. Invalid login credentials should return generic 401 error', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({
        email: 'nonexistent@tripza.in',
        password: 'WrongPassword123!',
      })
      .expect(401);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(res.body.error.message, 'Invalid email or password.');
  });

  // 7. Session persistence across authenticated requests
  it('7. Session should persist across authenticated requests using HTTP-only cookie', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Priya Patel',
        email: 'priya@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    // Call GET /api/auth/me using the same session
    const meRes = await agent.get('/api/auth/me').expect(200);
    assert.strictEqual(meRes.body.success, true);
    assert.strictEqual(meRes.body.data.user.email, 'priya@tripza.in');
    assert.strictEqual(meRes.body.data.profile.fullName, 'Priya Patel');
  });

  // 8. Logout invalidates session
  it('8. Logout should destroy the session and prevent subsequent authenticated access', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Kavya Nair',
        email: 'kavya@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    // Logout
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrfToken).expect(200);

    // Subsequent GET /api/auth/me must be rejected with 401
    const res = await agent.get('/api/auth/me').expect(401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHENTICATED');
  });

  // 9. Unauthenticated access to protected endpoints is rejected
  it('9. Unauthenticated access to protected endpoints must return 401', async () => {
    const unauthedAgent = request(app);

    await unauthedAgent.get('/api/auth/me').expect(401);
    await unauthedAgent.get('/api/profiles/me').expect(401);
  });

  // 10. A user cannot access another user's private account data
  it("10. Public profile view exposes only public fields, not private user data", async () => {
    const agent1 = request.agent(app);
    const csrf1 = await getCsrfTokenAndCookie(agent1);

    const regRes = await agent1
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrf1)
      .send({
        fullName: 'Private User',
        email: 'private@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    const profileId = regRes.body.data.profile.id;

    // Another unauthenticated or different agent requests the public profile
    const publicAgent = request(app);
    const pubRes = await publicAgent.get(`/api/profiles/${profileId}`).expect(200);

    assert.strictEqual(pubRes.body.data.fullName, 'Private User');
    assert.strictEqual(pubRes.body.data.email, undefined); // Email must not be leaked
    assert.strictEqual(pubRes.body.data.passwordHash, undefined);
    assert.strictEqual(pubRes.body.data.accountStatus, undefined);
  });

  // 11. A user cannot grant themselves administrator privileges
  it('11. User cannot elevate their role to admin via profile update (mass assignment prevention)', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Hacker Attempt',
        email: 'hacker@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    // Attempt to inject role: admin via PATCH /api/profiles/me
    await agent
      .patch('/api/profiles/me')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Updated Name',
        role: 'admin',
        accountStatus: 'admin',
      })
      .expect(200);

    // Verify in database that role remains 'traveller'
    const userInDb = await User.findOne({ email: 'hacker@tripza.in' });
    assert.strictEqual(userInDb.role, 'traveller');
  });

  // 12. A user cannot grant themselves verified status
  it('12. User cannot self-verify via profile update', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Self Verify Attempt',
        email: 'selfverify@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    // Attempt to set verification status directly
    await agent
      .patch('/api/profiles/me')
      .set('X-CSRF-Token', csrfToken)
      .send({
        verification: { status: 'verified' },
        verificationStatus: 'verified',
      })
      .expect(200);

    const profileInDb = await Profile.findOne({ fullName: 'Self Verify Attempt' });
    assert.strictEqual(profileInDb.verification.status, 'unverified');
  });

  // 13. Verification submissions and review decisions enforce authorization
  it('13. Verification submissions transition to pending_review, and review requires admin', async () => {
    const userAgent = request.agent(app);
    const userCsrf = await getCsrfTokenAndCookie(userAgent);

    const regRes = await userAgent
      .post('/api/auth/register')
      .set('X-CSRF-Token', userCsrf)
      .send({
        fullName: 'Arjun Das',
        email: 'arjun@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    const userId = regRes.body.data.user.id;

    // Submit for verification
    const submitRes = await userAgent
      .post('/api/verification/submit')
      .set('X-CSRF-Token', userCsrf)
      .expect(200);

    assert.strictEqual(submitRes.body.data.verificationStatus, 'pending_review');

    // A regular user cannot approve their own verification
    await userAgent
      .post('/api/verification/review')
      .set('X-CSRF-Token', userCsrf)
      .send({
        targetUserId: userId,
        decision: 'verified',
      })
      .expect(403);

    // Elevate a separate admin user directly in DB
    const adminPasswordHash = await User.hashPassword('AdminPassword123!');
    const adminUser = await User.create({
      email: 'admin@tripza.in',
      passwordHash: adminPasswordHash,
      role: 'admin',
    });
    await Profile.create({ user: adminUser._id, fullName: 'System Admin' });

    // Admin logs in and approves verification
    const adminAgent = request.agent(app);
    const adminCsrf = await getCsrfTokenAndCookie(adminAgent);

    await adminAgent
      .post('/api/auth/login')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        email: 'admin@tripza.in',
        password: 'AdminPassword123!',
      })
      .expect(200);

    const reviewRes = await adminAgent
      .post('/api/verification/review')
      .set('X-CSRF-Token', adminCsrf)
      .send({
        targetUserId: userId,
        decision: 'verified',
        notes: 'Identity confirmed via manual review workflow',
      })
      .expect(200);

    assert.strictEqual(reviewRes.body.data.verificationStatus, 'verified');

    // Verify Arjun's profile now reflects verified status
    const arjunProfile = await Profile.findOne({ user: userId });
    assert.strictEqual(arjunProfile.verification.status, 'verified');
    assert.strictEqual(String(arjunProfile.verification.reviewedBy), String(adminUser._id));
  });

  // 14. Sensitive fields are not included in API responses
  it('14. Sensitive fields like passwordHash and reviewNotes are stripped from responses', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfTokenAndCookie(agent);

    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        fullName: 'Clean Output',
        email: 'clean@tripza.in',
        password: 'Password123!',
      })
      .expect(201);

    assert.strictEqual(res.body.data.user.passwordHash, undefined);
    assert.strictEqual(res.body.data.user.__v, undefined);
    assert.strictEqual(res.body.data.profile.verification, undefined);
    assert.strictEqual(res.body.data.profile.verificationStatus, 'unverified');
  });

  // 15. CSRF and origin protections work as designed
  it('15. Mutating requests without valid CSRF token are blocked with 403', async () => {
    const agent = request.agent(app);

    // Call mutating POST without X-CSRF-Token header
    const res = await agent
      .post('/api/auth/register')
      .send({
        fullName: 'CSRF Attacker',
        email: 'csrf@tripza.in',
        password: 'Password123!',
      })
      .expect(403);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'CSRF_INVALID');
  });
});
