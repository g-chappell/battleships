import { Router } from 'express';
import { prisma } from '../services/db.js';
import { getActiveSeason } from '../services/seasons.ts';

/* ── Local Prisma result-shape types ── */

interface StatsWithUser {
  rating: number; wins: number; losses: number;
  user: { id: string; username: string; clanId: string | null; clan: { tag: string } | null };
}

interface SeasonStatsWithUser {
  rating: number; wins: number; losses: number; peakRating: number;
  user: { id: string; username: string; clan: { tag: string } | null };
}

export const leaderboardRouter = Router();

// Get leaderboard — supports ?seasonId=xxx, ?seasonId=active, ?seasonId=lifetime
leaderboardRouter.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const seasonParam = (req.query.seasonId as string) ?? 'lifetime';

    if (seasonParam === 'lifetime') {
      const entries = await prisma.playerStats.findMany({
        where: {
          OR: [{ wins: { gt: 0 } }, { losses: { gt: 0 } }],
        },
        orderBy: { rating: 'desc' },
        take: limit,
        include: { user: { select: { id: true, username: true, clanId: true, clan: { select: { tag: true } } } } },
      });
      res.json({
        scope: 'lifetime',
        leaderboard: entries.map((entry: StatsWithUser, index: number) => ({
          rank: index + 1,
          userId: entry.user.id,
          username: entry.user.username,
          clanTag: entry.user.clan?.tag ?? null,
          rating: entry.rating,
          wins: entry.wins,
          losses: entry.losses,
          winRate:
            entry.wins + entry.losses > 0
              ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
              : 0,
        })),
      });
      return;
    }

    // Season-based leaderboard
    let seasonId = seasonParam;
    if (seasonParam === 'active') {
      const active = await getActiveSeason();
      if (!active) {
        res.json({ scope: 'season', leaderboard: [], noActiveSeason: true });
        return;
      }
      seasonId = active.id;
    }

    const entries = await prisma.seasonPlayerStats.findMany({
      where: { seasonId },
      orderBy: { rating: 'desc' },
      take: limit,
      include: { user: { select: { id: true, username: true, clan: { select: { tag: true } } } } },
    });

    res.json({
      scope: 'season',
      seasonId,
      leaderboard: entries.map((entry: SeasonStatsWithUser, index: number) => ({
        rank: index + 1,
        userId: entry.user.id,
        username: entry.user.username,
        clanTag: entry.user.clan?.tag ?? null,
        rating: entry.rating,
        wins: entry.wins,
        losses: entry.losses,
        peakRating: entry.peakRating,
        winRate:
          entry.wins + entry.losses > 0
            ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
            : 0,
      })),
    });
  } catch (err) {
    console.warn('Leaderboard DB unavailable, returning empty list');
    res.json({ leaderboard: [], dbUnavailable: true });
  }
});

// Get a specific player's rank
leaderboardRouter.get('/rank/:userId', async (req, res) => {
  try {
    const stats = await prisma.playerStats.findUnique({
      where: { userId: req.params.userId },
    });

    if (!stats) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const rank = await prisma.playerStats.count({
      where: { rating: { gt: stats.rating } },
    });

    res.json({
      rank: rank + 1,
      rating: stats.rating,
    });
  } catch (err) {
    console.error('Rank error:', err);
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});
