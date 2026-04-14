import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// vi.hoisted: mock objects must exist before vi.mock() factories (which are hoisted)
const { mockUser, mockUserCosmetic, mockTxUser, mockTxCosmetic, mockTransaction, mockGetCosmetic } =
  vi.hoisted(() => {
    const txUser = { update: vi.fn() };
    const txCosmetic = { findUnique: vi.fn(), create: vi.fn() };
    return {
      mockUser: { findUnique: vi.fn(), update: vi.fn() },
      mockUserCosmetic: { findUnique: vi.fn() },
      mockTxUser: txUser,
      mockTxCosmetic: txCosmetic,
      mockTransaction: vi.fn().mockImplementation((fn: Function) =>
        fn({ user: txUser, userCosmetic: txCosmetic })
      ),
      mockGetCosmetic: vi.fn(),
    };
  });

vi.mock('../services/db.ts', () => ({
  prisma: {
    user: mockUser,
    userCosmetic: mockUserCosmetic,
    $transaction: mockTransaction,
  },
}));

vi.mock('../../../shared/src/cosmetics.ts', () => ({
  getCosmetic: mockGetCosmetic,
}));

import { cosmeticsRouter } from '../routes/cosmetics.ts';
import { signToken } from '../middleware/auth.ts';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/cosmetics', cosmeticsRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/cosmetics`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve()))
  );
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

function makeToken(userId = 'user-1', email = 'pirate@sea.io') {
  return signToken({ userId, email });
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function makePaidCosmetic(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'skin.blackbeard',
    kind: 'ship_skin',
    name: "Blackbeard's Fury",
    price: 500,
    rarity: 'rare',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default transaction behaviour: not owned, gold deduction succeeds, create succeeds
  mockTxCosmetic.findUnique.mockResolvedValue(null);
  mockTxUser.update.mockResolvedValue({ gold: 900 });
  mockTxCosmetic.create.mockResolvedValue({});
});

// ─── GET /cosmetics/me ────────────────────────────────────────────────────────

describe('GET /cosmetics/me', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await fetch(`${baseUrl}/me`);
    expect(res.status).toBe(401);
  });

  it('returns gold, equipped slots, and owned cosmetic ids', async () => {
    mockUser.findUnique.mockResolvedValue({
      gold: 750,
      equippedShipSkin: 'skin.blackbeard',
      equippedBoardTheme: null,
      equippedExplosionFx: null,
      cosmetics: [
        { cosmeticId: 'skin.blackbeard', kind: 'ship_skin' },
      ],
    });

    const res = await fetch(`${baseUrl}/me`, { headers: authHeader(makeToken()) });

    expect(res.status).toBe(200);
    const body = await res.json() as {
      gold: number;
      equipped: { shipSkin: string; boardTheme: string; explosionFx: string };
      owned: string[];
    };
    expect(body.gold).toBe(750);
    expect(body.equipped.shipSkin).toBe('skin.blackbeard');
    expect(body.equipped.boardTheme).toBe('default');
    expect(body.equipped.explosionFx).toBe('default');
    expect(body.owned).toEqual(['skin.blackbeard']);
  });

  it('falls back to "default" for null equipped slots', async () => {
    mockUser.findUnique.mockResolvedValue({
      gold: 0,
      equippedShipSkin: null,
      equippedBoardTheme: null,
      equippedExplosionFx: null,
      cosmetics: [],
    });

    const res = await fetch(`${baseUrl}/me`, { headers: authHeader(makeToken()) });
    const body = await res.json() as { equipped: Record<string, string> };

    expect(body.equipped.shipSkin).toBe('default');
    expect(body.equipped.boardTheme).toBe('default');
    expect(body.equipped.explosionFx).toBe('default');
  });

  it('returns 404 when user record does not exist', async () => {
    mockUser.findUnique.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/me`, { headers: authHeader(makeToken()) });
    const body = await res.json() as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it('returns degraded response with dbUnavailable flag when DB throws', async () => {
    mockUser.findUnique.mockRejectedValue(new Error('Connection refused'));

    const res = await fetch(`${baseUrl}/me`, { headers: authHeader(makeToken()) });
    const body = await res.json() as {
      gold: number;
      owned: string[];
      dbUnavailable: boolean;
    };

    expect(res.status).toBe(200);
    expect(body.gold).toBe(0);
    expect(body.dbUnavailable).toBe(true);
    expect(body.owned).toContain('default');
  });
});

// ─── POST /cosmetics/buy ──────────────────────────────────────────────────────

describe('POST /cosmetics/buy', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when cosmeticId is missing from request body', async () => {
    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/cosmeticId required/i);
  });

  it('returns 404 when cosmetic does not exist in catalog', async () => {
    mockGetCosmetic.mockReturnValue(undefined);

    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'nonexistent' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 400 for a free cosmetic (price 0)', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'default', kind: 'ship_skin', price: 0 });

    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'default' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/already free/i);
  });

  it('returns 400 with "Already owned" when cosmetic already purchased', async () => {
    mockGetCosmetic.mockReturnValue(makePaidCosmetic());
    mockTxCosmetic.findUnique.mockResolvedValue({ userId: 'user-1', cosmeticId: 'skin.blackbeard' });

    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Already owned');
  });

  it('returns 400 with "Insufficient gold" when balance is too low', async () => {
    mockGetCosmetic.mockReturnValue(makePaidCosmetic({ price: 500 }));
    // tx.user.update throws when gold condition fails (Prisma P2025 pattern)
    mockTxUser.update.mockRejectedValue(new Error('P2025 record not found'));

    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/insufficient gold/i);
  });

  it('returns 200 with newBalance on successful purchase', async () => {
    mockGetCosmetic.mockReturnValue(makePaidCosmetic({ price: 500 }));
    mockTxUser.update.mockResolvedValue({ gold: 250 });

    const res = await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; newBalance: number };
    expect(body.ok).toBe(true);
    expect(body.newBalance).toBe(250);
  });

  it('checks ownership before deducting gold (not owned query runs first)', async () => {
    mockGetCosmetic.mockReturnValue(makePaidCosmetic());
    mockTxUser.update.mockResolvedValue({ gold: 400 });

    await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard' }),
    });

    // findUnique should be called before user.update
    const findOrder = mockTxCosmetic.findUnique.mock.invocationCallOrder[0];
    const updateOrder = mockTxUser.update.mock.invocationCallOrder[0];
    expect(findOrder).toBeLessThan(updateOrder);
  });

  it('creates a userCosmetic record on successful purchase', async () => {
    mockGetCosmetic.mockReturnValue(makePaidCosmetic({ id: 'skin.blackbeard', kind: 'ship_skin', price: 500 }));
    mockTxUser.update.mockResolvedValue({ gold: 100 });

    await fetch(`${baseUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken('user-42')) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard' }),
    });

    expect(mockTxCosmetic.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-42',
          cosmeticId: 'skin.blackbeard',
          kind: 'ship_skin',
        }),
      })
    );
  });
});

// ─── POST /cosmetics/equip ────────────────────────────────────────────────────

describe('POST /cosmetics/equip', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard', kind: 'ship_skin' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when cosmeticId is not found in catalog', async () => {
    mockGetCosmetic.mockReturnValue(undefined);

    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'nonexistent', kind: 'ship_skin' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid cosmetic/i);
  });

  it('returns 400 when kind does not match the cosmetic definition', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'skin.blackbeard', kind: 'ship_skin', price: 500 });

    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard', kind: 'board_theme' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid cosmetic/i);
  });

  it('returns 403 when player does not own the paid cosmetic', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'skin.blackbeard', kind: 'ship_skin', price: 500 });
    mockUserCosmetic.findUnique.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard', kind: 'ship_skin' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not owned/i);
  });

  it('equips a free (price 0) cosmetic without an ownership check', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'default', kind: 'ship_skin', price: 0 });
    mockUser.update.mockResolvedValue({});

    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'default', kind: 'ship_skin' }),
    });

    expect(res.status).toBe(200);
    expect(mockUserCosmetic.findUnique).not.toHaveBeenCalled();
  });

  it('returns ok: true on successful equip', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'skin.blackbeard', kind: 'ship_skin', price: 500 });
    mockUserCosmetic.findUnique.mockResolvedValue({ userId: 'user-1', cosmeticId: 'skin.blackbeard' });
    mockUser.update.mockResolvedValue({});

    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard', kind: 'ship_skin' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('updates equippedShipSkin field when kind is ship_skin', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'skin.blackbeard', kind: 'ship_skin', price: 500 });
    mockUserCosmetic.findUnique.mockResolvedValue({ userId: 'user-1', cosmeticId: 'skin.blackbeard' });
    mockUser.update.mockResolvedValue({});

    await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken('user-1')) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard', kind: 'ship_skin' }),
    });

    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { equippedShipSkin: 'skin.blackbeard' },
      })
    );
  });

  it('updates equippedBoardTheme field when kind is board_theme', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'theme.obsidian', kind: 'board_theme', price: 800 });
    mockUserCosmetic.findUnique.mockResolvedValue({ userId: 'user-1', cosmeticId: 'theme.obsidian' });
    mockUser.update.mockResolvedValue({});

    await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken('user-1')) },
      body: JSON.stringify({ cosmeticId: 'theme.obsidian', kind: 'board_theme' }),
    });

    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { equippedBoardTheme: 'theme.obsidian' },
      })
    );
  });

  it('updates equippedExplosionFx field when kind is explosion_fx', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'fx.inferno', kind: 'explosion_fx', price: 600 });
    mockUserCosmetic.findUnique.mockResolvedValue({ userId: 'user-1', cosmeticId: 'fx.inferno' });
    mockUser.update.mockResolvedValue({});

    await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken('user-1')) },
      body: JSON.stringify({ cosmeticId: 'fx.inferno', kind: 'explosion_fx' }),
    });

    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { equippedExplosionFx: 'fx.inferno' },
      })
    );
  });

  it('returns 500 when DB throws during equip', async () => {
    mockGetCosmetic.mockReturnValue({ id: 'skin.blackbeard', kind: 'ship_skin', price: 500 });
    mockUserCosmetic.findUnique.mockRejectedValue(new Error('DB down'));

    const res = await fetch(`${baseUrl}/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(makeToken()) },
      body: JSON.stringify({ cosmeticId: 'skin.blackbeard', kind: 'ship_skin' }),
    });

    expect(res.status).toBe(500);
  });
});
