# TripZa — Security Baseline, Threat Modeling & Policy

## 1. Security Philosophy & Honest Disclaimer

> **Important**: No application is ever "fully secure" or impervious to threats. Security is an ongoing, defense-in-depth engineering discipline. This document catalogs the active security controls implemented in **Prompt 1**, architectural decisions taken, and current limitations that will be addressed in upcoming phases.

---

## 2. Active Security Controls (Prompt 1 Foundation)

### A. HTTP Security Headers (Helmet)
Configured in `server/src/middleware/securityHeaders.js`:
- **Content-Security-Policy (CSP)**: Restricts script, style, image, connect, font, and object sources. Disallows framing (`frame-ancestors 'none'`) and object injection (`object-src 'none'`).
- **X-Frame-Options: DENY**: Protects against clickjacking attacks.
- **X-Content-Type-Options: nosniff**: Prevents MIME-sniffing exploits.
- **Strict-Transport-Security (HSTS)**: Configured for 1 year with subdomains and preload (`max-age=31536000; includeSubDomains; preload`).
- **Referrer-Policy**: Set to `strict-origin-when-cross-origin`.
- **Hide Powered-By**: Eliminates `X-Powered-By: Express` header to prevent server profiling.

### B. Cross-Origin Resource Sharing (CORS)
Configured in `server/src/app.js`:
- Origins are strictly matched against the configured `CLIENT_ORIGIN` (default: `http://localhost:5173`).
- Wildcards (`*`) with credentials are completely disabled.
- In production, cross-origin requests from unapproved domains are rejected with an explicit error before request processing.

### C. Rate Limiting & DoS Protection
Configured in `server/src/middleware/rateLimiter.js`:
- Standard API rate limiter caps traffic per IP address (default: 100 requests per 15-minute window).
- Returns HTTP 429 (`TOO_MANY_REQUESTS`) with standard `RateLimit-*` headers.
- In future prompts, stricter limits will be applied to authentication endpoints (e.g., max 5 login attempts per 15 minutes).

### D. Request Body Size Limits
- `express.json({ limit: '10kb' })` and `express.urlencoded({ limit: '10kb' })` prevent Denial of Service via memory exhaustion from oversized request payloads.

### E. Error Handling & Secret Sanitization
Configured in `server/src/middleware/errorHandler.js` and `server/src/utils/logger.js`:
- Production error responses never disclose stack traces, internal database schema details, or system paths.
- The custom logger (`logger.js`) scrubs MongoDB connection URIs containing username/password credentials before writing to output streams.

### F. Environment & Secrets Management
- All secrets reside exclusively in server-side environment variables loaded via `.env`.
- `.env` and local database files are excluded from Git via `.gitignore`.
- Vite client builds only expose variables prefixed with `VITE_`. Server secrets (`SESSION_SECRET`, `MONGODB_URI`) are never bundled into client assets.

---

## 3. Threat Modeling & Protections

| Threat | Impact | Mitigation Strategy | Current Status |
| :--- | :--- | :--- | :--- |
| **Token Theft via XSS** | High | Avoid `localStorage` for tokens; use `HttpOnly`, `SameSite=Lax`, `Secure` cookies. | Architectural standard established; session implementation scheduled for Prompt 2. |
| **NoSQL Injection** | High | Avoid passing unvalidated `req.body` directly into Mongo operators (`$where`, `$regex`, `$gt`). Enforce strict Mongoose schemas and input validation schemas. | Schema and validator structure in place. |
| **Brute Force Attacks** | Medium | IP-based rate limiting via `express-rate-limit`. | Baseline rate limiting active on `/api`. |
| **Clickjacking** | Medium | `X-Frame-Options: DENY` and CSP `frame-ancestors: 'none'`. | Active via Helmet. |
| **Data Leakage in Logs** | Medium | Automated sanitization regex in `logger.js` for DB connection strings and tokens. | Active. |
| **Fake Accounts / Catfishing** | High | Documented identity verification requirement (DigiLocker / Gov ID review) before trip hosting or room access. | Architecture designed; workflow scheduled for Prompt 2. |

---

## 4. Current Limitations & Technical Debt (To Be Addressed)

1. **Authentication Not Yet Activated**:
   - The foundation does not yet handle active user login sessions or CSRF token checks for mutating endpoints (POST/PUT/DELETE) because authentication is out of scope for Prompt 1.
2. **Database Offline State**:
   - Until MongoDB is running and `MONGODB_URI` is configured, database writes are blocked and the health endpoint honestly reports `status: "degraded"`.
3. **Identity Verification Provider Integration**:
   - API integration with a live Indian KYC/DigiLocker partner is deferred to Prompt 2.

---

## 5. Security Checklist for Development & Production

- [x] No secrets tracked in Git.
- [x] Helmet security headers active.
- [x] Strict CORS origin validation.
- [x] Rate limiting active on all API routes.
- [x] Safe error handler hides stack traces in production.
- [x] Logger sanitizes MongoDB credentials and secrets.
- [ ] Session cookie store with MongoDB / Redis backing (Prompt 2).
- [ ] CSRF protection tokens for state-changing endpoints (Prompt 2).
- [ ] Mongoose schema validation for all incoming documents (Prompt 2+).
- [ ] TLS / HTTPS termination in production deployment (Prompt 5).
