# TripZa — System Architecture & Technical Design

## 1. Executive Summary

**TripZa** is an India-first travel community platform designed to connect verified travellers, enable collaborative trip publishing, manage join requests, and provide real-time coordination through private Trip Rooms.

This document outlines the architecture, data models, session management, and authorization controls established across **Prompt 1 (Foundation)** and **Prompt 2 (Authentication & Verified Profiles)**.

---

## 2. Monorepo Organization

TripZa uses a clean monorepo architecture separating the browser client from the API backend:

```
tripza/
├── client/                     # Frontend Application (React 19 + Vite 6 + React Router v7)
│   ├── public/                 # Static assets (favicons, icons)
│   ├── src/
│   │   ├── app/                # Application entry configuration
│   │   ├── components/         # Reusable presentation components (Header, Footer, Card, Badge, etc.)
│   │   ├── context/            # React Contexts (AuthContext for reactive session state)
│   │   ├── hooks/              # Custom React hooks (useAuth)
│   │   ├── layouts/            # Page shell layouts (RootLayout)
│   │   ├── pages/              # Routed page views (HomePage, LoginPage, RegisterPage, ProfilePage, etc.)
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
│   │   ├── controllers/        # Request/response controllers (auth, profiles, verification, health)
│   │   ├── middleware/         # Security headers, auth, rate limiting, csrf, notFound, errorHandler
│   │   ├── models/             # Mongoose schemas (User.js, Profile.js)
│   │   ├── routes/             # Express API routing tree (auth.js, profiles.js, verification.js, health.js)
│   │   ├── scripts/            # CLI utilities (provisionAdmin.js)
│   │   ├── services/           # Encapsulated business logic (healthService.js)
│   │   ├── sockets/            # Socket.IO initialization and Trip Room room management
│   │   ├── utils/              # Safe logger and sanitizer utilities
│   │   ├── validators/         # Input validation schemas (authValidator.js, profileValidator.js)
│   │   ├── app.js              # Express app definition (pure, testable)
│   │   └── server.js           # Server bootstrap and graceful shutdown listeners
│   ├── tests/                  # Automated integration tests (node:test + supertest + MongoMemoryServer)
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
| **Database ODM** | Mongoose | 8.x | Schema modeling and database access |
| **Realtime Engine** | Socket.IO | 4.x | WebSocket support for future Trip Rooms |
| **Test Framework** | Node Native Test Runner | - | Built-in test execution (`node:test`) |
| **HTTP Assertion** | Supertest | 7.x | Integration testing without server port binding |
| **In-Memory Database** | mongodb-memory-server | 10.x | Isolated in-memory MongoDB runner for tests |

---

## 4. Data Models & Separation of Concerns

To protect user privacy and prevent data leakage, authentication credentials are strictly separated from public traveller profile data:

### 1. User Model (`server/src/models/User.js`)
Stores sensitive account and security metadata only:
- `email`: Normalized lowercase string, RFC 5322 regex validated, unique index.
- `passwordHash`: Bcrypt hash (work factor 12), configured with `select: false` to ensure queries never return it by default.
- `role`: Enum `['traveller', 'admin']` (default: `'traveller'`).
- `accountStatus`: Enum `['active', 'suspended', 'deactivated']` (default: `'active'`).
- `emailVerified`: Boolean (default: `false`).
- `lastLoginAt`: Timestamp.
- `timestamps`: `createdAt`, `updatedAt`.
- `toJSON` transform: Explicitly purges `passwordHash` and `__v`.

### 2. Profile Model (`server/src/models/Profile.js`)
Encapsulates public and community-facing traveller data:
- `user`: 1-to-1 ObjectId reference to User, unique index.
- `fullName`: String (2-100 characters, required).
- `bio`: String (max 500 characters, optional).
- `homeCity`: String (max 100 characters, optional).
- `travelInterests`: Array of strings (e.g., `['Trekking', 'Coastal Drives', 'Camping']`).
- `languages`: Array of strings (e.g., `['Hindi', 'English', 'Marathi']`).
- `profilePhotoUrl`: String (URL, optional).
- `verification`: Embedded subdocument:
  - `status`: Enum `['unverified', 'pending_review', 'verified', 'rejected']` (default: `'unverified'`).
  - `submittedAt`: Timestamp.
  - `reviewedAt`: Timestamp.
  - `reviewedBy`: ObjectId reference to reviewing Admin User.
  - `rejectionReason`: Reason text (cleared on new submission).
  - `reviewNotes`: Internal administrative notes.
- `completenessPercentage`: Virtual property computing profile completeness from 20% to 100%.
- `toPublicJSON()`: Strict projection excluding `reviewedBy`, `reviewNotes`, and `rejectionReason`.

> **Data Minimization Guarantee**: No national identity numbers (Aadhaar/PAN), home addresses, emergency contact phone numbers, or dates of birth are collected at this stage.

---

## 5. Authentication, Session & CSRF Architecture

### Server-Managed Sessions
- **Session ID Generation**: Cryptographically secure, unguessable session tokens managed by `express-session`.
- **Session Storage**: Sessions are persisted in MongoDB via `connect-mongo` under the `sessions` collection with automatic TTL expiration (7 days).
- **Session Fixation Defense**: Mandatory `req.session.regenerate()` is executed upon successful login and registration.
- **Session Invalidation**: Complete `req.session.destroy()` and cookie clearance on logout.
- **Cookie Security Settings**:
  - `httpOnly: true`: Blocks browser JavaScript from accessing the session cookie, defeating token theft via XSS.
  - `sameSite: 'lax'`: Protects against third-party cross-site request forgeries.
  - `secure: config.isProduction`: Enforces HTTPS transmission in production.
  - `path: '/'`.

### Double-Submit Cookie CSRF Protection
1. An unpredictable CSRF token (`crypto.randomBytes(32).toString('hex')`) is stored in `req.session.csrfToken`.
2. The token is set in a client-readable cookie (`tripza_csrf`) and exposed via `GET /api/auth/csrf-token`.
3. On all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`), the frontend API client automatically reads `tripza_csrf` and passes it in the `X-CSRF-Token` header.
4. The server middleware (`verifyCsrf`) verifies that `req.headers['x-csrf-token'] === req.session.csrfToken` and checks the `Origin` header against `CLIENT_ORIGIN`.

### Zero LocalStorage Policy
No authentication tokens, session identifiers, passwords, or secrets are ever written to browser `localStorage` or `sessionStorage`.

---

## 6. Verification & Trust Workflow

TripZa treats verification as an essential trust layer for Indian group travel:

```
[ Unverified ] ──( User submits profile )──> [ Pending Review ]
                                                      │
                            ┌─────────────────────────┴────────────────────────┐
                            ▼                                                  ▼
                     [ Verified ]                                      [ Rejected ]
             (Eligible to host trips)                        (Can update details & re-submit)
```

1. **Initial Registration**: All accounts default to `unverified`.
2. **Submission**: User calls `POST /api/verification/submit`. Profile transitions to `pending_review`.
3. **Manual Review (Phase 2 Baseline)**: Administrators review the submission via `POST /api/verification/review` and approve or reject with documented notes.
4. **Elevation Protection**: Users cannot modify their own verification status or role through profile update endpoints (`PATCH /api/profiles/me` strictly whitelists non-security fields).

### Provisioning the Initial Administrator
To prevent unauthorized privilege escalation, administrator accounts cannot be created via public APIs:
- Administrators are provisioned via a dedicated server CLI script:
  ```bash
  node src/scripts/provisionAdmin.js admin@tripza.in <SecurePassword> "System Administrator"
  ```

---

## 7. Authorization Middleware Foundation

- `requireAuth`: Confirms the presence of an active server session and loads `req.user` and `req.profile`.
- `requireAdmin`: Confirms `req.user.role === 'admin'`.
- `requireVerifiedTraveller`: Confirms `req.profile.verification.status === 'verified'`, prepared as the gatekeeper for future trip publishing in Prompt 3.
- `authRateLimiter`: Enforces a maximum of 10 login/registration attempts per 15 minutes per IP.
