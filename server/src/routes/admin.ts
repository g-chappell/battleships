import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { prisma } from '../services/db.js';
import { invalidateSeasonCache } from '../services/seasons.js';
import { getRoomsCount } from '../services/rooms.js';
import { getConnectedCount } from '../services/telemetry.js';
import { seedPairings, totalRounds, VALID_TOURNAMENT_SIZES } from '../../../shared/src/tournaments.ts';

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

// ─── Seasons ──────────────────────────────────────────────────────────────────

adminRouter.get('/seasons', async (_req, res) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { startAt: 'desc' },
      select: {
        id: true,
        name: true,
        startAt: true,
        endAt: true,
        isActive: true,
        createdAt: true,
        _count: { select: { stats: true } },
      },
    });
    return res.json({ seasons });
  } catch {
    return res.status(500).json({ error: 'Failed to list seasons' });
  }
});

adminRouter.get('/seasons/:id/standings', async (req, res) => {
  try {
    const season = await prisma.season.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, isActive: true },
    });
    if (!season) return res.status(404).json({ error: 'Season not found' });

    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const standings = await prisma.seasonPlayerStats.findMany({
      where: { seasonId: req.params.id },
      orderBy: { rating: 'desc' },
      take: limit,
      select: {
        rating: true,
        wins: true,
        losses: true,
        peakRating: true,
        user: { select: { id: true, username: true } },
      },
    });

    return res.json({
      seasonId: season.id,
      seasonName: season.name,
      standings: standings.map((s, i) => ({
        rank: i + 1,
        userId: s.user.id,
        username: s.user.username,
        rating: s.rating,
        peakRating: s.peakRating,
        wins: s.wins,
        losses: s.losses,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

adminRouter.post('/seasons', async (req, res) => {
  const { name, startAt, endAt } = req.body as { name: unknown; startAt: unknown; endAt: unknown };

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!startAt || isNaN(Date.parse(String(startAt)))) {
    return res.status(400).json({ error: 'startAt must be a valid date' });
  }
  if (!endAt || isNaN(Date.parse(String(endAt)))) {
    return res.status(400).json({ error: 'endAt must be a valid date' });
  }

  const start = new Date(String(startAt));
  const end = new Date(String(endAt));
  if (end <= start) {
    return res.status(400).json({ error: 'endAt must be after startAt' });
  }

  try {
    // Deactivate any current active season
    await prisma.season.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const season = await prisma.season.create({
      data: { name: name.trim(), startAt: start, endAt: end, isActive: true },
    });
    invalidateSeasonCache();
    return res.status(201).json({
      id: season.id,
      name: season.name,
      startAt: season.startAt.toISOString(),
      endAt: season.endAt.toISOString(),
      isActive: season.isActive,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to create season' });
  }
});

adminRouter.post('/seasons/:id/end', async (req, res) => {
  try {
    const season = await prisma.season.findUnique({
      where: { id: req.params.id },
      select: { id: true, isActive: true },
    });
    if (!season) return res.status(404).json({ error: 'Season not found' });
    if (!season.isActive) return res.status(400).json({ error: 'Season is not active' });

    await prisma.season.update({
      where: { id: req.params.id },
      data: { isActive: false, endAt: new Date() },
    });
    invalidateSeasonCache();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to end season' });
  }
});

// ─── Tournaments ──────────────────────────────────────────────────────────────

adminRouter.get('/tournaments', async (_req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        maxPlayers: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        _count: { select: { entries: true } },
      },
    });

    const result = await Promise.all(
      tournaments.map(async (t) => {
        let currentRound: number | null = null;
        let roundDone = 0;
        let roundTotal = 0;

        if (t.status === 'active') {
          const matches = await prisma.tournamentMatch.findMany({
            where: { tournamentId: t.id },
            select: { round: true, status: true },
          });
          const activeMatches = matches.filter((m) => m.status !== 'pending');
          if (activeMatches.length > 0) {
            currentRound = Math.max(...activeMatches.map((m) => m.round));
            const inRound = matches.filter((m) => m.round === currentRound);
            roundTotal = inRound.length;
            roundDone = inRound.filter((m) => m.status === 'done').length;
          }
        }

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          status: t.status,
          maxPlayers: t.maxPlayers,
          playerCount: t._count.entries,
          createdAt: t.createdAt.toISOString(),
          startedAt: t.startedAt?.toISOString() ?? null,
          finishedAt: t.finishedAt?.toISOString() ?? null,
          currentRound,
          roundDone,
          roundTotal,
        };
      })
    );

    return res.json({ tournaments: result });
  } catch {
    return res.status(500).json({ error: 'Failed to list tournaments' });
  }
});

adminRouter.post('/tournaments', async (req, res) => {
  const { name, size, description } = req.body as { name: unknown; size: unknown; description: unknown };

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!VALID_TOURNAMENT_SIZES.includes(Number(size) as 4 | 8 | 16)) {
    return res.status(400).json({ error: 'size must be 4, 8, or 16' });
  }

  try {
    const t = await prisma.tournament.create({
      data: {
        name: name.trim(),
        maxPlayers: Number(size),
        createdBy: req.user!.userId,
        status: 'lobby',
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
      },
    });
    return res.status(201).json({
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status,
      maxPlayers: t.maxPlayers,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to create tournament' });
  }
});

adminRouter.post('/tournaments/:id/start', async (req, res) => {
  try {
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { entries: true },
    });
    if (!t) return res.status(404).json({ error: 'Tournament not found' });
    if (t.status !== 'lobby') return res.status(400).json({ error: 'Tournament is not in lobby' });
    if (t.entries.length !== t.maxPlayers) {
      return res.status(400).json({
        error: `Need ${t.maxPlayers} players to start; have ${t.entries.length}`,
      });
    }

    // Seed round 0 by rating (descending)
    const playerIds = t.entries.map((e: { userId: string }) => e.userId);
    const statsRows = await prisma.playerStats.findMany({
      where: { userId: { in: playerIds } },
      select: { userId: true, rating: true },
    });
    const ratingOf = new Map(statsRows.map((s: { userId: string; rating: number }) => [s.userId, s.rating]));
    const sorted = [...playerIds].sort(
      (a, b) => (ratingOf.get(b) ?? 1200) - (ratingOf.get(a) ?? 1200)
    );

    const pairs = seedPairings(sorted);
    for (let i = 0; i < pairs.length; i++) {
      const [p1, p2] = pairs[i];
      await prisma.tournamentMatch.create({
        data: { tournamentId: t.id, round: 0, bracketIdx: i, p1UserId: p1, p2UserId: p2, status: 'ready' },
      });
    }

    // Create empty slots for subsequent rounds
    const rounds = totalRounds(t.maxPlayers);
    for (let r = 1; r < rounds; r++) {
      const slotCount = t.maxPlayers / Math.pow(2, r + 1);
      for (let i = 0; i < slotCount; i++) {
        await prisma.tournamentMatch.create({
          data: { tournamentId: t.id, round: r, bracketIdx: i, status: 'pending' },
        });
      }
    }

    await prisma.tournament.update({
      where: { id: t.id },
      data: { status: 'active', startedAt: new Date() },
    });

    return res.json({ ok: true, round: 0, matchCount: pairs.length });
  } catch {
    return res.status(500).json({ error: 'Failed to start tournament' });
  }
});

adminRouter.post('/tournaments/:id/advance', async (req, res) => {
  try {
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, maxPlayers: true },
    });
    if (!t) return res.status(404).json({ error: 'Tournament not found' });
    if (t.status !== 'active') return res.status(400).json({ error: 'Tournament is not active' });

    const matches = await prisma.tournamentMatch.findMany({
      where: { tournamentId: t.id },
      select: { round: true, status: true },
    });

    // Current round = highest round with non-pending matches
    const activeMatches = matches.filter((m) => m.status !== 'pending');
    if (activeMatches.length === 0) {
      return res.status(400).json({ error: 'No active round found' });
    }

    const currentRound = Math.max(...activeMatches.map((m) => m.round));
    const inRound = matches.filter((m) => m.round === currentRound);
    const doneCount = inRound.filter((m) => m.status === 'done').length;
    const totalCount = inRound.length;

    if (doneCount < totalCount) {
      return res.status(400).json({
        error: `Round ${currentRound} not complete`,
        done: doneCount,
        total: totalCount,
      });
    }

    const totalR = totalRounds(t.maxPlayers);
    if (currentRound >= totalR - 1) {
      return res.status(400).json({ error: 'Tournament is already complete' });
    }

    const nextRound = currentRound + 1;
    const nextRoundMatches = await prisma.tournamentMatch.findMany({
      where: { tournamentId: t.id, round: nextRound },
    });
    const readyMatchIds = nextRoundMatches
      .filter((m) => m.p1UserId && m.p2UserId)
      .map((m) => m.id);
    if (readyMatchIds.length > 0) {
      await prisma.tournamentMatch.updateMany({
        where: { id: { in: readyMatchIds } },
        data: { status: 'ready' },
      });
    }

    return res.json({ ok: true, nextRound, matchCount: readyMatchIds.length });
  } catch {
    return res.status(500).json({ error: 'Failed to advance tournament' });
  }
});

// ─── Telemetry ────────────────────────────────────────────────────────────────

adminRouter.get('/telemetry', async (_req, res) => {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        mode: true,
        durationMs: true,
        createdAt: true,
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        winner: { select: { username: true } },
      },
    });

    return res.json({
      activeUsers: getConnectedCount(),
      gamesInProgress: getRoomsCount(),
      recentMatches: matches.map((m) => ({
        id: m.id,
        mode: m.mode,
        player1: m.player1.username,
        player2: m.player2?.username ?? null,
        winner: m.winner?.username ?? null,
        durationMs: m.durationMs,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch telemetry' });
  }
});
