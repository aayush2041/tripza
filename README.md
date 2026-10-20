# TripZa — India-First Travel Community Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-v22.x%20LTS-green)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-v19.x-blue)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-v6.x-purple)](https://vitejs.dev/)
[![Express Version](https://img.shields.io/badge/Express-v4.x-lightgrey)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(21%2F21)-brightgreen)](https://github.com/)

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
- [x] **Automated Test Suite**: 21 integration tests passing across auth, sessions, CSRF, authorization, and health checks.

> **Scope Note**: Trip creation, join requests, and live Trip Room chat will be introduced in subsequent prompts (Prompt 3+).

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
