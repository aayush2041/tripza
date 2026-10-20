# TripZa — India-First Travel Community Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-v22.x%20LTS-green)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-v19.x-blue)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-v6.x-purple)](https://vitejs.dev/)
[![Express Version](https://img.shields.io/badge/Express-v4.x-lightgrey)](https://expressjs.com/)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(6%2F6)-brightgreen)](https://github.com/)

**TripZa** is a trusted, community-first travel platform built for Indian travellers. It enables verified members to discover travel companions, publish road trips and treks (from Spiti and Ladakh to the Western Ghats and coastal Konkan), manage join requests, coordinate in private real-time Trip Rooms, and explore India safely together.

---

## Foundation Status (Prompt 1)

This repository contains the verified, zero-dependency foundation for TripZa:

- [x] **Monorepo Architecture**: Clean separation between `client/` and `server/`.
- [x] **Frontend Shell**: Responsive React + Vite application with India-first CSS design tokens, Header, Footer, navigation placeholders, and live system diagnostics.
- [x] **Backend API & Sockets**: Express.js REST API with Helmet security headers, strict CORS, rate limiting, and Socket.IO initialization for future Trip Room messaging.
- [x] **Honest Database Telemetry**: Mongoose configuration with live connection state tracking; reports database availability honestly on `GET /api/health` without silent failure or fake success.
- [x] **Security Baseline**: Zero hardcoded credentials, safe logger filtering secrets, strict body size caps, and centralized error handling.
- [x] **Automated Tests**: Integration tests passing via Node's native test runner (`node:test`) and Supertest.

> **Scope Note**: User registration, authentication sessions, trip publishing, join requests, and live chat are scheduled for subsequent prompts (Prompt 2+).

---

## Project Structure

```
tripza/
├── client/                     # React 19 + Vite frontend application
│   ├── src/
│   │   ├── components/         # Reusable presentation components (Header, Footer, Card, etc.)
│   │   ├── layouts/            # Page layouts (RootLayout)
│   │   ├── pages/              # Views (HomePage, ComingSoonPage, SystemStatusPage, NotFoundPage)
│   │   ├── routes/             # React Router configuration
│   │   ├── services/           # Backend API integration (api.js)
│   │   └── styles/             # Design tokens (variables.css) and global CSS
├── server/                     # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── config/             # Strict env validation (env.js) and DB manager (database.js)
│   │   ├── middleware/         # Helmet headers, rate limiting, 404, error handling
│   │   ├── routes/             # API routing tree (api.js, health.js)
│   │   ├── sockets/            # Socket.IO initialization
│   │   └── utils/              # Safe logger with secret sanitization
│   └── tests/                  # Automated integration tests (node:test + supertest)
├── docs/                       # Technical architecture & security documentation
│   ├── ARCHITECTURE.md         # System design, auth trade-offs, and verification strategy
│   ├── SECURITY.md             # Security baseline, threat modeling, and limitations
│   └── DEVELOPMENT.md          # Local developer setup and commands
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
# Clone or navigate to the directory
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
- **Live System Health**: [http://localhost:5173/system-status](http://localhost:5173/system-status)
- **Backend API Health**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev:server` | Starts the Express server with native file watching |
| `npm run dev:client` | Starts the Vite React dev server on port 5173 |
| `npm run test:server` (or `npm test`) | Runs backend integration and health check test suites |
| `npm run build:client` (or `npm run build`) | Compiles the React client for production (`client/dist/`) |

---

## Comprehensive Documentation

For in-depth architectural decisions, security baselines, and implementation roadmaps, review:

- 🏛️ [Architecture & Technical Design](docs/ARCHITECTURE.md)
- 🔒 [Security Baseline & Threat Model](docs/SECURITY.md)
- 🛠️ [Developer Setup Guide](docs/DEVELOPMENT.md)

---

## License

Private repository. Copyright &copy; TripZa Community.
