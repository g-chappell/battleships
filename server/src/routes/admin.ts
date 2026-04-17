import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { prisma } from '../services/db.js';

export const adminRouter = Router();

adminRouter.use(authMiddleware);
adminRouter.use(requireAdmin);

adminRouter.get('/ping', (_req, res) => {
  res.json({ ok: true });
});

// ─── User list ────────────────────────────────────────────────────────────────

adminRouter.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          gold: true,
          bannedAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit });
  } catch {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ─── User detail ──────────────────────────────────────────────────────────────

adminRouter.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        gold: true,
        bannedAt: true,
        mustChangePassword: true,
        createdAt: true,
        stats: {
          select: {
            rating: true,
            wins: true,
            losses: true,
            totalGamesAI: true,
            totalGamesMP: true,
            shotsFired: true,
            shotsHit: true,
            shipsSunk: true,
            shipsLost: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── Reset password ───────────────────────────────────────────────────────────

adminRouter.post('/users/:id/reset-password', async (req, res) => {
  const adminId = req.user!.userId;
  const targetUserId = req.params.id;
  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tempPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { passwordHash, mustChangePassword: true },
      }),
      prisma.adminAuditLog.create({
        data: { adminId, targetUserId, action: 'reset_password' },
      }),
    ]);

    return res.json({ tempPassword });
  } catch {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ─── Reset stats ──────────────────────────────────────────────────────────────

adminRouter.post('/users/:id/reset-stats', async (req, res) => {
  const adminId = req.user!.userId;
  const targetUserId = req.params.id;
  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.$transaction([
      prisma.playerStats.upsert({
        where: { userId: targetUserId },
        create: { userId: targetUserId },
        update: {
          rating: 1200,
          wins: 0,
          losses: 0,
          totalGamesAI: 0,
          totalGamesMP: 0,
          shotsFired: 0,
          shotsHit: 0,
          shipsSunk: 0,
          shipsLost: 0,
          totalTurns: 0,
          totalGameTimeMs: BigInt(0),
        },
      }),
      prisma.adminAuditLog.create({
        data: { adminId, targetUserId, action: 'reset_stats' },
      }),
    ]);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to reset stats' });
  }
});

// ─── Adjust gold ──────────────────────────────────────────────────────────────

adminRouter.post('/users/:id/adjust-gold', async (req, res) => {
  const adminId = req.user!.userId;
  const targetUserId = req.params.id;
  const { amount, type } = req.body as { amount: unknown; type: unknown };

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return res.status(400).json({ error: 'amount must be a number' });
  }
  if (type !== 'delta' && type !== 'absolute') {
    return res.status(400).json({ error: 'type must be "delta" or "absolute"' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, gold: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newGold = type === 'absolute' ? Math.max(0, amount) : Math.max(0, user.gold + amount);

    await prisma.$transaction([
      prisma.user.update({ where: { id: targetUserId }, data: { gold: newGold } }),
      prisma.adminAuditLog.create({
        data: { adminId, targetUserId, action: 'adjust_gold', detail: JSON.stringify({ type, amount, newGold }) },
      }),
    ]);

    return res.json({ gold: newGold });
  } catch {
    return res.status(500).json({ error: 'Failed to adjust gold' });
  }
});

// ─── Ban ──────────────────────────────────────────────────────────────────────

adminRouter.post('/users/:id/ban', async (req, res) => {
  const adminId = req.user!.userId;
  const targetUserId = req.params.id;
  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: targetUserId }, data: { bannedAt: new Date() } }),
      prisma.adminAuditLog.create({ data: { adminId, targetUserId, action: 'ban' } }),
    ]);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to ban user' });
  }
});

// ─── Unban ────────────────────────────────────────────────────────────────────

adminRouter.post('/users/:id/unban', async (req, res) => {
  const adminId = req.user!.userId;
  const targetUserId = req.params.id;
  try {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.$transaction([
      prisma.user.update({ where: { id: targetUserId }, data: { bannedAt: null } }),
      prisma.adminAuditLog.create({ data: { adminId, targetUserId, action: 'unban' } }),
    ]);

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to unban user' });
  }
});
