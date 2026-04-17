import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireAdmin);

adminRouter.get('/ping', (_req, res) => {
  res.json({ ok: true });
});
