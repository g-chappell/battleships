import { Router } from 'express';
import { prisma } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';

export const statsRouter = Router();

// Get player stats
statsRouter.get('/:userId', async (req, res) => {
  try {
    const stats = await prisma.playerStats.findUnique({
      where: { userId: req.params.userId },
      include: {
        user: { select: { username: true } },
      },
    });

    if (!stats) {
      res.status(404).json({ error: 'Stats not found' });
      return;
    }

    const accuracy = stats.shotsFired > 0 ? stats.shotsHit / stats.shotsFired : 0;
    const totalGames = stats.wins + stats.losses;
    const avgGameTimeMs = totalGames > 0 ? Number(stats.totalGameTimeMs) / totalGames : 0;

    res.json({
      username: stats.user.username,
      rating: stats.rating,
      wins: stats.wins,
      losses: stats.losses,
      totalGamesAI: stats.totalGamesAI,
      totalGamesMP: stats.totalGamesMP,
      accuracy: Math.round(accuracy * 100),
      shipsSunk: stats.shipsSunk,
      shipsLost: stats.shipsLost,
      avgGameTimeSec: Math.round(avgGameTimeMs / 1000),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Update stats after a match (internal use, called from match recording)
export async function updateStatsAfterMatch(
  userId: string,
  won: boolean,
  isAI: boolean,
  shotsFired: number,
  shotsHit: number,
  shipsSunk: number,
  shipsLost: number,
  turns: number,
  durationMs: number
) {
  await prisma.playerStats.upsert({
    where: { userId },
    create: {
      userId,
      wins: won ? 1 : 0,
      losses: won ? 0 : 1,
      totalGamesAI: isAI ? 1 : 0,
      totalGamesMP: isAI ? 0 : 1,
      shotsFired,
      shotsHit,
      shipsSunk,
      shipsLost,
      totalTurns: turns,
      totalGameTimeMs: BigInt(durationMs),
    },
    update: {
      wins: { increment: won ? 1 : 0 },
      losses: { increment: won ? 0 : 1 },
      totalGamesAI: { increment: isAI ? 1 : 0 },
      totalGamesMP: { increment: isAI ? 0 : 1 },
      shotsFired: { increment: shotsFired },
      shotsHit: { increment: shotsHit },
      shipsSunk: { increment: shipsSunk },
      shipsLost: { increment: shipsLost },
      totalTurns: { increment: turns },
      totalGameTimeMs: { increment: BigInt(durationMs) },
    },
  });
}
