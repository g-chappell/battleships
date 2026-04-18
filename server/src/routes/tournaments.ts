import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../services/db.js';
import {
  listTournaments,
  getTournamentDetail,
  createTournament,
  joinTournament,
  getTournamentLeaderboard,
} from '../services/tournaments.ts';

export const tournamentsRouter = Router();

tournamentsRouter.get('/', async (_req, res) => {
  const list = await listTournaments();
  res.json({ tournaments: list });
});

tournamentsRouter.get('/leaderboard', async (_req, res) => {
  const board = await getTournamentLeaderboard();
  res.json({ leaderboard: board });
});

tournamentsRouter.get('/:id', async (req, res) => {
  const detail = await getTournamentDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Tournament not found' });
    return;
  }
  res.json({ tournament: detail });
});

tournamentsRouter.post('/', authMiddleware, async (req, res) => {
  const { name, maxPlayers } = req.body ?? {};
  if (!name || !maxPlayers) {
    res.status(400).json({ error: 'name and maxPlayers required' });
    return;
  }
  const result = await createTournament(req.user!.userId, name, maxPlayers);
  if ('error' in result) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

tournamentsRouter.post('/:id/join', authMiddleware, async (req, res) => {
  const result = await joinTournament(req.user!.userId, req.params.id as string);
  if ('error' in result) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

tournamentsRouter.get('/:id/chat', async (req, res) => {
  try {
    const messages = await prisma.tournamentChatMessage.findMany({
      where: { tournamentId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ messages: messages.reverse() });
  } catch {
    res.status(500).json({ error: 'Chat unavailable' });
  }
});
