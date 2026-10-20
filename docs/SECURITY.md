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
- Origins are matched against configured `CLIENT_ORIGIN` (default: `http://localhost:5173`).
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
| **NoSQL Injection** | High | Strict Mongoose typed schemas; parameterized queries; input validators. | **Implemented & Verified** |
| **Credential Leak in Logs** | Medium | Automated regex credential sanitizer in `logger.js`. | **Implemented & Verified** |

---

## 4. Current Limitations & Roadmap

1. **Identity Provider Integration (DigiLocker / Gov KYC)**:
   - Live integration with a licensed Indian KYC partner (DigiLocker via Setu/Cashfree API) is deferred to future production deployment.
   - Currently operating on a documented **manual verification review workflow** with administrative oversight.
2. **Multi-Factor Authentication (MFA)**:
   - SMS/TOTP MFA is not yet implemented and is scheduled for high-privilege administrative accounts prior to production launch.
3. **Database Offline Mode**:
   - In local development without MongoDB running, health checks report `degraded` and database-dependent features fail gracefully with descriptive error feedback.

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
- [ ] Automated DigiLocker / Government ID API integration (Phase 2+ roadmap).
- [ ] TLS / HTTPS production termination (Deployment phase).
