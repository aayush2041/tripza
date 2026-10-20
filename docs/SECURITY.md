# TripZa — Security Baseline, Threat Modeling & Policy

## 1. Security Philosophy & Honest Disclaimer

> **Important**: No application is ever "fully secure" or impervious to threats. Security is an ongoing, defense-in-depth engineering discipline. This document catalogs the active security controls implemented in **Prompt 1 (Foundation)** and **Prompt 2 (Authentication & Profiles)**, architectural decisions taken, and current limitations that will be addressed in upcoming phases.

---

## 2. Active Security Controls

### A. HTTP Security Headers (Helmet)
Configured in `server/src/middleware/securityHeaders.js`:
- **Content-Security-Policy (CSP)**: Strict source allowlists; disallows framing (`frame-ancestors 'none'`) and object injection (`object-src 'none'`).
- **X-Frame-Options: DENY**: Protects against clickjacking attacks.
- **X-Content-Type-Options: nosniff**: Prevents MIME-sniffing exploits.
- **Strict-Transport-Security (HSTS)**: 1-year duration with subdomains and preload (`max-age=31536000; includeSubDomains; preload`).
- **Referrer-Policy**: `strict-origin-when-cross-origin`.
- **Hide Powered-By**: Prevents backend framework profiling.

### B. Cross-Origin Resource Sharing (CORS) & Origin Validation
Configured in `server/src/app.js` and `server/src/middleware/csrf.js`:
- Origins are parsed and strictly matched by URL origin (`originUrl.origin === allowedUrl.origin`) against configured `CLIENT_ORIGIN` (default: `http://localhost:5173`). Substring and prefix confusion attacks (`http://localhost:5173.attacker.evil`) are strictly blocked.
- Wildcards (`*`) with credentials are completely disabled.
- Mutating cross-origin requests from unapproved domains are rejected with `403 ORIGIN_FORBIDDEN`.

### C. Server-Managed Sessions & Cookie Security
Configured in `server/src/app.js` and `server/src/controllers/authController.js`:
- **Session Identification**: Unguessable cryptographically random identifiers managed by `express-session`.
- **MongoDB Persistence**: Sessions stored in MongoDB via `connect-mongo` (`sessions` collection) with 7-day TTL.
- **Cookie Attributes**:
  - `HttpOnly: true`: JavaScript in the browser cannot access session cookies, neutralizing token theft via XSS.
  - `SameSite: 'lax'`: Mitigates cross-site request forgery attacks.
  - `Secure: config.isProduction`: Transmitted strictly over HTTPS in production.
  - `Path: '/'`.
- **Session Fixation Defense**: Mandatory `req.session.regenerate()` is executed upon successful login and registration.
- **Session Invalidation**: Complete `req.session.destroy()` and cookie clearance on logout.
- **Zero LocalStorage Tokens**: No authentication tokens or credentials exist in browser `localStorage`.

### D. CSRF Protection (Double-Submit Token Pattern)
Configured in `server/src/middleware/csrf.js` and `client/src/services/api.js`:
- An unpredictable token (`crypto.randomBytes(32).toString('hex')`) is stored in `req.session.csrfToken`.
- Mirrored in a client-readable cookie (`tripza_csrf`) and exposed via `GET /api/auth/csrf-token`.
- On state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`), the client must provide the token in the `X-CSRF-Token` header.
- Requests with mismatched or missing tokens are immediately blocked with `403 CSRF_INVALID`.

### E. Password Security & Generic Error Responses
Configured in `server/src/models/User.js` and `server/src/controllers/authController.js`:
- Passwords hashed using `bcrypt` with work factor 12. Plaintext passwords are never persisted.
- `passwordHash` field is marked `select: false` on the Mongoose schema, preventing accidental query exposure.
- Login failures return a generic error: `"Invalid email or password."` to prevent user account enumeration.
- Registration duplicate email attempts return a clean `409 Conflict` without leaking internal database error traces.

### F. Mass Assignment & Input Sanitization
Configured in `server/src/validators/authValidator.js` and `server/src/validators/profileValidator.js`:
- Strict whitelisting on registration (`fullName`, `email`, `password`) and profile updates (`fullName`, `bio`, `homeCity`, `travelInterests`, `languages`, `profilePhotoUrl`).
- Any attempt by clients to pass `role`, `accountStatus`, `verification`, or internal IDs is strictly stripped.

### G. Rate Limiting & DoS Protection
- General API limiter (`/api`): 100 requests per 15 minutes.
- Auth limiter (`/api/auth/register`, `/api/auth/login`): 10 attempts per 15 minutes per IP.
- Request body size capped at `10kb` to eliminate memory exhaustion attacks.

### H. Data Minimization & Privacy
- Sensitive personal data (emergency contacts, national IDs, residential addresses, dates of birth) is **not collected** in this phase.
- Public profile endpoint (`GET /api/profiles/:id`) projects only safe community fields via `profile.toPublicJSON()`.
- Public trip endpoints (`GET /api/trips`, `GET /api/trips/:id`) do not expose applicant lists or private join request notes. Join requests are visible strictly to the trip host (`GET /api/trips/:id/requests`).

### I. Resource Ownership & Authorization Controls (Prompt 3)
- **Trip Editing & Cancellation**: Enforced on the server. `Trip.findById()` compares `trip.organiser.toString() === req.user._id.toString()`. Unauthorized modifications return `403 FORBIDDEN`.
- **Join Request Decisions**: Only the verified host of a trip can approve or reject join requests (`approveJoinRequest`, `rejectJoinRequest`).
- **Publishing Gatekeeper**: Publishing trips (`POST /api/trips` with `status: 'published'` or `POST /api/trips/:id/publish`) requires `profile.verification.status === 'verified'`. Unverified users are blocked with `403 FORBIDDEN` while being permitted to save drafts.

### J. Concurrency Safety & Race Condition Defenses (Prompt 3)
- **Atomic Capacity Increment**: Direct joins and host approvals execute atomic MongoDB queries:
  `Trip.findOneAndUpdate({ _id: tripId, status: 'published', approvedMembersCount: { $lt: maxJoiners } }, { $inc: { approvedMembersCount: 1 } })`.
  This guarantees that concurrent join requests can never exceed group capacity (`maxGroupSize`).
- **Compound Uniqueness Constraints**: `TripMembership` enforces `{ trip: 1, traveller: 1 }` with a unique index, preventing duplicate membership requests or double-joining.

### K. NoSQL Injection & ReDoS Defenses (Prompt 3)
### L. Socket.IO Authentication & Trip Room Security (Prompt 4)
- **Session-Bound Socket Handshake**: Sockets authenticate exclusively via server-managed session cookies (`tripza_sid`). Unauthenticated connections are rejected at the handshake stage with `AUTHENTICATION_REQUIRED`.
- **Zero Identity Trust**: Sender identity is resolved solely from `socket.data.user._id` populated from the verified session. Client attempts to supply custom sender IDs or privileges are completely ignored.
- **Continuous Authorization**: Every HTTP endpoint (`/room`, `/messages`) and every Socket.IO event (`trip-room:join`, `trip-room:message`, `trip-room:typing`, `trip-room:read`) re-verifies that the user is the active organiser or an approved member (`TripMembership` status `'approved'`).
- **Immediate Revocation**: If a member leaves, withdraws, or is removed, subsequent access is immediately denied (`403 FORBIDDEN`).
- **Room Isolation**: Socket broadcasts (`trip-room:message:new`) are strictly confined to the specific room channel `trip:${tripId}`. Sockets cannot join or receive events from rooms they do not belong to.
- **Chat Flooding & Rate Limiting**: Per-user sliding-window rate limit enforces a maximum of 5 messages per 3 seconds.
- **Message Length & Buffer Limits**: Message text is restricted between 1 and 2000 characters. Socket payload buffer is capped at 100 KB.
- **Stored XSS Prevention**: Message text is rendered as plain text nodes in React (`{msg.message}`), completely disallowing `dangerouslySetInnerHTML` or HTML execution.
- **Read-Only Archiving**: Cancelled trips transition the room into read-only mode. New message submissions return `TRIP_CANCELLED`.

### M. Encryption & Privacy Transparency
> **No End-to-End Encryption (E2EE) Claim**: TripZa uses standard transport-layer security (TLS/HTTPS in production and authenticated WSS) combined with server-side authorization controls. Messages are stored on the server for persistence and member retrieval. TripZa does not claim or provide end-to-end encryption.

---

## 3. Threat Modeling & Controls Summary

| Threat | Impact | Active Mitigation Strategy | Status |
| :--- | :--- | :--- | :--- |
| **Token Theft via XSS** | High | `HttpOnly`, `SameSite=Lax`, `Secure` session cookies; zero tokens in `localStorage`. | **Implemented & Verified** |
| **Session Fixation** | High | `req.session.regenerate()` after login & registration. | **Implemented & Verified** |
| **CSRF** | High | Double-Submit `X-CSRF-Token` header check + Origin verification. | **Implemented & Verified** |
| **Account Enumeration** | Low-Med | Generic login errors; email normalization. | **Implemented & Verified** |
| **Credential Cracking** | High | Bcrypt work factor 12; auth endpoint rate limiting (10 per 15m). | **Implemented & Verified** |
| **Privilege Escalation** | High | Strict field whitelisting on updates; CLI-only admin provisioning. | **Implemented & Verified** |
| **Self-Verification Fraud**| High | Verification status immutable via profile updates; review requires `admin`. | **Implemented & Verified** |
| **NoSQL Injection / ReDoS** | High | Strict Mongoose typed schemas, regex metacharacter escaping, query parameter sanitization. | **Implemented & Verified** |
| **Overbooking Race Conditions** | High | Atomic MongoDB `$inc` with `$lt` capacity condition; prevents double-booking. | **Implemented & Verified** |
| **Trip Hijacking** | High | Server-side resource ownership checks on edit, cancel, and applicant decisions. | **Implemented & Verified** |
| **Unauthorized Publishing** | Medium | Server-side `requireVerifiedTraveller` check prevents unverified accounts from publishing. | **Implemented & Verified** |
| **Applicant Data Leak** | Medium | Public endpoints strip join requests; accessible exclusively to host. | **Implemented & Verified** |
| **Unauthorized Room Access**| High | Strict server-side verification: host or approved member only. | **Implemented & Verified** |
| **Socket Impersonation** | High | Client-supplied sender IDs rejected; identity bound strictly to server session. | **Implemented & Verified** |
| **Cross-Trip Broadcast Leak**| High | Sockets isolated into `trip:${tripId}` channels; verified membership on join. | **Implemented & Verified** |
| **Chat Spam / Flooding** | Medium | In-memory sliding rate limiter (5 msgs/3s) and 2000 character cap. | **Implemented & Verified** |
| **Stored XSS via Messages** | High | Pure React text rendering without raw HTML interpretation. | **Implemented & Verified** |
| **Credential Leak in Logs** | Medium | Automated regex credential sanitizer in `logger.js`. | **Implemented & Verified** |

---

### N. Centralized Reporting, Abuse Prevention & Confidentiality
- **Confidential Reporting**: Reporter user IDs are never disclosed to reported users in any API response or notification.
- **Strict Role Boundaries**: Moderation queues (`/api/admin/reports`) and restricted moderator notes (`moderatorNotes`, select: false) are protected by `requireAuth` + `requireAdmin`.
- **Anti-Spam Controls**: Duplicate open report submissions (`{ reporter, targetType, targetId, status: ['open', 'under_review'] }`) are rejected with `409 Conflict`.
- **Audit Logging**: Resolution actions (`resolvedBy`, `resolvedAt`, `resolutionAction`, `moderatorNotes`) maintain an immutable moderation history.
- **Account Suspension & Socket Eviction**: When a user account status is set to `'suspended'`, `disconnectUserSockets(userId)` terminates all active WebSocket sessions immediately, and subsequent authentication/session checks reject access with `403 ACCOUNT_SUSPENDED`.

### O. Blocking Mechanics, Data Isolation & Privacy Guarantees
- **Server-Side Enforcement**: Block relationships are verified at the database query and service layer via `isBlocked(userA, userB)`.
- **Direct Interaction Prohibition**: Blocked relationships block join requests (`POST /api/trips/:id/join` -> `403 BLOCKED_INTERACTION`).
- **No Silent Group Mutation**: Blocking another user does not silently alter or drop active trip memberships. Organiser moderation or explicit member withdrawal is required to keep group travel records auditable and transparent.
- **Shared Room Safety Balance**: If two users share membership in an existing group expedition, room messages remain visible to preserve group logistics and safety, avoiding dangerous coordination blindspots.

### P. Notification Access Controls & Privacy Enforcement
- **Recipient Ownership**: All notification queries enforce `recipient: req.user._id`. Users cannot inspect or mark as read notifications belonging to others.
- **In-App Delivery Only**: To prevent privacy leaks or fake delivery promises, all notifications are persisted exclusively in MongoDB and delivered via authenticated in-app APIs. No unconfigured third-party email/SMS gateways are faked.

---

## 4. Current Limitations & Roadmap

1. **Identity Provider Integration (DigiLocker / Gov KYC)**:
   - Live integration with a licensed Indian KYC partner (DigiLocker via Setu/Cashfree API) is deferred to future production deployment.
   - Currently operating on a documented **manual verification review workflow** with administrative oversight.
2. **Multi-Factor Authentication (MFA)**:
   - SMS/TOTP MFA is not yet implemented and is scheduled for high-privilege administrative accounts prior to production launch.
3. **Database Offline Mode**:
   - In local development without MongoDB running, health checks report `degraded` and database-dependent features fail gracefully with descriptive error feedback.
4. **End-to-End Encryption (E2EE)**:
   - Chat is encrypted in transit (TLS) and stored securely with server-managed access controls, but is intentionally not end-to-end encrypted to allow offline message synchronization and reported content moderation.

---

## 5. Security Checklist Status

- [x] No secrets tracked in Git.
- [x] Helmet security headers active (CSP, nosniff, frameguard).
- [x] Strict CORS origin validation.
- [x] Rate limiting active across all API and sensitive auth endpoints.
- [x] Safe error handling suppressing internal traces in production.
- [x] Sensitive credential scrubbing in application logs.
- [x] Server-managed session store with MongoDB (`connect-mongo`).
- [x] `HttpOnly`, `SameSite: 'lax'`, `Secure` cookie attributes.
- [x] CSRF protection via synchronizer token pattern (`X-CSRF-Token`).
- [x] Bcrypt password hashing (work factor 12).
- [x] Mass assignment defenses on registration, login, and profile updates.
- [x] Role-based authorization middleware (`requireAuth`, `requireAdmin`, `requireVerifiedTraveller`).
- [x] Safe CLI-only administrator provisioning script.
- [x] Resource ownership enforcement on trip updates, cancellations, and decisions.
- [x] Concurrency-safe capacity increments preventing overbooking.
- [x] Unique compound indexes preventing duplicate join requests.
- [x] NoSQL injection and ReDoS protection on discovery search parameters.
- [x] Session-authenticated Socket.IO connections (unauthenticated rejected).
- [x] Strict room authorization (only host and approved members).
- [x] Client spoofing protection (server-bound session identity).
- [x] Cross-room broadcast isolation.
- [x] Chat rate limiting (5 msgs per 3s) and message length limits (2000 chars).
- [x] Stored XSS defense via safe text rendering.
- [x] Read-only archival policy on cancelled trips.
- [x] Confidential safety reporting system for users, trips, and messages.
- [x] Protected admin moderation queue with audit trail notes.
- [x] Content removal masking harmful messages across history.
- [x] Account suspension with real-time socket disconnection.
- [x] User blocking with interaction prevention on join requests.
- [x] In-app notification ownership isolation and bulk read state.
- [ ] Automated DigiLocker / Government ID API integration (Phase 2+ roadmap).
- [ ] TLS / HTTPS production termination (Deployment phase).
