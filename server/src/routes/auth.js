import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  getCsrfToken,
} from '../controllers/authController.js';
import { requireAuth, authRateLimiter } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

// CSRF token retrieval
router.get('/csrf-token', getCsrfToken);

// Authentication endpoints
router.post('/register', authRateLimiter, verifyCsrf, register);
router.post('/login', authRateLimiter, verifyCsrf, login);
router.post('/logout', verifyCsrf, logout);
router.get('/me', requireAuth, getMe);

export default router;
