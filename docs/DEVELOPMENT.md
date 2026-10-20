# TripZa — Local Development & Setup Guide

This guide describes how to configure, run, test, and verify the TripZa monorepo locally.

---

## 1. Prerequisites

Ensure your development machine has the following tools installed:

- **Node.js**: `v20.x` or `v22.x` LTS (tested with `v22.14.0`)
- **npm**: `v10.x` or higher
- **Git**: `v2.x`
- **MongoDB** *(Optional for initial shell review, required for database operations)*:
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
> If MongoDB is not yet running on your machine, you can still start and test the backend. The server will start cleanly and report its database status honestly as `status: "disconnected"` on the `GET /api/health` diagnostic endpoint.

### C. Install Dependencies
Install dependencies across both client and server:
```bash
# From the project root:
npm install --prefix server
npm install --prefix client
```

---

## 3. Running Development Servers

### Option 1: Start Backend and Frontend Independently

**Terminal 1 — Backend Server (Express + Socket.IO)**:
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

## 4. Running Automated Tests

Run the backend integration and health check test suite:
```bash
npm run test:server
# or from root:
npm test
```

Expected output:
```
# Subtest: TripZa Configuration Suite
    ok 1 - should load safe default configuration
    ok 2 - should keep secrets out of client-accessible fields
# Subtest: TripZa Backend Foundation & Health Suite
    ok 1 - GET /api/health should respond with 200 and accurate system status
    ok 2 - GET /api should respond with 200 and API metadata
    ok 3 - GET /api/nonexistent-route should respond with 404 and consistent error format
    ok 4 - Should set security headers via Helmet
# pass 6
# fail 0
```

---

## 5. Building for Production

Test that the client bundles cleanly for production deployment:
```bash
npm run build
# Runs 'vite build' inside client/ and generates output in client/dist/
```

---

## 6. Verifying System Health

Open your browser to:
- **Client App**: [http://localhost:5173](http://localhost:5173)
- **System Status Diagnostics Page**: [http://localhost:5173/system-status](http://localhost:5173/system-status)
- **Direct API Health JSON**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

When MongoDB is offline, `GET /api/health` returns:
```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "timestamp": "2026-10-20T...",
    "service": "tripza-backend",
    "environment": "development",
    "server": {
      "status": "healthy",
      "nodeVersion": "v22.14.0",
      "memoryUsageMb": 20
    },
    "database": {
      "status": "disconnected",
      "readyState": "disconnected",
      "connected": false,
      "message": "Database is disconnected. Configure MONGODB_URI in .env to connect."
    }
  }
}
```
As soon as a MongoDB instance is provided in `.env`, the database automatically updates to `status: "ok"` and `connected: true`.
