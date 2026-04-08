import { Router } from 'express';
import { prisma } from '../services/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { updateStatsAfterMatch } from './stats.js';

export const matchRouter = Router();

// Record a completed match
matchRouter.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      mode,
      won,
      turns,
      durationMs,
      playerAccuracy,
      opponentAccuracy,
      playerShipsSunk,
      opponentShipsSunk,
      events,
    } = req.body;

    const match = await prisma.match.create({
      data: {
        player1Id: userId,
        player2Id: null,
        winnerId: won ? userId : null,
        mode,
        turns,
        durationMs,
        p1Accuracy: playerAccuracy,
        p2Accuracy: opponentAccuracy,
        p1ShipsSunk: playerShipsSunk,
        p2ShipsSunk: opponentShipsSunk,
        events,
      },
    });

    // Update player stats
    const isAI = mode.startsWith('ai_');
    const playerShotsFired = Math.round(playerAccuracy > 0 ? playerShipsSunk / playerAccuracy : turns);
    await updateStatsAfterMatch(
      userId,
      won,
      isAI,
      turns,       // approximate shots fired
      Math.round(turns * playerAccuracy),
      playerShipsSunk,
      opponentShipsSunk,
      turns,
      durationMs
    );

    res.status(201).json({ matchId: match.id });
  } catch (err) {
    console.error('Match recording error:', err);
    res.status(500).json({ error: 'Failed to record match' });
  }
});

// Get replay data for a specific match
matchRouter.get('/:id/replay', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
      },
    });
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    res.json({
      replay: {
        version: 1,
        matchId: match.id,
        p1: { id: match.player1.id, username: match.player1.username },
        p2: match.player2
          ? { id: match.player2.id, username: match.player2.username }
          : { id: 'ai', username: 'AI' },
        mode: match.mode,
        startedAt: match.createdAt.getTime(),
        events: match.events ?? [],
      },
    });
  } catch (err) {
    console.warn('[matches/replay] DB unavailable');
    res.status(404).json({ error: 'Replay not found' });
  }
});

// Get match history for a user
matchRouter.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [{ player1Id: userId }, { player2Id: userId }],
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          mode: true,
          turns: true,
          durationMs: true,
          p1Accuracy: true,
          p2Accuracy: true,
          p1ShipsSunk: true,
          p2ShipsSunk: true,
          winnerId: true,
          player1Id: true,
          createdAt: true,
        },
      }),
      prisma.match.count({
        where: {
          OR: [{ player1Id: userId }, { player2Id: userId }],
        },
      }),
    ]);

    res.json({
      matches: matches.map((m: typeof matches[number]) => ({
        id: m.id,
        mode: m.mode,
        turns: m.turns,
        durationSec: Math.round(m.durationMs / 1000),
        accuracy: m.player1Id === userId ? m.p1Accuracy : m.p2Accuracy,
        shipsSunk: m.player1Id === userId ? m.p1ShipsSunk : m.p2ShipsSunk,
        shipsLost: m.player1Id === userId ? m.p2ShipsSunk : m.p1ShipsSunk,
        won: m.winnerId === userId,
        createdAt: m.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Match history error:', err);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});
