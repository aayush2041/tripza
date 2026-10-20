import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
} from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

// Current user profile endpoints
router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, verifyCsrf, updateMyProfile);

// Public profile endpoint
router.get('/:id', getPublicProfile);

export default router;
