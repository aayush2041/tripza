import { Router } from 'express';
import { submitReport, getMyReports } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

router.get('/mine', requireAuth, getMyReports);
router.post('/', requireAuth, verifyCsrf, submitReport);

export default router;
