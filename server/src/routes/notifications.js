import { Router } from 'express';
import { getMyNotifications, markRead } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

router.get('/', requireAuth, getMyNotifications);
router.patch('/:id/read', requireAuth, verifyCsrf, markRead);

export default router;
