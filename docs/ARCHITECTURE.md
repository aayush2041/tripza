# TripZa — System Architecture & Technical Design

## 1. Executive Summary

**TripZa** is an India-first travel community platform designed to connect verified travellers, enable collaborative trip publishing, manage join requests, and provide real-time coordination through private Trip Rooms.

This document outlines the foundation architecture established in **Prompt 1**, focusing on modularity, security, honesty in system state reporting, and seamless extensibility for subsequent development phases.

---

## 2. Monorepo Organization

TripZa uses a clean monorepo architecture separating the browser client from the API backend:

```
tripza/
├── client/                     # Frontend Application (React + Vite + JSX)
│   ├── public/                 # Static assets (favicons, icons)
│   ├── src/
│   │   ├── app/                # Application entry configuration
│   │   ├── components/         # Reusable presentation components (Header, Footer, Card, Badge, etc.)
│   │   ├── features/           # Domain feature modules (planned for future prompts)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── layouts/            # Page shell layouts (RootLayout)
│   │   ├── pages/              # Routed page views (HomePage, ComingSoonPage, SystemStatusPage)
│   │   ├── routes/             # Client-side routing table (React Router v7)
│   │   ├── services/           # Network & API abstraction layer (api.js)
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
│   │   ├── controllers/        # Request/response controllers (healthController)
│   │   ├── middleware/         # Security headers, rate limiting, 404, error handlers
│   │   ├── models/             # Mongoose schemas (to be populated in Prompt 2+)
│   │   ├── routes/             # Express API routing tree (api.js, health.js)
│   │   ├── services/           # Encapsulated business logic (healthService)
│   │   ├── sockets/            # Socket.IO initialization and Trip Room room management
│   │   ├── utils/              # Safe logger and sanitizer utilities
│   │   ├── validators/         # Input validation schemas
│   │   ├── app.js              # Express app definition (pure, testable)
│   │   └── server.js           # Server bootstrap and graceful shutdown listeners
│   ├── tests/                  # Automated integration tests (node:test + supertest)
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

## 3. Technology Stack & Rationale

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 19 + JSX | Modern, declarative component-driven UI with high developer velocity. |
| **Frontend Tooling** | Vite 6 | Ultra-fast Hot Module Replacement (HMR) and optimized Rollup production bundling. |
| **Routing** | React Router v7 | Robust client-side navigation with declarative route configuration and nested layouts. |
| **Styling** | Modern CSS Variables | Zero-dependency, performant CSS architecture with an India-first design token system. |
| **Backend Runtime** | Node.js (v22 LTS) | High-throughput asynchronous I/O with native test runner (`node:test`) and modern ES Modules. |
| **Web Framework** | Express 4 | Battle-tested, minimalist REST API routing with comprehensive middleware ecosystem. |
| **Real-time Engine** | Socket.IO 4 | WebSocket abstraction with fallback polling, room namespaces, and heartbeat management. |
| **Database ODM** | MongoDB + Mongoose 8 | Document database ideal for polymorphous travel itineraries, nested member subdocuments, and geospatial queries. |
| **Testing** | Node Native Test Runner + Supertest | Zero extra test runner dependencies, instant startup, and clean HTTP assertion capabilities. |

---

## 4. Authentication Architecture & Security Evaluation

### Selected Approach: Server-Managed Sessions with HTTP-Only Cookies
For the TripZa stack (React SPA + Express REST API), we evaluate two common paradigms:

1. **JWT stored in localStorage**:
   - *Risk*: Highly vulnerable to Cross-Site Scripting (XSS). Any script injected via malicious content or third-party packages can exfiltrate tokens.
   - *Revocation*: Token invalidation before expiry requires complex distributed blacklists.
   - *Decision*: **Rejected**. Storing authentication tokens in `localStorage` is prohibited.

2. **Server-Managed Sessions via HTTP-Only, Secure Cookies (Recommended & Selected)**:
   - *Advantages*: The session identifier is stored in an `HttpOnly`, `SameSite=Lax` (or `Strict`), `Secure` cookie. JavaScript in the browser cannot read this cookie, neutralizing token theft via XSS.
   - *Session Invalidation*: Revoking a compromised session is immediate—the server simply deletes or invalidates the session record in the database/session store.
   - *CSRF Mitigation*: Handled via custom request headers (`X-Requested-With`, `Origin` verification) or standard CSRF tokens.

### Password Cryptography
- No custom cryptography is implemented.
- Password hashing will use **bcrypt** (cost factor 12) or **Argon2id** (memory-hard, resistant to GPU attacks).

### Profile Verification Strategy (Beyond Email)
Email verification only confirms mailbox control; it provides zero assurance against impersonation, catfishing, or fraud in community travel.

For TripZa's India-first context, verification will be built upon:
1. **Established Identity Provider Integration (Phase 2 Roadmap)**:
   - Verification via **DigiLocker** or verified identity APIs (e.g., Cashfree / Setu / HyperVerge KYC).
   - Validates official Government of India IDs (Aadhaar offline XML, Driving License, or Voter ID) without storing unencrypted raw Aadhaar numbers.
2. **Documented Manual Review Workflow**:
   - For travellers preferring manual verification, a secure upload workflow with admin review, selfie match, and emergency contact verification.
   - Clear traveller trust badges (`Verified Traveller`, `Verified Host`) displayed transparently on listings.

---

## 5. Real-Time Communication Architecture (Trip Rooms)

Real-time coordination is built on **Socket.IO**:
- **HTTP Server Attachment**: Socket.IO binds to the core Node HTTP server in `server/src/sockets/index.js`.
- **CORS Alignment**: Strict alignment with `CLIENT_ORIGIN`.
- **Trip Room Namespacing**: Future prompts will isolate chat messages to approved trip members using rooms:
  ```javascript
  io.to(`trip:${tripId}`).emit('new_message', payload);
  ```
- **Access Control**: Socket handshake will validate session cookies before admitting any client to a trip room.

---

## 6. Database Health Reporting Strategy

TripZa strictly adheres to honest telemetry:
- If MongoDB is disconnected or offline, the API does not fabricate successful writes or fail invisibly.
- `GET /api/health` queries Mongoose's live `readyState` and responds with:
  - `status: "ok"` when server and database are healthy.
  - `status: "degraded"` when server is healthy but the database is disconnected, returning clear diagnostic messages.
- Connection strings and credentials are automatically scrubbed from all application logs.
