import { Router } from 'express';
import { createBlock, deleteBlock, getMyBlockedUsers } from '../controllers/blockController.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf } from '../middleware/csrf.js';

const router = Router();

router.get('/', requireAuth, getMyBlockedUsers);
router.post('/', requireAuth, verifyCsrf, createBlock);
router.delete('/:userId', requireAuth, verifyCsrf, deleteBlock);

export default router;
