import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { signToken } from '../middleware/auth.ts';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockUser, mockPlayerStats, mockAdminAuditLog, mockTransaction, mockSeason, mockSeasonPlayerStats,
  mockTournament, mockTournamentMatch, mockMatch,
} = vi.hoisted(() => {
  const mockUser = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  };
  const mockPlayerStats = {
    upsert: vi.fn(),
    findMany: vi.fn(),
  };
  const mockAdminAuditLog = {
    create: vi.fn(),
  };
  const mockTransaction = vi.fn().mockImplementation(async (ops: unknown[]) => {
    return Promise.all(ops);
  });
  const mockSeason = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const mockSeasonPlayerStats = {
    findMany: vi.fn(),
  };
  const mockTournament = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const mockTournamentMatch = {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const mockMatch = {
    findMany: vi.fn(),
  };
  return {
    mockUser, mockPlayerStats, mockAdminAuditLog, mockTransaction, mockSeason, mockSeasonPlayerStats,
    mockTournament, mockTournamentMatch, mockMatch,
  };
});

vi.mock('../services/db.ts', () => ({
  prisma: {
    user: mockUser,
    playerStats: mockPlayerStats,
    adminAuditLog: mockAdminAuditLog,
    $transaction: mockTransaction,
    season: mockSeason,
    seasonPlayerStats: mockSeasonPlayerStats,
    tournament: mockTournament,
    tournamentMatch: mockTournamentMatch,
    match: mockMatch,
  },
}));

const { mockGetRoomsCount } = vi.hoisted(() => ({ mockGetRoomsCount: vi.fn().mockReturnValue(0) }));
vi.mock('../services/rooms.ts', () => ({ getRoomsCount: mockGetRoomsCount }));

const { mockGetConnectedCount } = vi.hoisted(() => ({ mockGetConnectedCount: vi.fn().mockReturnValue(0) }));
vi.mock('../services/telemetry.ts', () => ({ getConnectedCount: mockGetConnectedCount }));

vi.mock('../services/seasons.ts', () => ({
  getActiveSeason: vi.fn(),
  invalidateSeasonCache: vi.fn(),
  listSeasons: vi.fn(),
  createSeason: vi.fn(),
  rolloverIfExpired: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$hashed$') as never },
}));

import { adminRouter } from '../routes/admin.ts';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/admin`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve()))
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  mockUser.update.mockResolvedValue({});
  mockPlayerStats.upsert.mockResolvedValue({});
  mockPlayerStats.findMany.mockResolvedValue([]);
  mockAdminAuditLog.create.mockResolvedValue({});
  mockTournament.create.mockResolvedValue({});
  mockTournament.update.mockResolvedValue({});
  mockTournamentMatch.create.mockResolvedValue({});
  mockTournamentMatch.findMany.mockResolvedValue([]);
  mockMatch.findMany.mockResolvedValue([]);
  mockGetRoomsCount.mockReturnValue(0);
  mockGetConnectedCount.mockReturnValue(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminToken(): string {
  return signToken({ userId: 'admin-1', email: 'admin@test.com', role: 'admin' });
}

function userToken(): string {
  return signToken({ userId: 'user-1', email: 'user@test.com', role: 'user' });
}

function authHeaders(): { Authorization: string } {
  return { Authorization: `Bearer ${adminToken()}` };
}

// ─── requireAdmin middleware ──────────────────────────────────────────────────

describe('requireAdmin middleware', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await fetch(`${baseUrl}/ping`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when token has role "user"', async () => {
    const res = await fetch(`${baseUrl}/ping`, {
      headers: { Authorization: `Bearer ${userToken()}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Admin access required');
  });

  it('returns 403 when token has no role field', async () => {
    const token = signToken({ userId: 'u1', email: 'x@x.com', role: '' });
    const res = await fetch(`${baseUrl}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });
});

// ─── GET /admin/ping ──────────────────────────────────────────────────────────

describe('GET /admin/ping', () => {
  it('returns 200 with { ok: true } for admin token', async () => {
    const res = await fetch(`${baseUrl}/ping`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('rejects an invalid JWT', async () => {
    const res = await fetch(`${baseUrl}/ping`, {
      headers: { Authorization: 'Bearer not.a.valid.token' },
    });
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

describe('GET /admin/users', () => {
  const mockUsers = [
    { id: 'u1', username: 'pirate1', email: 'p1@sea.com', role: 'user', gold: 100, bannedAt: null, createdAt: new Date() },
    { id: 'u2', username: 'pirate2', email: 'p2@sea.com', role: 'user', gold: 200, bannedAt: null, createdAt: new Date() },
  ];

  it('returns paginated user list', async () => {
    mockUser.findMany.mockResolvedValue(mockUsers);
    mockUser.count.mockResolvedValue(2);

    const res = await fetch(`${baseUrl}/users`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { users: unknown[]; total: number; page: number };
    expect(body.users).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
  });

  it('passes search query to Prisma where clause', async () => {
    mockUser.findMany.mockResolvedValue([mockUsers[0]]);
    mockUser.count.mockResolvedValue(1);

    const res = await fetch(`${baseUrl}/users?q=pirate1`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    expect(mockUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    );
  });

  it('returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/users`);
    expect(res.status).toBe(401);
  });

  it('returns 500 on DB error', async () => {
    mockUser.findMany.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/users`, { headers: authHeaders() });
    expect(res.status).toBe(500);
  });
});

// ─── GET /admin/users/:id ─────────────────────────────────────────────────────

describe('GET /admin/users/:id', () => {
  const mockUserDetail = {
    id: 'u1',
    username: 'pirate1',
    email: 'p1@sea.com',
    role: 'user',
    gold: 500,
    bannedAt: null,
    mustChangePassword: false,
    createdAt: new Date(),
    stats: { rating: 1350, wins: 10, losses: 3, totalGamesAI: 5, totalGamesMP: 8, shotsFired: 400, shotsHit: 220, shipsSunk: 25, shipsLost: 10 },
  };

  it('returns user detail with stats', async () => {
    mockUser.findUnique.mockResolvedValue(mockUserDetail);
    const res = await fetch(`${baseUrl}/users/u1`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as typeof mockUserDetail;
    expect(body.username).toBe('pirate1');
    expect(body.stats?.rating).toBe(1350);
  });

  it('returns 404 when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/users/missing`, { headers: authHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    mockUser.findUnique.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/users/u1`, { headers: authHeaders() });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/users/:id/reset-password ────────────────────────────────────

describe('POST /admin/users/:id/reset-password', () => {
  it('returns a temp password and marks mustChangePassword', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1' });

    const res = await fetch(`${baseUrl}/users/u1/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { tempPassword: string };
    expect(typeof body.tempPassword).toBe('string');
    expect(body.tempPassword.length).toBeGreaterThan(0);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('returns 404 when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/users/missing/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    mockUser.findUnique.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/users/u1/reset-password`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/users/:id/reset-stats ───────────────────────────────────────

describe('POST /admin/users/:id/reset-stats', () => {
  it('resets stats and logs audit entry', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1' });

    const res = await fetch(`${baseUrl}/users/u1/reset-stats`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('returns 404 when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/users/missing/reset-stats`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

// ─── POST /admin/users/:id/adjust-gold ───────────────────────────────────────

describe('POST /admin/users/:id/adjust-gold', () => {
  it('adds gold using delta type', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', gold: 500 });

    const res = await fetch(`${baseUrl}/users/u1/adjust-gold`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 200, type: 'delta' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { gold: number };
    expect(body.gold).toBe(700);
  });

  it('sets gold using absolute type', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', gold: 500 });

    const res = await fetch(`${baseUrl}/users/u1/adjust-gold`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, type: 'absolute' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { gold: number };
    expect(body.gold).toBe(1000);
  });

  it('clamps gold to 0 for negative delta', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', gold: 100 });

    const res = await fetch(`${baseUrl}/users/u1/adjust-gold`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -500, type: 'delta' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { gold: number };
    expect(body.gold).toBe(0);
  });

  it('returns 400 for invalid amount', async () => {
    const res = await fetch(`${baseUrl}/users/u1/adjust-gold`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 'bad', type: 'delta' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid type', async () => {
    const res = await fetch(`${baseUrl}/users/u1/adjust-gold`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, type: 'unknown' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/users/missing/adjust-gold`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100, type: 'delta' }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── POST /admin/users/:id/ban ────────────────────────────────────────────────

describe('POST /admin/users/:id/ban', () => {
  it('bans a user and logs audit entry', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1' });

    const res = await fetch(`${baseUrl}/users/u1/ban`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('returns 404 when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/users/missing/ban`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

// ─── POST /admin/users/:id/unban ─────────────────────────────────────────────

describe('POST /admin/users/:id/unban', () => {
  it('unbans a user and logs audit entry', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1' });

    const res = await fetch(`${baseUrl}/users/u1/unban`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('returns 404 when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/users/missing/unban`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

// ─── GET /admin/seasons ───────────────────────────────────────────────────────

function makeSeason(overrides: Partial<{
  id: string; name: string; startAt: Date; endAt: Date; isActive: boolean; createdAt: Date; _count: { stats: number };
}> = {}) {
  return {
    id: 's1',
    name: 'Season 1',
    startAt: new Date('2026-01-01T00:00:00Z'),
    endAt: new Date('2026-03-31T00:00:00Z'),
    isActive: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    _count: { stats: 5 },
    ...overrides,
  };
}

describe('GET /admin/seasons', () => {
  it('returns list of seasons', async () => {
    mockSeason.findMany.mockResolvedValue([
      makeSeason({ id: 's1', name: 'Season 1', isActive: false }),
      makeSeason({ id: 's2', name: 'Season 2', isActive: true }),
    ]);

    const res = await fetch(`${baseUrl}/seasons`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { seasons: unknown[] };
    expect(body.seasons).toHaveLength(2);
  });

  it('returns 500 on DB error', async () => {
    mockSeason.findMany.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/seasons`, { headers: authHeaders() });
    expect(res.status).toBe(500);
  });

  it('requires admin token', async () => {
    const res = await fetch(`${baseUrl}/seasons`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/seasons/:id/standings ────────────────────────────────────────

describe('GET /admin/seasons/:id/standings', () => {
  it('returns standings for a season', async () => {
    mockSeason.findUnique.mockResolvedValue({ id: 's1', name: 'Season 1', isActive: false });
    mockSeasonPlayerStats.findMany.mockResolvedValue([
      { rating: 1400, wins: 8, losses: 2, peakRating: 1420, user: { id: 'u1', username: 'pirate1' } },
      { rating: 1300, wins: 5, losses: 4, peakRating: 1310, user: { id: 'u2', username: 'pirate2' } },
    ]);

    const res = await fetch(`${baseUrl}/seasons/s1/standings`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { standings: { rank: number; username: string; rating: number }[] };
    expect(body.standings).toHaveLength(2);
    expect(body.standings[0].rank).toBe(1);
    expect(body.standings[0].username).toBe('pirate1');
    expect(body.standings[0].rating).toBe(1400);
    expect(body.standings[1].rank).toBe(2);
  });

  it('returns 404 when season not found', async () => {
    mockSeason.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/seasons/missing/standings`, { headers: authHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    mockSeason.findUnique.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/seasons/s1/standings`, { headers: authHeaders() });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/seasons ──────────────────────────────────────────────────────

describe('POST /admin/seasons', () => {
  const validBody = { name: 'New Season', startAt: '2026-04-01', endAt: '2026-06-30' };

  it('creates a new season and deactivates active ones', async () => {
    mockSeason.updateMany.mockResolvedValue({ count: 1 });
    mockSeason.create.mockResolvedValue({
      id: 's3',
      name: 'New Season',
      startAt: new Date('2026-04-01'),
      endAt: new Date('2026-06-30'),
      isActive: true,
    });

    const res = await fetch(`${baseUrl}/seasons`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; name: string; isActive: boolean };
    expect(body.name).toBe('New Season');
    expect(body.isActive).toBe(true);
    expect(mockSeason.updateMany).toHaveBeenCalledWith({ where: { isActive: true }, data: { isActive: false } });
  });

  it('returns 400 when name is missing', async () => {
    const res = await fetch(`${baseUrl}/seasons`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ startAt: '2026-04-01', endAt: '2026-06-30' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when startAt is invalid', async () => {
    const res = await fetch(`${baseUrl}/seasons`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'S', startAt: 'not-a-date', endAt: '2026-06-30' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when endAt is before startAt', async () => {
    const res = await fetch(`${baseUrl}/seasons`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'S', startAt: '2026-06-30', endAt: '2026-04-01' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error', async () => {
    mockSeason.updateMany.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/seasons`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/seasons/:id/end ──────────────────────────────────────────────

describe('POST /admin/seasons/:id/end', () => {
  it('ends an active season', async () => {
    mockSeason.findUnique.mockResolvedValue({ id: 's1', isActive: true });
    mockSeason.update.mockResolvedValue({});

    const res = await fetch(`${baseUrl}/seasons/s1/end`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mockSeason.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: expect.objectContaining({ isActive: false }) })
    );
  });

  it('returns 404 when season not found', async () => {
    mockSeason.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/seasons/missing/end`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when season is already inactive', async () => {
    mockSeason.findUnique.mockResolvedValue({ id: 's1', isActive: false });
    const res = await fetch(`${baseUrl}/seasons/s1/end`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Season is not active');
  });

  it('returns 500 on DB error', async () => {
    mockSeason.findUnique.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/seasons/s1/end`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(500);
  });
});

// ─── GET /admin/tournaments ───────────────────────────────────────────────────

function makeTournament(overrides: Partial<{
  id: string; name: string; description: string | null; status: string;
  maxPlayers: number; createdAt: Date; startedAt: Date | null; finishedAt: Date | null;
  _count: { entries: number };
}> = {}) {
  return {
    id: 't1',
    name: 'Test Cup',
    description: null,
    status: 'lobby',
    maxPlayers: 4,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    startedAt: null,
    finishedAt: null,
    _count: { entries: 2 },
    ...overrides,
  };
}

describe('GET /admin/tournaments', () => {
  it('returns list of tournaments', async () => {
    mockTournament.findMany.mockResolvedValue([
      makeTournament({ id: 't1', name: 'Cup 1', status: 'lobby' }),
      makeTournament({ id: 't2', name: 'Cup 2', status: 'finished' }),
    ]);

    const res = await fetch(`${baseUrl}/tournaments`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { tournaments: unknown[] };
    expect(body.tournaments).toHaveLength(2);
  });

  it('returns round completion info for active tournaments', async () => {
    mockTournament.findMany.mockResolvedValue([
      makeTournament({ id: 't1', status: 'active', startedAt: new Date() }),
    ]);
    mockTournamentMatch.findMany.mockResolvedValue([
      { round: 0, status: 'done' },
      { round: 0, status: 'ready' },
    ]);

    const res = await fetch(`${baseUrl}/tournaments`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { tournaments: { currentRound: number; roundDone: number; roundTotal: number }[] };
    expect(body.tournaments[0].currentRound).toBe(0);
    expect(body.tournaments[0].roundDone).toBe(1);
    expect(body.tournaments[0].roundTotal).toBe(2);
  });

  it('returns 500 on DB error', async () => {
    mockTournament.findMany.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/tournaments`, { headers: authHeaders() });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/tournaments ──────────────────────────────────────────────────

describe('POST /admin/tournaments', () => {
  const validBody = { name: 'Iron Cup', size: 8 };

  it('creates a tournament and returns 201', async () => {
    mockTournament.create.mockResolvedValue({
      id: 't1', name: 'Iron Cup', description: null, status: 'lobby', maxPlayers: 8,
    });

    const res = await fetch(`${baseUrl}/tournaments`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; maxPlayers: number; status: string };
    expect(body.name).toBe('Iron Cup');
    expect(body.maxPlayers).toBe(8);
    expect(body.status).toBe('lobby');
  });

  it('stores description when provided', async () => {
    mockTournament.create.mockResolvedValue({
      id: 't1', name: 'Iron Cup', description: 'Grand final', status: 'lobby', maxPlayers: 8,
    });

    const res = await fetch(`${baseUrl}/tournaments`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Iron Cup', size: 8, description: 'Grand final' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { description: string };
    expect(body.description).toBe('Grand final');
  });

  it('returns 400 when name is missing', async () => {
    const res = await fetch(`${baseUrl}/tournaments`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 8 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid size', async () => {
    const res = await fetch(`${baseUrl}/tournaments`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Cup', size: 5 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('size');
  });

  it('returns 500 on DB error', async () => {
    mockTournament.create.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/tournaments`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/tournaments/:id/start ───────────────────────────────────────

describe('POST /admin/tournaments/:id/start', () => {
  const makeEntries = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ userId: `u${i + 1}` }));

  it('seeds bracket and starts a full tournament', async () => {
    mockTournament.findUnique.mockResolvedValue({
      id: 't1', status: 'lobby', maxPlayers: 4, entries: makeEntries(4),
    });
    mockPlayerStats.findMany.mockResolvedValue([
      { userId: 'u1', rating: 1400 },
      { userId: 'u2', rating: 1200 },
      { userId: 'u3', rating: 1300 },
      { userId: 'u4', rating: 1100 },
    ]);

    const res = await fetch(`${baseUrl}/tournaments/t1/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; round: number; matchCount: number };
    expect(body.ok).toBe(true);
    expect(body.round).toBe(0);
    expect(body.matchCount).toBe(2);
    expect(mockTournamentMatch.create).toHaveBeenCalled();
    expect(mockTournament.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'active' }) })
    );
  });

  it('returns 404 when tournament not found', async () => {
    mockTournament.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/tournaments/missing/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when tournament is not in lobby', async () => {
    mockTournament.findUnique.mockResolvedValue({
      id: 't1', status: 'active', maxPlayers: 4, entries: makeEntries(4),
    });
    const res = await fetch(`${baseUrl}/tournaments/t1/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not in lobby');
  });

  it('returns 400 when tournament is not full', async () => {
    mockTournament.findUnique.mockResolvedValue({
      id: 't1', status: 'lobby', maxPlayers: 4, entries: makeEntries(2),
    });
    const res = await fetch(`${baseUrl}/tournaments/t1/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('Need 4 players');
  });

  it('returns 500 on DB error', async () => {
    mockTournament.findUnique.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/tournaments/t1/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(500);
  });
});

// ─── POST /admin/tournaments/:id/advance ─────────────────────────────────────

describe('POST /admin/tournaments/:id/advance', () => {
  it('activates next-round matches and returns ok when current round is complete', async () => {
    mockTournament.findUnique.mockResolvedValue({ id: 't1', status: 'active', maxPlayers: 4 });
    // First findMany: all matches for completeness check
    mockTournamentMatch.findMany.mockResolvedValueOnce([
      { round: 0, status: 'done' },
      { round: 0, status: 'done' },
      { round: 1, status: 'pending' },
    ]);
    // Second findMany: next-round matches with both players seeded
    mockTournamentMatch.findMany.mockResolvedValueOnce([
      { id: 'tm-r1-0', round: 1, p1UserId: 'winner1', p2UserId: 'winner2' },
    ]);
    mockTournamentMatch.updateMany.mockResolvedValue({ count: 1 });

    const res = await fetch(`${baseUrl}/tournaments/t1/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; nextRound: number; matchCount: number };
    expect(body.ok).toBe(true);
    expect(body.nextRound).toBe(1);
    expect(body.matchCount).toBe(1);
    expect(mockTournamentMatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['tm-r1-0'] } },
      data: { status: 'ready' },
    });
  });

  it('returns ok with matchCount 0 when next-round slots are not yet filled', async () => {
    mockTournament.findUnique.mockResolvedValue({ id: 't1', status: 'active', maxPlayers: 4 });
    mockTournamentMatch.findMany.mockResolvedValueOnce([
      { round: 0, status: 'done' },
      { round: 0, status: 'done' },
      { round: 1, status: 'pending' },
    ]);
    // Next-round match has only one player seeded
    mockTournamentMatch.findMany.mockResolvedValueOnce([
      { id: 'tm-r1-0', round: 1, p1UserId: 'winner1', p2UserId: null },
    ]);

    const res = await fetch(`${baseUrl}/tournaments/t1/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; matchCount: number };
    expect(body.ok).toBe(true);
    expect(body.matchCount).toBe(0);
    expect(mockTournamentMatch.updateMany).not.toHaveBeenCalled();
  });

  it('returns 400 with completion info when round is incomplete', async () => {
    mockTournament.findUnique.mockResolvedValue({ id: 't1', status: 'active', maxPlayers: 4 });
    mockTournamentMatch.findMany.mockResolvedValue([
      { round: 0, status: 'done' },
      { round: 0, status: 'ready' },
      { round: 1, status: 'pending' },
    ]);

    const res = await fetch(`${baseUrl}/tournaments/t1/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; done: number; total: number };
    expect(body.done).toBe(1);
    expect(body.total).toBe(2);
  });

  it('returns 400 when tournament already complete', async () => {
    // 4-player tournament, total rounds = 2. Current round = 1 (final), all done.
    mockTournament.findUnique.mockResolvedValue({ id: 't1', status: 'active', maxPlayers: 4 });
    mockTournamentMatch.findMany.mockResolvedValue([
      { round: 0, status: 'done' },
      { round: 0, status: 'done' },
      { round: 1, status: 'done' },
    ]);

    const res = await fetch(`${baseUrl}/tournaments/t1/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('already complete');
  });

  it('returns 404 when tournament not found', async () => {
    mockTournament.findUnique.mockResolvedValue(null);
    const res = await fetch(`${baseUrl}/tournaments/missing/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when tournament is not active', async () => {
    mockTournament.findUnique.mockResolvedValue({ id: 't1', status: 'lobby', maxPlayers: 4 });
    const res = await fetch(`${baseUrl}/tournaments/t1/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('not active');
  });

  it('returns 500 on DB error', async () => {
    mockTournament.findUnique.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/tournaments/t1/advance`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(500);
  });
});

// ─── GET /admin/telemetry ─────────────────────────────────────────────────────

describe('GET /admin/telemetry', () => {
  it('returns 401 without token', async () => {
    const res = await fetch(`${baseUrl}/telemetry`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const res = await fetch(`${baseUrl}/telemetry`, {
      headers: { Authorization: `Bearer ${userToken()}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns activeUsers from getConnectedCount', async () => {
    mockGetConnectedCount.mockReturnValue(7);
    const res = await fetch(`${baseUrl}/telemetry`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { activeUsers: number };
    expect(body.activeUsers).toBe(7);
  });

  it('returns gamesInProgress from getRoomsCount', async () => {
    mockGetRoomsCount.mockReturnValue(3);
    const res = await fetch(`${baseUrl}/telemetry`, { headers: authHeaders() });
    const body = await res.json() as { gamesInProgress: number };
    expect(body.gamesInProgress).toBe(3);
  });

  it('returns recentMatches with shaped fields', async () => {
    const now = new Date('2026-04-18T10:00:00Z');
    mockMatch.findMany.mockResolvedValue([
      {
        id: 'm1',
        mode: 'ranked',
        durationMs: 90000,
        createdAt: now,
        player1: { username: 'alice' },
        player2: { username: 'bob' },
        winner: { username: 'alice' },
      },
      {
        id: 'm2',
        mode: 'ai_hard',
        durationMs: 60000,
        createdAt: now,
        player1: { username: 'carol' },
        player2: null,
        winner: { username: 'carol' },
      },
    ]);
    const res = await fetch(`${baseUrl}/telemetry`, { headers: authHeaders() });
    const body = await res.json() as { recentMatches: unknown[] };
    expect(body.recentMatches).toHaveLength(2);
    expect(body.recentMatches[0]).toMatchObject({
      id: 'm1',
      mode: 'ranked',
      player1: 'alice',
      player2: 'bob',
      winner: 'alice',
      durationMs: 90000,
    });
    expect(body.recentMatches[1]).toMatchObject({
      id: 'm2',
      player2: null,
    });
  });

  it('returns empty recentMatches when no matches exist', async () => {
    const res = await fetch(`${baseUrl}/telemetry`, { headers: authHeaders() });
    const body = await res.json() as { recentMatches: unknown[] };
    expect(body.recentMatches).toHaveLength(0);
  });

  it('queries match with correct orderBy and take', async () => {
    await fetch(`${baseUrl}/telemetry`, { headers: authHeaders() });
    expect(mockMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 50 })
    );
  });

  it('returns 500 on DB error', async () => {
    mockMatch.findMany.mockRejectedValue(new Error('db down'));
    const res = await fetch(`${baseUrl}/telemetry`, { headers: authHeaders() });
    expect(res.status).toBe(500);
  });
});
