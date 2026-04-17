import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { signToken } from '../middleware/auth.ts';

// Mock Prisma (required by auth middleware import chain)
vi.mock('../services/db.ts', () => ({
  prisma: {},
}));

// Mock seasons to prevent module-level setInterval
vi.mock('../services/seasons.ts', () => ({
  getActiveSeason: vi.fn(),
  invalidateSeasonCache: vi.fn(),
  listSeasons: vi.fn(),
  createSeason: vi.fn(),
  rolloverIfExpired: vi.fn(),
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
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminToken(): string {
  return signToken({ userId: 'admin-1', email: 'admin@test.com', role: 'admin' });
}

function userToken(): string {
  return signToken({ userId: 'user-1', email: 'user@test.com', role: 'user' });
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
    const res = await fetch(`${baseUrl}/ping`, {
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
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
