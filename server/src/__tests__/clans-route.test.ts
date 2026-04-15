import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// vi.hoisted: mock objects must exist before vi.mock() factories (which are hoisted)
const { mockUser, mockClanChatMessage, mockAddChatMessage } = vi.hoisted(() => ({
  mockUser: {
    findUnique: vi.fn(),
  },
  mockClanChatMessage: {
    create: vi.fn(),
  },
  mockAddChatMessage: vi.fn(),
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    user: mockUser,
    clanChatMessage: mockClanChatMessage,
  },
}));

vi.mock('../services/clans.ts', () => ({
  listClans: vi.fn(),
  getClanDetail: vi.fn(),
  createClan: vi.fn(),
  joinClan: vi.fn(),
  leaveClan: vi.fn(),
  addChatMessage: mockAddChatMessage,
}));

import { clansRouter } from '../routes/clans.ts';
import { signToken } from '../middleware/auth.ts';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/clans', clansRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/clans`;
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

// Each call returns a fresh unique userId so tests don't share rate-limit state
let userIdCounter = 0;
function makeToken(userId?: string) {
  const id = userId ?? `test-user-${++userIdCounter}`;
  return { userId: id, token: signToken({ userId: id, email: `${id}@test.com` }) };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function setupMemberMock(userId: string, clanId = 'clan-1') {
  mockUser.findUnique.mockResolvedValue({ username: 'Ironbeard', clanId });
  mockAddChatMessage.mockResolvedValue({ id: 'msg-1', createdAt: '2026-01-01T00:00:00.000Z' });
  return { userId, clanId };
}

// ─── POST /clans/:id/chat — validation ────────────────────────────────────────

describe('POST /clans/:id/chat — validation', () => {
  it('returns 401 when no auth token is provided', async () => {
    const res = await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Ahoy!' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when text is missing', async () => {
    const { token } = makeToken();
    const res = await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/text required/i);
  });

  it('returns 400 when text is not a string', async () => {
    const { token } = makeToken();
    const res = await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text: 42 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when user is not a member of the clan', async () => {
    const { userId, token } = makeToken();
    mockUser.findUnique.mockResolvedValue({ username: 'Ironbeard', clanId: 'different-clan' });

    const res = await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text: 'Ahoy!' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not a member/i);
    void userId;
  });

  it('returns 403 when user is not in any clan', async () => {
    const { token } = makeToken();
    mockUser.findUnique.mockResolvedValue({ username: 'Ironbeard', clanId: null });

    const res = await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text: 'Ahoy!' }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── POST /clans/:id/chat — happy path ────────────────────────────────────────

describe('POST /clans/:id/chat — happy path', () => {
  it('returns 200 with ok and message on success', async () => {
    const { userId, token } = makeToken();
    setupMemberMock(userId);

    const res = await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text: 'Ahoy!' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; message: unknown };
    expect(body.ok).toBe(true);
    expect(body.message).toBeDefined();
  });

  it('truncates message text to 200 characters', async () => {
    const { userId, token } = makeToken();
    setupMemberMock(userId);
    const longText = 'x'.repeat(300);

    await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text: longText }),
    });

    expect(mockAddChatMessage).toHaveBeenCalledWith(
      'clan-1',
      userId,
      'Ironbeard',
      'x'.repeat(200)
    );
  });

  it('calls addChatMessage with correct clanId, userId, username, and text', async () => {
    const { userId, token } = makeToken();
    setupMemberMock(userId);

    await fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text: 'Shiver me timbers!' }),
    });

    expect(mockAddChatMessage).toHaveBeenCalledWith(
      'clan-1',
      userId,
      'Ironbeard',
      'Shiver me timbers!'
    );
  });
});

// ─── POST /clans/:id/chat — rate limiting ─────────────────────────────────────

describe('POST /clans/:id/chat — rate limiting', () => {
  async function sendChat(token: string, userId: string, text = 'Ahoy!') {
    return fetch(`${baseUrl}/clan-1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ text }),
    });
  }

  it('allows up to 5 messages from the same user', async () => {
    const { userId, token } = makeToken();
    setupMemberMock(userId);

    for (let i = 0; i < 5; i++) {
      mockAddChatMessage.mockResolvedValue({ id: `msg-${i}`, createdAt: '2026-01-01T00:00:00.000Z' });
      const res = await sendChat(token, userId);
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 on the 6th message within the 10-second window', async () => {
    const { userId, token } = makeToken();
    setupMemberMock(userId);

    // Send 5 allowed messages
    for (let i = 0; i < 5; i++) {
      mockAddChatMessage.mockResolvedValue({ id: `msg-${i}`, createdAt: '2026-01-01T00:00:00.000Z' });
      await sendChat(token, userId);
    }

    // 6th message should be rate-limited
    const res = await sendChat(token, userId);
    expect(res.status).toBe(429);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/slow down/i);
  });

  it('does not call addChatMessage when rate-limited', async () => {
    const { userId, token } = makeToken();
    setupMemberMock(userId);

    for (let i = 0; i < 5; i++) {
      mockAddChatMessage.mockResolvedValue({ id: `msg-${i}`, createdAt: '2026-01-01T00:00:00.000Z' });
      await sendChat(token, userId);
    }

    vi.clearAllMocks();
    await sendChat(token, userId);

    // addChatMessage should NOT be called when rate-limited
    expect(mockAddChatMessage).not.toHaveBeenCalled();
  });

  it('rate limits are per-user — different users do not share the limit', async () => {
    const userA = makeToken();
    const userB = makeToken();

    // Exhaust userA's rate limit
    mockUser.findUnique.mockResolvedValue({ username: 'Ironbeard', clanId: 'clan-1' });
    for (let i = 0; i < 5; i++) {
      mockAddChatMessage.mockResolvedValue({ id: `msg-${i}`, createdAt: '2026-01-01T00:00:00.000Z' });
      await sendChat(userA.token, userA.userId);
    }

    // UserA is now rate-limited
    const resA = await sendChat(userA.token, userA.userId);
    expect(resA.status).toBe(429);

    // UserB should still be allowed
    mockAddChatMessage.mockResolvedValue({ id: 'msg-b', createdAt: '2026-01-01T00:00:00.000Z' });
    const resB = await sendChat(userB.token, userB.userId);
    expect(resB.status).toBe(200);
  });
});
