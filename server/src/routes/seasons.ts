import { Router } from 'express';
import {
  getActiveSeason,
  listSeasons,
  createSeason,
} from '../services/seasons.ts';

export const seasonsRouter = Router();

seasonsRouter.get('/', async (_req, res) => {
  const seasons = await listSeasons();
  res.json({ seasons });
});

seasonsRouter.get('/active', async (_req, res) => {
  const season = await getActiveSeason();
  res.json({ season });
});

// Admin-only season creation
seasonsRouter.post('/', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const { name, startAt, endAt } = req.body ?? {};
  if (!name || !startAt || !endAt) {
    res.status(400).json({ error: 'name, startAt, endAt required' });
    return;
  }
  const season = await createSeason(name, new Date(startAt), new Date(endAt));
  if (!season) {
    res.status(500).json({ error: 'Failed to create season' });
    return;
  }
  res.status(201).json({ season });
});
