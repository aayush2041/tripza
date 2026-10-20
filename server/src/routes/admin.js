import { Router } from 'express';
import {
  getAdminReports,
  updateAdminReport,
  updateAdminUserStatus,
  moderateMessage,
} from '../controllers/reportController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

// All admin endpoints require active session + admin role
router.use(requireAuth, requireAdmin);

router.get('/reports', getAdminReports);
router.patch('/reports/:id', verifyCsrf, updateAdminReport);
router.patch('/users/:id/status', verifyCsrf, updateAdminUserStatus);
router.patch('/messages/:id/moderate', verifyCsrf, moderateMessage);

export default router;
