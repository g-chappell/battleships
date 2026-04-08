import { Router } from 'express';
import { prisma } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getCosmetic } from '../../../shared/src/cosmetics.ts';

export const cosmeticsRouter = Router();

cosmeticsRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        gold: true,
        equippedShipSkin: true,
        equippedBoardTheme: true,
        equippedExplosionFx: true,
        cosmetics: { select: { cosmeticId: true, kind: true } },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      gold: user.gold,
      equipped: {
        shipSkin: user.equippedShipSkin ?? 'default',
        boardTheme: user.equippedBoardTheme ?? 'default',
        explosionFx: user.equippedExplosionFx ?? 'default',
      },
      owned: user.cosmetics.map((c) => c.cosmeticId),
    });
  } catch (err) {
    console.warn('[cosmetics/me] DB unavailable');
    res.json({
      gold: 0,
      equipped: { shipSkin: 'default', boardTheme: 'default', explosionFx: 'default' },
      owned: ['default'],
      dbUnavailable: true,
    });
  }
});

cosmeticsRouter.post('/buy', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { cosmeticId } = req.body ?? {};
    if (!cosmeticId) {
      res.status(400).json({ error: 'cosmeticId required' });
      return;
    }
    const def = getCosmetic(cosmeticId);
    if (!def) {
      res.status(404).json({ error: 'Cosmetic not found' });
      return;
    }
    if (def.price === 0) {
      res.status(400).json({ error: 'Already free' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { cosmetics: { where: { cosmeticId } } },
      });
      if (!user) throw new Error('User not found');
      if (user.cosmetics.length > 0) throw new Error('Already owned');
      if (user.gold < def.price) throw new Error('Insufficient gold');

      await tx.user.update({
        where: { id: userId },
        data: { gold: { decrement: def.price } },
      });
      await tx.userCosmetic.create({
        data: { userId, cosmeticId: def.id, kind: def.kind },
      });
      return { newBalance: user.gold - def.price };
    });

    res.json({ ok: true, newBalance: result.newBalance });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'Insufficient gold' || msg === 'Already owned') {
      res.status(400).json({ error: msg });
      return;
    }
    console.warn('[cosmetics/buy] error:', msg);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

cosmeticsRouter.post('/equip', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { cosmeticId, kind } = req.body ?? {};
    const def = getCosmetic(cosmeticId);
    if (!def || def.kind !== kind) {
      res.status(400).json({ error: 'Invalid cosmetic' });
      return;
    }
    // Must own it (unless it's 'default')
    if (def.price > 0) {
      const owned = await prisma.userCosmetic.findUnique({
        where: { userId_cosmeticId: { userId, cosmeticId } },
      });
      if (!owned) {
        res.status(403).json({ error: 'Not owned' });
        return;
      }
    }
    const field =
      kind === 'ship_skin'
        ? 'equippedShipSkin'
        : kind === 'board_theme'
        ? 'equippedBoardTheme'
        : 'equippedExplosionFx';
    await prisma.user.update({
      where: { id: userId },
      data: { [field]: cosmeticId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.warn('[cosmetics/equip] error:', (err as Error).message);
    res.status(500).json({ error: 'Equip failed' });
  }
});
