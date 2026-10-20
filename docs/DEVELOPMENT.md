# TripZa — Local Development & Setup Guide

This guide describes how to configure, run, test, and verify the TripZa monorepo locally, including authentication, traveller profiles, and verification review workflows.

---

## 1. Prerequisites

Ensure your development machine has the following tools installed:

- **Node.js**: `v20.x` or `v22.x` LTS (tested with `v22.14.0`)
- **npm**: `v10.x` or higher
- **Git**: `v2.x`
- **MongoDB** *(Required for persistent local dev, automated tests run with isolated in-memory MongoDB)*:
  - Local MongoDB Community Server running on `mongodb://127.0.0.1:27017`
  - OR a free cloud cluster on [MongoDB Atlas](https://www.mongodb.com/atlas/database)

---

## 2. Initial Setup

### A. Clone & Directory Navigation
Open your terminal and navigate to the project directory:
```bash
cd d:\ChaloBuddy.in\tripza
```

### B. Environment Variable Configuration
Copy the template `.env.example` to create your local `.env`:
```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On macOS/Linux:
cp .env.example .env
```

Review `.env` settings:
```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/tripza_dev
SESSION_SECRET=replace_this_with_a_secure_random_string_min_32_chars
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
VITE_API_BASE_URL=http://localhost:5000/api
```

> **Note on MongoDB Availability**:
> If MongoDB is not yet running on your machine, the backend server starts gracefully and reports `status: "degraded"` on `GET /api/health`. Automated integration tests run with an isolated in-memory MongoDB runner.

### C. Install Dependencies
```bash
# Install server dependencies:
npm install --prefix server

# Install client dependencies:
npm install --prefix client
```

---

## 3. Running Development Servers

### Option 1: Start Backend and Frontend Independently

**Terminal 1 — Backend Server (Express + Socket.IO + Sessions)**:
```bash
npm run dev:server
# Server starts on http://localhost:5000
# Health check available at http://localhost:5000/api/health
```

**Terminal 2 — Frontend Development Server (Vite + React)**:
```bash
npm run dev:client
# Application shell launches on http://localhost:5173
```

---

## 4. Testing Authentication & Profile Workflows Locally

### A. Register a New Traveller
1. Open [http://localhost:5173/register](http://localhost:5173/register) in your browser.
2. Enter your Full Name (e.g. `Aarav Sharma`), Email (`aarav@example.com`), and a secure password (min 8 chars with letters & numbers).
3. Submit the form. You will be automatically authenticated via an `HttpOnly` cookie and redirected to your Traveller Profile.

### B. Update Traveller Profile Details
1. Navigate to [http://localhost:5173/profile](http://localhost:5173/profile).
2. Edit your Bio, Home City (e.g. `Bengaluru`), Travel Interests (`Trekking, Road Trips, Coastal`), and Languages (`Hindi, English`).
3. Click **Save Profile Changes**.
4. Observe the **Profile Completeness** bar increase.

### C. Submit for Community Verification
1. On your profile page, locate the **Community Verification** card.
2. Click **Submit for Verification**.
3. Your verification status transitions to `Pending Review`.

### D. Provision an Administrator & Review Verification
To safely test the administrative review workflow, provision an admin account from the command line:

```bash
cd server
node src/scripts/provisionAdmin.js admin@tripza.in AdminPassword123! "Lead Admin"
```

1. Sign out of your regular traveller account.
2. Sign in as `admin@tripza.in` at [http://localhost:5173/login](http://localhost:5173/login).
3. The administrator can approve or reject pending verifications using the review API:
   ```bash
   # Via curl / REST client with active admin session:
   POST http://localhost:5000/api/verification/review
   Content-Type: application/json
   X-CSRF-Token: <token>
   {
     "targetUserId": "<travellerUserId>",
     "decision": "verified",
     "notes": "Verified via community trust review"
   }
   ```
4. Once verified, the traveller's profile displays the green **Verified Traveller** badge.

---

## 5. Running Automated Tests

Run the full integration test suite (incorporating isolated in-memory MongoDB):
```bash
# Run server tests:
npm --prefix server test

# Or from root:
npm test
```

Expected test output:
```
# Subtest: TripZa Authentication, Sessions, Profiles & Verification Suite
    ok 1 - 1. Successful registration should create user, profile, and return safe data
    ok 2 - 2. Invalid registration input should be rejected with 400 and clear error
    ok 3 - 3. Duplicate email registration should return 409 Conflict
    ok 4 - 4. Passwords must be stored only as secure bcrypt hashes, never plaintext
    ok 5 - 5. Successful login should regenerate session and authenticate user
    ok 6 - 6. Invalid login credentials should return generic 401 error
    ok 7 - 7. Session should persist across authenticated requests using HTTP-only cookie
    ok 8 - 8. Logout should destroy the session and prevent subsequent authenticated access
    ok 9 - 9. Unauthenticated access to protected endpoints must return 401
    ok 10 - 10. Public profile view exposes only public fields, not private user data
    ok 11 - 11. User cannot elevate their role to admin via profile update (mass assignment prevention)
    ok 12 - 12. User cannot self-verify via profile update
    ok 13 - 13. Verification submissions transition to pending_review, and review requires admin
    ok 14 - 14. Sensitive fields like passwordHash and reviewNotes are stripped from responses
    ok 15 - 15. Mutating requests without valid CSRF token are blocked with 403
# Subtest: TripZa Configuration Suite
    ok 1 - should load safe default configuration
    ok 2 - should keep secrets out of client-accessible fields
# Subtest: TripZa Backend Foundation & Health Suite
    ok 1 - GET /api/health should respond with 200 and accurate system status
    ok 2 - GET /api should respond with 200 and API metadata
    ok 3 - GET /api/nonexistent-route should respond with 404 and consistent error format
    ok 4 - Should set security headers via Helmet
# tests 21
# suites 3
# pass 21
# fail 0
```

---

## 6. Building Frontend for Production

Test that the client application builds cleanly:
```bash
npm run build
# Outputs optimized production assets to client/dist/
```
