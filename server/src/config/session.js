import session from 'express-session';
import MongoStore from 'connect-mongo';
import { config } from './env.js';

/**
 * Shared session store and options.
 * Enables both Express HTTP requests and Socket.IO connections to share
 * the exact same session storage and authentication state.
 */
export const sessionStore = (config.hasMongoUri && !config.isTest)
  ? MongoStore.create({
      mongoUrl: config.mongoUri,
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60,
      touchAfter: 24 * 3600,
    })
  : new session.MemoryStore();

export const sessionOptions = {
  name: 'tripza_sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  },
};

export const sessionMiddleware = session(sessionOptions);
export default sessionMiddleware;
