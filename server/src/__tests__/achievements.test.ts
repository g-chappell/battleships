import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// vi.hoisted: mock objects available before vi.mock factories are executed
const { mockUserAchievement } = vi.hoisted(() => ({
  mockUserAchievement: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    userAchievement: mockUserAchievement,
  },
}));

import { achievementsRouter } from '../routes/achievements.ts';
import { signToken } from '../middleware/auth.ts';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/achievements', achievementsRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/achievements`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve()))
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUserAchievement.findMany.mockResolvedValue([]);
  mockUserAchievement.upsert.mockResolvedValue({
    achievementId: 'first_blood',
    unlockedAt: new Date('2026-01-01T00:00:00Z'),
  });
});

function makeToken(userId = 'user-1', email = 'pirate@sea.io') {
  return signToken({ userId, email });
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── GET /achievements ────────────────────────────────────────────────────────

describe('GET /achievements', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await fetch(baseUrl);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await fetch(baseUrl, { headers: { Authorization: 'Bearer bad.token' } });
    expect(res.status).toBe(401);
  });

  it('returns 200 with catalog and empty unlocks for a new user', async () => {
    mockUserAchievement.findMany.mockResolvedValue([]);
    const token = makeToken();

    const res = await fetch(baseUrl, { headers: authHeader(token) });
    expect(res.status).toBe(200);

    const body = await res.json() as { catalog: Array<{ id: string; unlockedAt: string | null }> };
    expect(Array.isArray(body.catalog)).toBe(true);
    expect(body.catalog.length).toBeGreaterThan(0);
    // All entries unlocked at null for a new user
    expect(body.catalog.every((c) => c.unlockedAt === null)).toBe(true);
  });

  it('returns each catalog entry with required fields', async () => {
    const token = makeToken();
    const res = await fetch(baseUrl, { headers: authHeader(token) });
    const body = await res.json() as { catalog: Array<Record<string, unknown>> };

    const entry = body.catalog[0];
    expect(typeof entry.id).toBe('string');
    expect(typeof entry.title).toBe('string');
    expect(typeof entry.description).toBe('string');
    expect(typeof entry.icon).toBe('string');
    expect(typeof entry.category).toBe('string');
    expect(typeof entry.points).toBe('number');
    expect(Object.prototype.hasOwnProperty.call(entry, 'unlockedAt')).toBe(true);
  });

  it('populates unlockedAt for achievements the user has unlocked', async () => {
    mockUserAchievement.findMany.mockResolvedValue([
      { achievementId: 'first_blood', unlockedAt: new Date('2026-03-01T12:00:00Z') },
    ]);
    const token = makeToken();

    const res = await fetch(baseUrl, { headers: authHeader(token) });
    const body = await res.json() as { catalog: Array<{ id: string; unlockedAt: string | null }> };

    const entry = body.catalog.find((c) => c.id === 'first_blood');
    expect(entry).toBeDefined();
    expect(entry!.unlockedAt).toBe('2026-03-01T12:00:00.000Z');
  });

  it('queries achievements for the authenticated user ID', async () => {
    const token = makeToken('user-abc');
    await fetch(baseUrl, { headers: authHeader(token) });

    expect(mockUserAchievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-abc' } })
    );
  });

  it('returns 500 when DB throws', async () => {
    mockUserAchievement.findMany.mockRejectedValue(new Error('DB down'));
    const token = makeToken();

    const res = await fetch(baseUrl, { headers: authHeader(token) });
    expect(res.status).toBe(500);
  });
});

// ─── POST /achievements/unlock ────────────────────────────────────────────────

describe('POST /achievements/unlock', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bad.token' },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when user is a guest (userId starts with guest_)', async () => {
    const token = makeToken('guest_abc', 'guest@example.com');
    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/guests/i);
  });

  it('does not write to userAchievement DB for guest user', async () => {
    const token = makeToken('guest_xyz', 'guest@example.com');
    await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });
    expect(mockUserAchievement.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when achievementId is missing', async () => {
    const token = makeToken();
    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/achievementId/i);
  });

  it('returns 400 when achievementId is not in the catalog', async () => {
    const token = makeToken();
    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'not_a_real_achievement' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unknown achievement/i);
  });

  it('returns 200 with achievementId and unlockedAt on success', async () => {
    const unlockedAt = new Date('2026-04-17T10:00:00Z');
    mockUserAchievement.upsert.mockResolvedValue({ achievementId: 'first_blood', unlockedAt });

    const token = makeToken();
    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { achievementId: string; unlockedAt: string };
    expect(body.achievementId).toBe('first_blood');
    expect(body.unlockedAt).toBe('2026-04-17T10:00:00.000Z');
  });

  it('is idempotent — upsert is called with update: {} (no-op on repeat)', async () => {
    const token = makeToken('user-1');
    await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });

    expect(mockUserAchievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_achievementId: { userId: 'user-1', achievementId: 'first_blood' } },
        update: {},
      })
    );
  });

  it('uses the authenticated userId (not any body field) for the upsert', async () => {
    const token = makeToken('user-xyz');
    await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'sharpshooter' }),
    });

    expect(mockUserAchievement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: 'user-xyz', achievementId: 'sharpshooter' }),
      })
    );
  });

  it('returns 500 when DB throws', async () => {
    mockUserAchievement.upsert.mockRejectedValue(new Error('DB down'));
    const token = makeToken();

    const res = await fetch(`${baseUrl}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ achievementId: 'first_blood' }),
    });

    expect(res.status).toBe(500);
  });
});
