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

### E. Testing Trip Creation & Discovery Workflows (Prompt 3)
1. **List a Trip**:
   - Ensure your account is verified (or save as Draft if unverified).
   - Navigate to [http://localhost:5173/trips/create](http://localhost:5173/trips/create).
   - Enter trip details (e.g., "Spiti Valley 9-Day Road Trip", Category: Road Trip, Starting: Chandigarh, Destination: Kaza, Budget: 14500, Max Group Size: 6).
   - Add waypoints, inclusions, and day-by-day itinerary.
   - Click **Publish Trip** (or **Save as Draft**).
2. **Discover Trips**:
   - Navigate to [http://localhost:5173/trips](http://localhost:5173/trips).
   - Use the sidebar filters to search by destination, category, departure date, or max budget.
   - Filter by "Available spots only" to view non-full journeys.
3. **Join Requests**:
   - Open any trip details page (e.g. [http://localhost:5173/trips/:id](http://localhost:5173/trips/:id)).
   - For direct-join trips, click **Join Trip Now** to instantly confirm membership.
   - For approval-required trips, click **Request to Join** and provide a friendly note to the host.
4. **Host Request Management & Personal Dashboard**:
   - Navigate to [http://localhost:5173/my-trips](http://localhost:5173/my-trips).
   - Tab 1 ("Trips I'm Hosting"): Click **Join Requests** on any journey to review applicant notes and approve/reject them.
   - Tab 2 ("Trips I've Joined"): View confirmed journeys and leave if plans change.
   - Tab 3 ("My Join Requests"): Track pending applications and withdraw if needed.

### F. Testing Private Trip Rooms & Real-Time Group Chat (Prompt 4)
1. **Accessing the Room**:
   - As an approved member or host, click **💬 Enter Private Trip Room** on the trip detail page or your **My Trips** dashboard.
   - Navigate directly to [http://localhost:5173/trips/:id/room](http://localhost:5173/trips/:id/room).
   - Verify unapproved users receive the clear `Private Trip Room Access Restricted` notice.
2. **Real-Time Group Chat**:
   - Open the room in two different browsers (or an incognito window) signed in as the host and an approved member.
   - Send a message in one window; observe the instant WebSocket broadcast update in the other without page refresh.
   - Observe typing indicators when peer members type.
3. **Trip Cancellation & Read-Only Mode**:
   - As the host, cancel the trip.
   - Verify the Trip Room displays the `Archived (Read-Only)` badge, existing messages remain readable, and message input is safely disabled.

### G. Testing Safety Reporting, User Blocking & Notifications (Prompt 5)
1. **Reporting Inappropriate Conduct**:
   - On any trip details page, public profile, or Trip Room message, click the **🚩 Report** button.
   - Select an applicable category (e.g. *harassment*, *misleading_trip*, *safety_concern*) and enter explanatory details.
   - Submit the confidential report; verify duplicate open reports against the same target are prevented.
2. **User Blocking & Account Safety**:
   - Navigate to [http://localhost:5173/profile](http://localhost:5173/profile) to inspect the **Blocked Travellers** manager.
   - Block another user via API or safety controls; verify the blocked traveller cannot submit join requests for trips hosted by the blocker.
   - Unblock the user and verify join request capabilities are restored. Existing confirmed group trip memberships are preserved without silent disruption.
3. **In-App Notifications Centre**:
   - Navigate to [http://localhost:5173/notifications](http://localhost:5173/notifications) or click the bell icon in the navigation header.
   - Receive automatic notifications for new join requests, host approvals/rejections, itinerary edits (`trip_updated`), and member departures (`member_left`).
   - Use the **Mark All as Read** button or filter by unread notifications.
4. **Administrative Moderation Dashboard**:
   - Sign in as an administrator (e.g. `admin@tripza.in`).
   - Navigate to [http://localhost:5173/admin/moderation](http://localhost:5173/admin/moderation) (or click **🛡️ Moderation** in the header).
   - Filter reports by status (`open`, `under_review`, `action_taken`, `dismissed`) and target type.
   - Resolve reports by taking action (e.g., dismiss with audit notes, remove offending chat messages, or suspend bad-actor user accounts).
   - Verify suspended users are immediately evicted from active WebSocket rooms and prevented from re-connecting.
5. **Community Safety Guidelines & Emergency Resources**:
   - Navigate to [http://localhost:5173/safety](http://localhost:5173/safety) to view India-specific safety guidelines, SOS emergency numbers (112, 1090/1091, 1363, 1070), and the clear in-transit TLS / no-E2EE privacy disclosure.

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
# Subtest: TripZa Trip Creation, Discovery, Capacity & Join Requests Suite
    ok 1 - 1. Verified traveller can create and publish a trip
    ok 2 - 2. Unverified traveller cannot publish a trip (blocked with 403), but can save draft
    ok 3 - 3. Anonymous unauthenticated user cannot create a trip
    ok 4 - 4. Published trips appear in discovery results, drafts do not
    ok 5 - 5. Discovery search, destination, category, and budget filters work correctly
    ok 6 - 6. Invalid dates, negative budget, and invalid group sizes are rejected
    ok 7 - 7. Non-organisers cannot edit or cancel another user's trip
    ok 8 - 8. Approval-required join requests begin with pending status
    ok 9 - 9. Direct join immediately approves applicant when capacity is available
    ok 10 - 10. Organiser can approve and reject requests with count updates
    ok 11 - 11. Non-organisers cannot approve or reject join requests
    ok 12 - 12. Duplicate join requests by the same traveller are prevented
    ok 13 - 13. Trip capacity cannot be exceeded; further requests are blocked
    ok 14 - 14. Cancelled trips cannot accept new members
    ok 15 - 15. Public trip endpoints do not expose private applicant records
# Subtest: TripZa Private Trip Rooms & Real-Time Group Chat Suite
    ok 1 - 1. Organiser can access their trip room metadata and message history
    ok 2 - 2. Approved member can access the trip room
    ok 3 - 3. Pending applicant cannot access the trip room (blocked with 403)
    ok 4 - 4. Non-member cannot retrieve room metadata or message history
    ok 5 - 5. Unauthenticated Socket.IO connection is rejected
    ok 6 - 6. Unauthorized socket cannot join a trip room
    ok 7 - 7. Authorized member can send and receive a persisted message via Socket.IO
    ok 8 - 8. Client cannot impersonate another sender (sender ID is server-enforced)
    ok 9 - 9. Message length and rate limits are enforced
    ok 10 - 10. Messages from one trip are not broadcast to another trip
    ok 11 - 11. Removed or withdrawn members lose room access
    ok 12 - 12. Cancelled-trip room behavior follows documented read-only policy
    ok 13 - 13. Message history pagination is stable and cursor-based
# Subtest: TripZa Safety, Reporting, Notifications & Account Safety Suite
    ok 1 - 1. Authenticated user can report a user, trip, and message with valid categories
    ok 2 - 2. Users cannot report themselves, and invalid target IDs or categories are rejected
    ok 3 - 3. Duplicate open reports from the same user for the same target are prevented
    ok 4 - 4. Ordinary users cannot access admin moderation queue; admins can inspect and resolve reports
    ok 5 - 5. Message removal via moderation masks text and marks status removed in room history
    ok 6 - 6. User can block and unblock another user; self-blocking and duplicate blocking are rejected
    ok 7 - 7. Blocked relationship prevents new trip join requests between the two users
    ok 8 - 8. In-app notifications are generated for join requests, approvals, rejections, trip edits, and member leave
    ok 9 - 9. Users can only access and mark their own notifications as read; bulk mark-all-read updates unread counts
    ok 10 - 10. Suspended user cannot connect or send messages via Socket.IO
    ok 11 - 11. Message reported in Trip Room reaches the centralized Report collection
# Subtest: TripZa Audit & Regression Suite (Prompt 6)
    ok 1 - 1. Strict CSRF origin check prevents attacker domain with shared prefix
    ok 2 - 2. GET /api/trips/:id returns isOrganiser true for host and false for non-host
    ok 3 - 3. Single-date trip update cannot invert date range (endDate < startDate)
    ok 4 - 4. Itinerary items map both description and activities seamlessly
    ok 5 - 5. Rejecting an already rejected request returns 400 ALREADY_REJECTED
    ok 6 - 6. Host rejecting an approved member decrements capacity safely and evicts socket
    ok 7 - 7. Pending applicant withdrawing join request does NOT send member_left notification to host
    ok 8 - 8. Verification review notifies traveller and GET /api/verification/pending lists applications for admins
# tests 68
# suites 7
# pass 68
# fail 0
```

---

## 6. Building Frontend for Production

Test that the client application builds cleanly:
```bash
npm run build
# Outputs optimized production assets to client/dist/
```
