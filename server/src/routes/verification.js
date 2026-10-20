import { Router } from 'express';
import {
  submitVerification,
  reviewVerification,
  getPendingVerifications,
} from '../controllers/verificationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

// Submit profile for manual verification review
router.post('/submit', requireAuth, verifyCsrf, submitVerification);

// Retrieve pending verification requests (administrator only)
router.get('/pending', requireAuth, requireAdmin, getPendingVerifications);

// Review verification decision (administrator only)
router.post('/review', requireAuth, requireAdmin, verifyCsrf, reviewVerification);

export default router;
