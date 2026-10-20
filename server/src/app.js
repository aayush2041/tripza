import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/api.js';

const app = express();

// 1. Security Headers (Helmet)
app.use(securityHeaders);

// 2. Strict CORS policy
const allowedOrigins = config.clientOrigin.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server) in dev
      if (!origin && !config.isProduction) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin '${origin}' is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Body parsers with strict size limits to prevent payload exhaustion attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Rate Limiting for all /api endpoints
app.use('/api', apiRateLimiter);

// 5. Mount API routes
app.use('/api', apiRouter);

// 6. Handle unmatched routes (404)
app.use(notFoundHandler);

// 7. Centralized Error Handler
app.use(errorHandler);

export default app;
