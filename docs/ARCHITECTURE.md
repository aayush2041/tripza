# TripZa — System Architecture & Technical Design

## 1. Executive Summary

**TripZa** is an India-first travel community platform designed to connect verified travellers, enable collaborative trip publishing, manage join requests, and provide real-time coordination through private Trip Rooms.

This document outlines the architecture, data models, session management, and authorization controls established across **Prompt 1 (Foundation)**, **Prompt 2 (Authentication & Verified Profiles)**, **Prompt 3 (Trip Creation, Discovery & Join Requests)**, and **Prompt 4 (Private Trip Rooms & Real-Time Group Chat)**.

---

## 2. Monorepo Organization

TripZa uses a clean monorepo architecture separating the browser client from the API backend:

```
tripza/
├── client/                     # Frontend Application (React 19 + Vite 6 + React Router v7)
│   ├── public/                 # Static assets (favicons, icons)
│   ├── src/
│   │   ├── app/                # Application entry configuration
│   │   ├── components/         # Reusable presentation components (Header, Footer, Card, Badge, Notice, etc.)
│   │   ├── context/            # React Contexts (AuthContext for reactive session state)
│   │   ├── hooks/              # Custom React hooks (useAuth)
│   │   ├── layouts/            # Page shell layouts (RootLayout)
│   │   ├── pages/              # Routed page views:
│   │   │   ├── HomePage.jsx            # Landing page with active phase highlights
│   │   │   ├── LoginPage.jsx           # Secure session authentication
│   │   │   ├── RegisterPage.jsx        # Account registration
│   │   │   ├── ProfilePage.jsx         # Profile editing & ID verification submission
│   │   │   ├── TripsDiscoveryPage.jsx  # Multi-parameter trip discovery & filtering
│   │   │   ├── TripDetailPage.jsx      # Itinerary, host trust badge, & dynamic join action
│   │   │   ├── TripCreatePage.jsx      # Draft & publish trip listing form
│   │   │   ├── TripEditPage.jsx        # Host trip editor
│   │   │   ├── MyTripsPage.jsx         # Hosted trips, joined journeys & join request approvals
│   │   │   └── SystemStatusPage.jsx    # Real-time backend diagnostics
│   │   ├── routes/             # Client-side routing table (React Router v7)
│   │   ├── services/           # Network & API abstraction layer (api.js with CSRF handling)
│   │   ├── styles/             # Global CSS variables, resets, and typography
│   │   └── utils/              # Client utility functions
│   ├── index.html              # HTML5 entrypoint
│   ├── package.json            # Client dependencies and build scripts
│   └── vite.config.js          # Vite build and dev server configuration
│
├── server/                     # Backend API & WebSocket Server (Node.js + Express)
│   ├── src/
│   │   ├── config/             # Environment validation and Database connection managers
│   │   │   ├── env.js          # Strict environment schema validation
│   │   │   └── database.js     # Mongoose connection with honest health telemetry
│   │   ├── controllers/        # Request/response controllers (auth, profiles, verification, trips, notifications, health)
│   │   ├── middleware/         # Security headers, auth, rate limiting, csrf, notFound, errorHandler
│   │   ├── models/             # Mongoose schemas (User, Profile, Trip, TripMembership, Notification)
│   │   ├── routes/             # Express API routing tree (auth, profiles, verification, trips, notifications, health)
│   │   ├── scripts/            # CLI utilities (provisionAdmin.js)
│   │   ├── services/           # Business logic (healthService.js, notificationService.js)
│   │   ├── sockets/            # Socket.IO initialization and Trip Room room management
│   │   ├── utils/              # Safe logger and sanitizer utilities
│   │   ├── validators/         # Input validation schemas (authValidator, profileValidator, tripValidator)
│   │   ├── app.js              # Express app definition (pure, testable)
│   │   └── server.js           # Server bootstrap and graceful shutdown listeners
│   ├── tests/                  # Automated integration tests (node:test + supertest + MongoMemoryServer)
│   │   ├── trips.test.js       # 15 tests: Trip publishing, discovery, capacity, and join requests
│   │   ├── auth.test.js        # 15 tests: Authentication, sessions, profiles, and verification
│   │   ├── health.test.js      # 4 tests: Health, security headers, 404 handling
│   │   └── config.test.js      # 2 tests: Environment config & secret protection
│   └── package.json            # Server dependencies and test scripts
│
├── docs/                       # Architectural and security documentation
│   ├── ARCHITECTURE.md         # System architecture and design decisions
│   ├── SECURITY.md             # Security baseline, threat modeling, and limitations
│   └── DEVELOPMENT.md          # Local developer environment setup guide
│
├── .editorconfig               # Cross-editor formatting standards
├── .env.example                # Safe environment variable template (no secrets)
├── .gitignore                  # Git ignore rules protecting credentials and artifacts
├── package.json                # Root monorepo workspace scripts
└── README.md                   # Project overview and quickstart
```

---

## 3. Technology Stack & Packages

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 19.x | Declarative component UI |
| **Frontend Tooling** | Vite | 6.x | Dev server and production bundler |
| **Client Routing** | React Router | 7.x | Nested routing and layout rendering |
| **CSS Architecture** | Custom CSS Variables | - | Design tokens tailored to Indian travel aesthetic |
| **Backend Runtime** | Node.js | 22.x LTS | Server runtime |
| **Web Server** | Express | 4.x | REST API router |
| **Session Middleware** | express-session | 1.18.x | Server-managed session store |
| **Session Persistence** | connect-mongo | 5.1.x | MongoDB session persistence |
| **Password Hashing** | bcryptjs | 2.4.x | 12 salt rounds hashing |
| **Database ODM** | Mongoose | 8.x | Schema modeling, indexes, atomic transactions |
| **Realtime Engine** | Socket.IO | 4.x | WebSocket support for future Trip Rooms |
| **Test Framework** | Node Native Test Runner | - | Built-in test execution (`node:test`) |
| **HTTP Assertion** | Supertest | 7.x | Integration testing without server port binding |
| **In-Memory Database** | mongodb-memory-server | 10.x | Isolated in-memory MongoDB runner for tests |

---

## 4. Data Models & Separation of Concerns

### 1. User Model (`server/src/models/User.js`)
Sensitive security credentials and account status. Separated from public profiles.

### 2. Profile Model (`server/src/models/Profile.js`)
Public traveller bio, location, languages, travel interests, and ID verification status.

### 3. Trip Model (`server/src/models/Trip.js`)
Defines the journey metadata, route logistics, cost splits, capacity limits, and lifecycle status:
- `title`: String (5-120 chars, required).
- `description`: String (20-3000 chars, required).
- `category`: Enum `['trekking', 'hiking', 'backpacking', 'road trip', 'weekend getaway', 'sightseeing', 'camping', 'other']`.
- `startingCity`: String (1-100 chars, required).
- `meetingPoint`: String (1-200 chars, required).
- `destination`: String (1-100 chars, required).
- `intermediateStops`: Array of strings.
- `startDate` & `endDate`: Date objects (validated: `endDate >= startDate`).
- `budget`: Subdocument with `amount` (non-negative Number), `currency` (default `'INR'`), `included` (array of strings), `excluded` (array of strings).
- `itinerary`: Array of subdocuments `{ day: Number, title: String, description: String }`.
- `maxGroupSize`: Number between 2 and 50 (inclusive of host).
- `approvedMembersCount`: Concurrency-safe counter tracking confirmed joiners (excludes the host).
- `joinPolicy`: Enum `['approval_required', 'direct_join']`.
- `status`: Enum `['draft', 'published', 'cancelled', 'completed']`.
- `organiser`: ObjectId reference to User.
- Compound Indexes: `{ status: 1, startDate: 1 }`, `{ status: 1, destination: 1 }`, `{ status: 1, category: 1 }`, `{ status: 1, 'budget.amount': 1 }`.

### 4. TripMembership Model (`server/src/models/TripMembership.js`)
Tracks individual traveller participation, join requests, reviews, and membership history:
- `trip`: ObjectId reference to Trip.
- `traveller`: ObjectId reference to User.
- `status`: Enum `['pending', 'approved', 'rejected', 'withdrawn']`.
- `requestMessage`: String (up to 500 characters).
- `decisionReason`: String (up to 500 characters, host feedback).
- `requestedAt`: Timestamp.
- `decidedAt`: Timestamp.
- `decidedBy`: ObjectId reference to User (the organiser).
- **Unique Compound Index**: `{ trip: 1, traveller: 1 }` enforces at the database engine level that duplicate memberships cannot be created for the same user on the same trip.

### 5. Notification Model (`server/src/models/Notification.js`)
Stores user-specific platform events (e.g., `join_request_received`, `request_approved`, `request_rejected`, `trip_cancelled`).

---

## 5. Concurrency-Safe Group Capacity Management

A critical challenge in travel applications is preventing simultaneous join requests from overfilling group capacity. TripZa implements an atomic database-level concurrency guard:

1. **Host Capacity Model**: The organiser is the trip creator. Available applicant spots equals `maxGroupSize - 1`.
2. **Atomic Increment upon Join / Approval**:
   Instead of checking the count and later saving the document in separate steps, TripZa executes:
   ```javascript
   const maxJoiners = Math.max(1, trip.maxGroupSize - 1);
   const updatedTrip = await Trip.findOneAndUpdate(
     { _id: tripId, status: 'published', approvedMembersCount: { $lt: maxJoiners } },
     { $inc: { approvedMembersCount: 1 } },
     { new: true }
   );
   ```
   If two requests arrive concurrently when 1 spot remains, MongoDB's atomic document locking ensures only the first operation satisfies `{ approvedMembersCount: { $lt: maxJoiners } }` and succeeds. The second receives `null`, immediately failing with a `400 TRIP_FULL` error without overbooking.
3. **Atomic Decrement upon Member Departure**:
   When an approved traveller withdraws or leaves, `approvedMembersCount` is decremented safely:
   ```javascript
   await Trip.findByIdAndUpdate(tripId, { $inc: { approvedMembersCount: -1 } });
   ```

---

## 6. Trip Discovery & Multi-Parameter Search

Public discovery (`GET /api/trips`) provides high-performance searching across published trips:
- **Status Filter**: Only `status: 'published'` trips are returned to the public. `draft` trips are accessible exclusively to their creator.
- **Search Query (`q`)**: Case-insensitive partial matching across `title`, `destination`, `startingCity`, and `description`.
- **Category Filter**: Matches specific travel types (`trekking`, `road trip`, etc.).
- **Budget Boundaries**: Filters by `maxBudget` (`$lte`) and `minBudget` (`$gte`).
- **Date Filter**: Filters trips departing on or after `startDate` (`$gte`).
- **Available Spots Only**: When `availableOnly=true`, filters trips where spots remain.
- **Sorting Options**: `departure_asc`, `departure_desc`, `budget_asc`, `budget_desc`, `newest`.
- **Query Sanitization**: All incoming query arguments are sanitized via `validateDiscoveryQuery` in `tripValidator.js` to strip regex metacharacters and prevent NoSQL operator injection.

---

## 7. Authentication, Session & CSRF Architecture

### Server-Managed Sessions
- **Session Storage**: Persisted in MongoDB via `connect-mongo` under `sessions` with TTL expiration.
- **Session Fixation Defense**: Mandatory `req.session.regenerate()` upon login and registration.
- **Session Invalidation**: Complete `destroy()` and cookie clearance on logout.
- **Cookie Attributes**: `HttpOnly: true`, `SameSite: 'lax'`, `Secure: isProduction`, `Path: '/'`.
- **Double-Submit CSRF**: Unpredictable token stored in session and cookie; validated on all mutating requests (`POST`, `PATCH`, `DELETE`).
- **Zero LocalStorage Policy**: No tokens, sessions, or passwords ever reside in browser storage.

---

- Organisers can approve or reject pending requests with an optional explanatory note.

---

## 9. Private Trip Rooms & Real-Time Messaging (Prompt 4)

### Room Identity & Scoping
- Each journey maps to exactly one private Trip Room, deterministically keyed by its `tripId`.
- **Strict Authorization**: Access is strictly limited to:
  1. The trip organiser; OR
  2. Confirmed travellers with `TripMembership` status `'approved'`.
- All pending applicants, rejected users, withdrawn members, and non-members are blocked from reading room metadata, viewing history, or joining Socket.IO rooms.

### Socket.IO Authentication & Lifecycle
- **Session-Based Handshake**: Socket connections are authenticated against the server's session store via shared `sessionMiddleware`. Unauthenticated connections are rejected with `AUTHENTICATION_REQUIRED`.
- **Zero Client Identity Trust**: Sockets extract identity solely from `socket.request.session.userId`. Client-supplied IDs in event payloads are ignored.
- **Scythed Room Events**:
  - `trip-room:join` (`{ tripId }`): Verifies access; joins socket channel `trip:${tripId}`.
  - `trip-room:leave` (`{ tripId }`): Leaves room channel.
  - `trip-room:message` (`{ tripId, text }`): Authorizes sender, validates length (1-2000 chars), enforces rate limits (max 5 msgs per 3s), persists in MongoDB `TripMessage`, and broadcasts `trip-room:message:new` exclusively to `trip:${tripId}`.
  - `trip-room:typing` (`{ tripId, isTyping }`): Broadcasts typing status to room peers.
  - `trip-room:read` (`{ tripId, messageId }`): Emits read event to room peers.

### Message History REST Endpoints & Dual Delivery
- `GET /api/trips/:tripId/room`: Metadata and companion roster for authorized members.
- `GET /api/trips/:tripId/messages`: Cursor-based chronological history with `before` and `limit`.
- `POST /api/trips/:tripId/messages`: HTTP message creation with instant WebSocket broadcast to active socket clients.
- `POST /api/trips/:tripId/messages/:messageId/report`: Moderation reporting foundation.

### Lifecycle & Cancellation Policy
- When a trip status is `cancelled`, the Trip Room automatically transitions to an **archived, read-only state**:
  - Existing message history remains readable to confirmed members.
  - New message submissions via Socket.IO and REST are blocked with `TRIP_CANCELLED`.


