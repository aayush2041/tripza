import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let connectionState = {
  status: 'disconnected', // 'connected' | 'connecting' | 'disconnected' | 'error'
  lastError: null,
  connectedAt: null,
};

// Listen to Mongoose connection events
mongoose.connection.on('connected', () => {
  connectionState.status = 'connected';
  connectionState.lastError = null;
  connectionState.connectedAt = new Date().toISOString();
  logger.info('MongoDB connection established successfully.');
});

mongoose.connection.on('error', (err) => {
  connectionState.status = 'error';
  connectionState.lastError = err.message;
  logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  connectionState.status = 'disconnected';
  logger.warn('MongoDB connection disconnected.');
});

/**
 * Connects to MongoDB with safe timeouts and honest error handling.
 * Does not exit the process in development if MongoDB is unavailable,
 * but transparently flags the state so health checks and API clients know.
 */
export async function connectDatabase() {
  if (!config.hasMongoUri) {
    connectionState.status = 'disconnected';
    connectionState.lastError = 'MONGODB_URI is not set in environment';
    logger.warn(
      'MongoDB is not configured (MONGODB_URI is empty). Database features will be unavailable until a valid MongoDB connection string is provided in .env.'
    );
    return false;
  }

  try {
    connectionState.status = 'connecting';
    connectionState.lastError = null;
    logger.info('Connecting to MongoDB...');

    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout so server doesn't hang
      autoIndex: !config.isProduction, // Don't auto-build indexes in production
    });

    return true;
  } catch (error) {
    connectionState.status = 'error';
    connectionState.lastError = error.message;
    logger.error(
      `Failed to connect to MongoDB: ${error.message}. Please verify that MongoDB is running locally or your Atlas cluster is accessible.`
    );
    return false;
  }
}

/**
 * Disconnects from MongoDB gracefully during server shutdown.
 */
export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed gracefully.');
    } catch (err) {
      logger.error(`Error during MongoDB disconnect: ${err.message}`);
    }
  }
  connectionState.status = 'disconnected';
}

/**
 * Returns the current database status for health endpoints and internal diagnostics.
 */
export function getDatabaseStatus() {
  const readyStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const mongooseState = readyStates[mongoose.connection.readyState] || 'unknown';

  return {
    status: connectionState.status,
    readyState: mongooseState,
    isConnected: mongoose.connection.readyState === 1,
    connectedAt: connectionState.connectedAt,
    lastError: connectionState.lastError,
  };
}
