import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// vi.hoisted: mock objects must exist before vi.mock() factories (which are hoisted)
const { mockPlayerStats, mockSeasonPlayerStats, mockGetActiveSeason } = vi.hoisted(() => ({
  mockPlayerStats: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  mockSeasonPlayerStats: {
    findMany: vi.fn(),
  },
  mockGetActiveSeason: vi.fn(),
}));

vi.mock('../services/db.ts', () => ({
  prisma: { playerStats: mockPlayerStats, seasonPlayerStats: mockSeasonPlayerStats },
}));

// Mock the entire seasons module to prevent module-level setInterval side effects
vi.mock('../services/seasons.ts', () => ({
  getActiveSeason: mockGetActiveSeason,
  invalidateSeasonCache: vi.fn(),
  listSeasons: vi.fn(),
  createSeason: vi.fn(),
  rolloverIfExpired: vi.fn(),
}));

import { leaderboardRouter } from '../routes/leaderboard.ts';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/leaderboard', leaderboardRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/leaderboard`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve()))
  );
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlayerStatsRow(
  rating: number,
  wins: number,
  losses: number,
  username = 'pirate',
  userId = 'user-1',
  clanTag: string | null = null
) {
  return {
    rating,
    wins,
    losses,
    user: {
      id: userId,
      username,
      clanId: clanTag ? 'clan-1' : null,
      clan: clanTag ? { tag: clanTag } : null,
    },
  };
}

function makeSeasonStatsRow(
  rating: number,
  wins: number,
  losses: number,
  peakRating: number,
  username = 'pirate',
  userId = 'user-1',
  clanTag: string | null = null
) {
  return {
    rating,
    wins,
    losses,
    peakRating,
    user: {
      id: userId,
      username,
      clan: clanTag ? { tag: clanTag } : null,
    },
  };
}

// ─── GET /leaderboard (lifetime — default) ────────────────────────────────────

describe('GET /leaderboard (lifetime)', () => {
  it('returns 200 with scope "lifetime" and a leaderboard array', async () => {
    mockPlayerStats.findMany.mockResolvedValue([
      makePlayerStatsRow(1500, 10, 5, 'ironbeard', 'user-1'),
    ]);

    const res = await fetch(`${baseUrl}`);

    expect(res.status).toBe(200);
    const body = await res.json() as { scope: string; leaderboard: unknown[] };
    expect(body.scope).toBe('lifetime');
    expect(Array.isArray(body.leaderboard)).toBe(true);
  });

  it('assigns rank 1 to the first entry (highest rating)', async () => {
    mockPlayerStats.findMany.mockResolvedValue([
      makePlayerStatsRow(1600, 20, 3, 'ironbeard', 'user-1'),
      makePlayerStatsRow(1400, 10, 8, 'mistral', 'user-2'),
    ]);

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { leaderboard: Array<{ rank: number; username: string }> };

    expect(body.leaderboard[0].rank).toBe(1);
    expect(body.leaderboard[0].username).toBe('ironbeard');
    expect(body.leaderboard[1].rank).toBe(2);
    expect(body.leaderboard[1].username).toBe('mistral');
  });

  it('maps all expected fields to each leaderboard entry', async () => {
    mockPlayerStats.findMany.mockResolvedValue([
      makePlayerStatsRow(1500, 10, 5, 'ironbeard', 'user-abc', 'IRON'),
    ]);

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { leaderboard: Array<Record<string, unknown>> };
    const entry = body.leaderboard[0];

    expect(entry.rank).toBe(1);
    expect(entry.userId).toBe('user-abc');
    expect(entry.username).toBe('ironbeard');
    expect(entry.clanTag).toBe('IRON');
    expect(entry.rating).toBe(1500);
    expect(entry.wins).toBe(10);
    expect(entry.losses).toBe(5);
    expect(entry.winRate).toBeDefined();
  });

  it('calculates winRate as percentage of wins rounded to nearest integer', async () => {
    // 10 wins, 5 losses → 10/15 = 66.6...% → rounded to 67
    mockPlayerStats.findMany.mockResolvedValue([
      makePlayerStatsRow(1500, 10, 5),
    ]);

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { leaderboard: Array<{ winRate: number }> };

    expect(body.leaderboard[0].winRate).toBe(67);
  });

  it('sets winRate to 0 when player has no wins and no losses', async () => {
    mockPlayerStats.findMany.mockResolvedValue([
      makePlayerStatsRow(1000, 0, 0),
    ]);

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { leaderboard: Array<{ winRate: number }> };

    expect(body.leaderboard[0].winRate).toBe(0);
  });

  it('returns null clanTag when player has no clan', async () => {
    mockPlayerStats.findMany.mockResolvedValue([
      makePlayerStatsRow(1500, 5, 5, 'solo', 'user-1', null),
    ]);

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { leaderboard: Array<{ clanTag: string | null }> };

    expect(body.leaderboard[0].clanTag).toBeNull();
  });

  it('returns an empty leaderboard array when DB has no qualifying players', async () => {
    mockPlayerStats.findMany.mockResolvedValue([]);

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { scope: string; leaderboard: unknown[] };

    expect(res.status).toBe(200);
    expect(body.scope).toBe('lifetime');
    expect(body.leaderboard).toHaveLength(0);
  });

  it('passes the limit param (default 100) to the DB query', async () => {
    mockPlayerStats.findMany.mockResolvedValue([]);

    await fetch(`${baseUrl}`);

    expect(mockPlayerStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('respects a custom limit query param', async () => {
    mockPlayerStats.findMany.mockResolvedValue([]);

    await fetch(`${baseUrl}?limit=10`);

    expect(mockPlayerStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it('caps limit at 100 even if a larger value is requested', async () => {
    mockPlayerStats.findMany.mockResolvedValue([]);

    await fetch(`${baseUrl}?limit=500`);

    expect(mockPlayerStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('queries playerStats with seasonId=lifetime (the default path)', async () => {
    mockPlayerStats.findMany.mockResolvedValue([]);

    await fetch(`${baseUrl}?seasonId=lifetime`);

    expect(mockPlayerStats.findMany).toHaveBeenCalled();
    expect(mockSeasonPlayerStats.findMany).not.toHaveBeenCalled();
  });

  it('returns dbUnavailable flag when DB throws', async () => {
    mockPlayerStats.findMany.mockRejectedValue(new Error('DB connection failed'));

    const res = await fetch(`${baseUrl}`);
    const body = await res.json() as { leaderboard: unknown[]; dbUnavailable?: boolean };

    expect(res.status).toBe(200);
    expect(body.leaderboard).toHaveLength(0);
    expect(body.dbUnavailable).toBe(true);
  });
});

// ─── GET /leaderboard?seasonId=active ────────────────────────────────────────

describe('GET /leaderboard?seasonId=active', () => {
  it('returns scope "season" with leaderboard entries when an active season exists', async () => {
    mockGetActiveSeason.mockResolvedValue({
      id: 'season-1',
      name: 'Season 1',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-03-31T23:59:59Z',
      isActive: true,
    });
    mockSeasonPlayerStats.findMany.mockResolvedValue([
      makeSeasonStatsRow(1550, 8, 2, 1600, 'ironbeard', 'user-1'),
    ]);

    const res = await fetch(`${baseUrl}?seasonId=active`);
    const body = await res.json() as {
      scope: string;
      seasonId: string;
      leaderboard: Array<Record<string, unknown>>;
    };

    expect(res.status).toBe(200);
    expect(body.scope).toBe('season');
    expect(body.seasonId).toBe('season-1');
    expect(body.leaderboard).toHaveLength(1);
  });

  it('includes peakRating in each season leaderboard entry', async () => {
    mockGetActiveSeason.mockResolvedValue({
      id: 'season-2',
      name: 'Season 2',
      startAt: '2026-04-01T00:00:00Z',
      endAt: '2026-06-30T23:59:59Z',
      isActive: true,
    });
    mockSeasonPlayerStats.findMany.mockResolvedValue([
      makeSeasonStatsRow(1400, 5, 5, 1500, 'pirate', 'user-1'),
    ]);

    const res = await fetch(`${baseUrl}?seasonId=active`);
    const body = await res.json() as { leaderboard: Array<{ peakRating: number }> };

    expect(body.leaderboard[0].peakRating).toBe(1500);
  });

  it('returns noActiveSeason flag and empty leaderboard when no active season', async () => {
    mockGetActiveSeason.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}?seasonId=active`);
    const body = await res.json() as {
      scope: string;
      leaderboard: unknown[];
      noActiveSeason: boolean;
    };

    expect(res.status).toBe(200);
    expect(body.scope).toBe('season');
    expect(body.leaderboard).toHaveLength(0);
    expect(body.noActiveSeason).toBe(true);
  });

  it('queries seasonPlayerStats using the active season id', async () => {
    mockGetActiveSeason.mockResolvedValue({
      id: 'season-xyz',
      name: 'Season XYZ',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-06-30T23:59:59Z',
      isActive: true,
    });
    mockSeasonPlayerStats.findMany.mockResolvedValue([]);

    await fetch(`${baseUrl}?seasonId=active`);

    expect(mockSeasonPlayerStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonId: 'season-xyz' } })
    );
  });
});

// ─── GET /leaderboard?seasonId=<specific> ────────────────────────────────────

describe('GET /leaderboard?seasonId=<specific>', () => {
  it('queries seasonPlayerStats with the provided seasonId directly', async () => {
    mockSeasonPlayerStats.findMany.mockResolvedValue([
      makeSeasonStatsRow(1300, 3, 7, 1450, 'blackheart', 'user-2'),
    ]);

    const res = await fetch(`${baseUrl}?seasonId=season-abc`);
    const body = await res.json() as { scope: string; seasonId: string; leaderboard: unknown[] };

    expect(res.status).toBe(200);
    expect(body.scope).toBe('season');
    expect(body.seasonId).toBe('season-abc');
    expect(body.leaderboard).toHaveLength(1);
    expect(mockGetActiveSeason).not.toHaveBeenCalled();
  });

  it('skips getActiveSeason call when a specific seasonId is provided', async () => {
    mockSeasonPlayerStats.findMany.mockResolvedValue([]);

    await fetch(`${baseUrl}?seasonId=season-42`);

    expect(mockGetActiveSeason).not.toHaveBeenCalled();
  });

  it('returns empty leaderboard for a seasonId that has no entries', async () => {
    mockSeasonPlayerStats.findMany.mockResolvedValue([]);

    const res = await fetch(`${baseUrl}?seasonId=season-empty`);
    const body = await res.json() as { leaderboard: unknown[] };

    expect(res.status).toBe(200);
    expect(body.leaderboard).toHaveLength(0);
  });
});

// ─── GET /leaderboard/rank/:userId ───────────────────────────────────────────

describe('GET /leaderboard/rank/:userId', () => {
  it('returns 200 with rank and rating for a known player', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1400, wins: 5, losses: 3 });
    // 2 players have a rating higher than 1400 → rank = 3
    mockPlayerStats.count.mockResolvedValue(2);

    const res = await fetch(`${baseUrl}/rank/user-1`);
    const body = await res.json() as { rank: number; rating: number };

    expect(res.status).toBe(200);
    expect(body.rank).toBe(3);
    expect(body.rating).toBe(1400);
  });

  it('assigns rank 1 when no players have a higher rating', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 2000, wins: 50, losses: 2 });
    mockPlayerStats.count.mockResolvedValue(0);

    const res = await fetch(`${baseUrl}/rank/top-player`);
    const body = await res.json() as { rank: number };

    expect(res.status).toBe(200);
    expect(body.rank).toBe(1);
  });

  it('queries count with rating greater-than condition', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1600, wins: 20, losses: 5 });
    mockPlayerStats.count.mockResolvedValue(0);

    await fetch(`${baseUrl}/rank/user-abc`);

    expect(mockPlayerStats.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rating: { gt: 1600 } } })
    );
  });

  it('returns 404 when the player has no stats record', async () => {
    mockPlayerStats.findUnique.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/rank/unknown-user`);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 500 when DB throws on findUnique', async () => {
    mockPlayerStats.findUnique.mockRejectedValue(new Error('DB down'));

    const res = await fetch(`${baseUrl}/rank/user-1`);

    expect(res.status).toBe(500);
  });

  it('returns 500 when DB throws on count', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1500, wins: 10, losses: 5 });
    mockPlayerStats.count.mockRejectedValue(new Error('Count failed'));

    const res = await fetch(`${baseUrl}/rank/user-1`);

    expect(res.status).toBe(500);
  });
});
