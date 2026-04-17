import { Router } from 'express';
import { prisma } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { ACHIEVEMENT_DEFS } from '../../../shared/src/achievements.ts';

export const achievementsRouter = Router();

// GET /achievements — full catalog + caller's unlocks (auth required)
achievementsRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const rows = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    });

    const unlocked: Record<string, string> = {};
    for (const row of rows) {
      unlocked[row.achievementId] = row.unlockedAt.toISOString();
    }

    const catalog = Object.values(ACHIEVEMENT_DEFS).map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      category: def.category,
      points: def.points,
      unlockedAt: unlocked[def.id] ?? null,
    }));

    res.json({ catalog });
  } catch (err) {
    console.error('[achievements/get] error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// POST /achievements/unlock — idempotent unlock; 401 for guests
achievementsRouter.post('/unlock', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    if (userId.startsWith('guest_')) {
      res.status(401).json({ error: 'Guests cannot unlock achievements' });
      return;
    }

    const { achievementId } = req.body;

    if (!achievementId || typeof achievementId !== 'string') {
      res.status(400).json({ error: 'achievementId is required' });
      return;
    }

    if (!ACHIEVEMENT_DEFS[achievementId]) {
      res.status(400).json({ error: 'Unknown achievement' });
      return;
    }

    // Upsert — idempotent; second call returns the existing row
    const row = await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId } },
      update: {},
      create: { userId, achievementId },
      select: { achievementId: true, unlockedAt: true },
    });

    res.json({ achievementId: row.achievementId, unlockedAt: row.unlockedAt.toISOString() });
  } catch (err) {
    console.error('[achievements/unlock] error:', err);
    res.status(500).json({ error: 'Failed to unlock achievement' });
  }
});
