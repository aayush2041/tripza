import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory first, fallback to root if not found
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Validates and sanitizes environment configuration on startup.
 * Fails fast with clear, human-readable errors if critical configuration is invalid.
 */
function validateConfig() {
  const errors = [];

  const NODE_ENV = process.env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(NODE_ENV)) {
    errors.push(`NODE_ENV must be one of 'development', 'test', or 'production' (received: '${NODE_ENV}')`);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`PORT must be a valid port number between 1 and 65535 (received: '${process.env.PORT}')`);
  }

  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  if (!CLIENT_ORIGIN) {
    errors.push('CLIENT_ORIGIN is required for CORS configuration');
  }

  const MONGODB_URI = process.env.MONGODB_URI || '';
  // Check if MongoDB URI is provided
  const hasMongoUri = Boolean(MONGODB_URI && MONGODB_URI.trim().length > 0);

  const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_insecure_fallback_secret_must_change_in_production_32chars';
  if (NODE_ENV === 'production') {
    if (!SESSION_SECRET || SESSION_SECRET.length < 32 || SESSION_SECRET.includes('replace_this')) {
      errors.push('SESSION_SECRET must be at least 32 cryptographically secure characters in production');
    }
    if (!hasMongoUri) {
      errors.push('MONGODB_URI is required in production environment');
    }
  }

  const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

  if (errors.length > 0) {
    const errorList = errors.map((err) => `  - ${err}`).join('\n');
    throw new Error(`[Configuration Error] Invalid environment configuration:\n${errorList}\nPlease check your .env file.`);
  }

  return Object.freeze({
    env: NODE_ENV,
    isProduction: NODE_ENV === 'production',
    isTest: NODE_ENV === 'test',
    isDevelopment: NODE_ENV === 'development',
    port: PORT,
    clientOrigin: CLIENT_ORIGIN,
    mongoUri: MONGODB_URI,
    hasMongoUri,
    sessionSecret: SESSION_SECRET,
    rateLimit: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: RATE_LIMIT_MAX,
    },
  });
}

export const config = validateConfig();
