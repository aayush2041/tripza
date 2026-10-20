import { Router } from 'express';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

router.get('/', requireAuth, getMyNotifications);
router.get('/unread-count', requireAuth, getUnreadNotificationCount);
router.patch('/read-all', requireAuth, verifyCsrf, markAllRead);
router.patch('/:id/read', requireAuth, verifyCsrf, markRead);

export default router;
