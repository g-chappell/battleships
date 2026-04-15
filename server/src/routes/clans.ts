import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../services/db.js';
import {
  listClans,
  getClanDetail,
  createClan,
  joinClan,
  leaveClan,
  addChatMessage,
} from '../services/clans.ts';

// Rate limiting for clan chat: 5 messages per 10 seconds per user
const clanChatTimestamps = new Map<string, number[]>();

function rateLimitClanChat(userId: string): boolean {
  const now = Date.now();
  const history = clanChatTimestamps.get(userId) ?? [];
  const recent = history.filter((t) => now - t < 10000);
  if (recent.length >= 5) {
    clanChatTimestamps.set(userId, recent);
    return false;
  }
  recent.push(now);
  clanChatTimestamps.set(userId, recent);
  return true;
}

export const clansRouter = Router();

clansRouter.get('/', async (req, res) => {
  const search = (req.query.search as string) || undefined;
  const list = await listClans(search);
  res.json({ clans: list });
});

clansRouter.get('/leaderboard', async (_req, res) => {
  const list = await listClans();
  res.json({ clans: list });
});

clansRouter.get('/:id', async (req, res) => {
  const detail = await getClanDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Clan not found' });
    return;
  }
  res.json({ clan: detail });
});

clansRouter.post('/', authMiddleware, async (req, res) => {
  const { name, tag, description } = req.body ?? {};
  if (!name || !tag) {
    res.status(400).json({ error: 'name and tag required' });
    return;
  }
  if (tag.length < 2 || tag.length > 5) {
    res.status(400).json({ error: 'tag must be 2-5 chars' });
    return;
  }
  const result = await createClan(req.user!.userId, name, tag, description);
  if ('error' in result) {
    res.status(400).json(result);
    return;
  }
  res.status(201).json(result);
});

clansRouter.post('/:id/join', authMiddleware, async (req, res) => {
  const result = await joinClan(req.user!.userId, req.params.id as string);
  if ('error' in result) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

clansRouter.post('/leave', authMiddleware, async (req, res) => {
  await leaveClan(req.user!.userId);
  res.json({ ok: true });
});

clansRouter.post('/:id/chat', authMiddleware, async (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text required' });
    return;
  }
  if (!rateLimitClanChat(req.user!.userId)) {
    res.status(429).json({ error: 'Slow down, captain!' });
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { username: true, clanId: true },
    });
    if (!user || user.clanId !== req.params.id) {
      res.status(403).json({ error: 'Not a member of this clan' });
      return;
    }
    const msg = await addChatMessage(req.params.id, req.user!.userId, user.username, text.slice(0, 200));
    res.json({ ok: true, message: msg });
  } catch {
    res.status(500).json({ error: 'Chat unavailable' });
  }
});
