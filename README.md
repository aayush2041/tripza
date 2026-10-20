# TripZa — India-First Travel Community Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-v22.x%20LTS-green)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-v19.x-blue)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-v6.x-purple)](https://vitejs.dev/)
[![Express Version](https://img.shields.io/badge/Express-v4.x-lightgrey)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(60%2F60)-brightgreen)](https://github.com/)

**TripZa** is a trusted, community-first travel platform built for Indian travellers. It enables verified members to discover travel companions, publish road trips and treks (from Spiti and Ladakh to the Western Ghats and coastal Konkan), manage join requests, coordinate in private real-time Trip Rooms, and explore India safely together.

---

## Status & Implemented Features

### Prompt 1: Project Foundation & Security Baseline
- [x] **Monorepo Architecture**: Clean separation between `client/` and `server/`.
- [x] **Frontend Shell**: Responsive React + Vite application with India-first CSS design tokens, Header, Footer, navigation placeholders, and live system diagnostics.
- [x] **Backend API & Sockets**: Express.js REST API with Helmet security headers, strict CORS, rate limiting, and Socket.IO initialization for future Trip Room messaging.
- [x] **Honest Database Telemetry**: Mongoose configuration with live connection state tracking; reports database availability honestly on `GET /api/health` without silent failure or fake success.
- [x] **Security Baseline**: Zero hardcoded credentials, safe logger filtering secrets, strict body size caps, and centralized error handling.

### Prompt 2: Secure Authentication & Verified Profiles
- [x] **Separation of Account & Profile**: `User` model handles credentials and auth; `Profile` model handles public community data and verification status.
- [x] **Server-Managed Sessions**: Backed by MongoDB via `connect-mongo`, using `HttpOnly`, `SameSite: 'lax'`, and `Secure` cookies. Zero tokens in `localStorage`.
- [x] **Session Fixation Defense**: Mandatory `req.session.regenerate()` upon successful login and registration.
- [x] **CSRF Defense**: Double-submit synchronizer token pattern (`X-CSRF-Token` header validation) and strict Origin checking.
- [x] **Password Security**: Bcrypt with work factor 12. `passwordHash` hidden by default (`select: false`). Generic login errors preventing user enumeration.
- [x] **Mass Assignment Protections**: Field whitelisting prevents tampering with roles, account statuses, or verification states.
- [x] **Profile Verification Workflow**: Explicit states (`unverified`, `pending_review`, `verified`, `rejected`). Submission endpoint and administrative review mechanism.
- [x] **Safe Admin Provisioning**: CLI-only provisioning script (`server/src/scripts/provisionAdmin.js`); no public elevation endpoints.
- [x] **Interactive Frontend**: Responsive `/login`, `/register`, and `/profile` pages with live verification badge, completeness meter, and reactive session state.

### Prompt 3: Trip Creation, Discovery & Join Requests
- [x] **Trip Data Model**: Rich Mongoose schema for itineraries, Indian routes, budget splits (INR), inclusions/exclusions, and group capacity limits.
- [x] **Trip Membership Model**: Unique compound index `{ trip: 1, traveller: 1 }` preventing duplicate join requests; tracks requests, decisions, and feedback notes.
- [x] **Concurrency-Safe Capacity Tracking**: Atomic conditional updates (`{ approvedMembersCount: { $lt: maxJoiners } }`, `$inc`) guarantee trips are never overfilled by race conditions.
- [x] **Verified Publishing Gatekeeper**: Server-enforced verification requirement — unverified users can save drafts, but only verified travellers can publish trips to the public.
- [x] **Discovery & Search**: Multi-parameter filters (text search `q`, destination, starting city, category, date, budget limits, available spots only) with NoSQL/ReDoS sanitization.
- [x] **Join Policies**: Support for both `approval_required` (with host notes) and `direct_join` (instant confirmation).
- [x] **Host Management & Dashboard**: Interactive `/my-trips` dashboard for managing hosted expeditions (reviewing applicants with approve/reject), joined trips, and personal join requests.
- [x] **Full Frontend Pages**: Responsive `/trips`, `/trips/:id`, `/trips/create`, `/trips/:id/edit`, and `/my-trips` views with real backend integration.
- [x] **In-App Notifications**: Model and endpoints for tracking join request updates, host decisions, and trip cancellations.
- [x] **Comprehensive Test Suite**: **36 passing integration tests** across 4 suites covering all business rules, capacity limits, and security controls.

### Prompt 4: Private Trip Rooms & Real-Time Group Chat
- [x] **Room Access Control**: Strict access checks enforcing that only the trip organiser or active approved members (`status: 'approved'`) can access room history, send messages, or receive real-time updates. Non-members, pending, and rejected users receive 403 Forbidden.
- [x] **Mongoose TripMessage Model**: Schema with sender references, trip IDs, message text (1-2000 chars), timestamps, and moderation state with compound index `{ trip: 1, createdAt: -1 }`.
- [x] **Session-Authenticated Socket.IO**: Shared Express/Mongoose session cookie verification in the Socket.IO handshake (`io.use(sessionMiddleware)`); zero trust for client-supplied user identity.
- [x] **Real-Time Group Chat**: Isolated socket rooms `trip:${tripId}` with instant broadcasting, live typing indicators, and sliding-window rate limiting (max 5 msgs per 3s).
- [x] **Cursor-Based Message Pagination**: Chronological retrieval with reverse-cursor pagination (`before` timestamp/ID) preventing duplicate or skipped messages during high volume.
- [x] **Dual Delivery Architecture**: Socket.IO for real-time interaction with automatic REST HTTP fallback (`POST /api/trips/:tripId/messages`) when WebSocket disconnects or degrades.
- [x] **Archived / Read-Only Policy for Cancelled Trips**: If a trip is cancelled, existing room messages remain readable to confirmed members, but sending new messages is rejected with HTTP 400 (`TRIP_CANCELLED`).
- [x] **Trip Room UI**: Responsive chat room at `/trips/:id/room` featuring live message feed, active member roster sidebar, message reporting modal, typing notifications, and host/member navigation shortcuts.

### Prompt 5: Safety, Reporting, Notifications & Part 1 Integration
- [x] **Centralized Safety Reporting System**: Persistent `Report` schema handling user, trip listing, and chat message reports across 7 standardized categories (`harassment`, `spam`, `misleading`, `impersonation`, `unsafe_conduct`, `inappropriate_content`, `other`). Confidential reporting ensures reporter identity is never revealed to the reported party.
- [x] **Admin Moderation Queue & Action Engine**: Protected endpoints (`/api/admin/reports`, `/api/admin/reports/:id`, `/api/admin/messages/:id/moderate`, `/api/admin/users/:id/status`) allowing admins to review queues, record internal audit notes, issue warnings, mask/remove content, or suspend accounts.
- [x] **Persistent User Blocking**: `Block` model and endpoints (`POST /api/blocks`, `DELETE /api/blocks/:id`, `GET /api/blocks`) preventing blocked interactions. Block relationships prevent users from requesting to join trips hosted by each other without silently corrupting existing group itineraries.
- [x] **Comprehensive In-App Notifications**: Model and paginated notification center at `/notifications` with real-time unread badges, filter tabs, bulk mark-all-read (`PATCH /api/notifications/read-all`), and automatic event triggers for join requests, approvals, rejections, cancellations, trip updates, and member departures.
- [x] **Trip Room Safety & Moderation Masking**: Reported messages directly feed into centralized moderation. Removed messages are automatically masked (`[This message was removed by moderation for violating community guidelines]`), and suspended users are evicted from active WebSocket rooms.
- [x] **Safety & Community Guidelines**: Dedicated page at `/safety` outlining respectful community standards, Indian emergency helpline numbers (112, 1090/1091, 1363, 1070), rendezvous safety, and transparent transport-level encryption disclosures (no fake E2EE claims).
- [x] **Complete Part 1 End-to-End Integration**: Seamless navigation across all 16 user journey steps from registration, verification, trip discovery, booking, room chat, reporting, notifications, and cancellation handling.
- [x] **Full Automated Test Suite**: **60 passing integration tests** across 6 test suites covering safety, reporting, blocking, notifications, room privacy, and trip lifecycles.

---

## Project Structure

```
tripza/
├── client/                     # React 19 + Vite frontend application
│   ├── src/
│   │   ├── components/         # Reusable presentation components (Header, Footer, Card, etc.)
│   │   ├── context/            # React AuthContext managing session state
│   │   ├── hooks/              # Custom React hooks (useAuth)
│   │   ├── layouts/            # Page layouts (RootLayout)
│   │   ├── pages/              # Views (HomePage, LoginPage, RegisterPage, ProfilePage, etc.)
│   │   ├── routes/             # React Router configuration
│   │   ├── services/           # Backend API integration with CSRF token injection (api.js)
│   │   └── styles/             # Design tokens (variables.css) and global CSS
├── server/                     # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── config/             # Strict env validation (env.js) and DB manager (database.js)
│   │   ├── controllers/        # Controllers (auth, profiles, verification, health)
│   │   ├── middleware/         # Helmet, auth, rate limiting, csrf, notFound, errorHandler
│   │   ├── models/             # Mongoose schemas (User.js, Profile.js)
│   │   ├── routes/             # API routing tree (auth.js, profiles.js, verification.js, health.js)
│   │   ├── scripts/            # CLI utilities (provisionAdmin.js)
│   │   ├── sockets/            # Socket.IO initialization
│   │   ├── utils/              # Safe logger with secret sanitization
│   │   └── validators/         # Input validators (authValidator.js, profileValidator.js)
│   └── tests/                  # Automated integration tests (node:test + supertest)
├── docs/                       # Technical architecture & security documentation
│   ├── ARCHITECTURE.md         # System design, data models, auth trade-offs, and verification
│   ├── SECURITY.md             # Security baseline, threat modeling, active defenses, and policy
│   └── DEVELOPMENT.md          # Local developer setup, auth testing, and admin provisioning
├── .editorconfig               # Cross-editor formatting rules
├── .env.example                # Safe environment configuration template
├── .gitignore                  # Git exclusions for secrets, node_modules, and logs
└── package.json                # Root monorepo workspace scripts
```

---

## Quickstart

### 1. Prerequisites
- **Node.js**: v20 or v22 LTS
- **npm**: v10+

### 2. Environment Setup
```bash
# Navigate to the project directory
cd d:\ChaloBuddy.in\tripza

# Copy the environment template
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install --prefix server
npm install --prefix client
```

### 4. Start Development Servers
```bash
# Terminal 1 — Start the backend server (port 5000):
npm run dev:server

# Terminal 2 — Start the frontend client (port 5173):
npm run dev:client
```

Visit:
- **Application**: [http://localhost:5173](http://localhost:5173)
- **Sign In**: [http://localhost:5173/login](http://localhost:5173/login)
- **Register**: [http://localhost:5173/register](http://localhost:5173/register)
- **Traveller Profile**: [http://localhost:5173/profile](http://localhost:5173/profile)
- **Live System Health**: [http://localhost:5173/system-status](http://localhost:5173/system-status)
- **Backend API Health**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev:server` | Starts the Express server with native file watching |
| `npm run dev:client` | Starts the Vite React dev server on port 5173 |
| `npm run test:server` (or `npm test`) | Runs all automated backend and auth integration tests |
| `npm run build:client` (or `npm run build`) | Compiles the React client for production (`client/dist/`) |

---

## Comprehensive Documentation

For detailed architectural designs, threat modeling, and testing guides, review:

- 🏛️ [Architecture & Technical Design](docs/ARCHITECTURE.md)
- 🔒 [Security Baseline & Threat Model](docs/SECURITY.md)
- 🛠️ [Developer Setup & Auth Testing Guide](docs/DEVELOPMENT.md)

---

## License

Private repository. Copyright &copy; TripZa Community.
