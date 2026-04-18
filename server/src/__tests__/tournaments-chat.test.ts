import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockTournament, mockTournamentChatMessage, mockListTournaments, mockGetTournamentDetail } = vi.hoisted(() => ({
  mockTournament: {
    findUnique: vi.fn(),
  },
  mockTournamentChatMessage: {
    findMany: vi.fn(),
  },
  mockListTournaments: vi.fn(),
  mockGetTournamentDetail: vi.fn(),
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    tournament: mockTournament,
    tournamentChatMessage: mockTournamentChatMessage,
  },
}));

vi.mock('../services/tournaments.ts', () => ({
  listTournaments: mockListTournaments,
  getTournamentDetail: mockGetTournamentDetail,
  createTournament: vi.fn(),
  joinTournament: vi.fn(),
  getTournamentLeaderboard: vi.fn(),
}));

import { tournamentsRouter } from '../routes/tournaments.ts';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/tournaments', tournamentsRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/tournaments`;
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

function makeChatRow(overrides: Partial<{ id: string; tournamentId: string; userId: string; username: string; text: string; createdAt: Date }> = {}) {
  return {
    id: 'msg-1',
    tournamentId: 'tourney-1',
    userId: 'user-1',
    username: 'Ironbeard',
    text: 'Ready to compete!',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ─── GET /:id/chat ─────────────────────────────────────────────────────────────

describe('GET /tournaments/:id/chat', () => {
  it('returns empty array when no messages exist', async () => {
    mockTournamentChatMessage.findMany.mockResolvedValue([]);
    const res = await fetch(`${baseUrl}/tourney-1/chat`);
    expect(res.status).toBe(200);
    const body = await res.json() as { messages: unknown[] };
    expect(body.messages).toEqual([]);
  });

  it('returns messages in chronological order (oldest first)', async () => {
    // findMany returns desc order (newest first), route reverses it
    const msg1 = makeChatRow({ id: 'msg-2', createdAt: new Date('2026-01-01T00:00:02.000Z'), text: 'Second' });
    const msg2 = makeChatRow({ id: 'msg-1', createdAt: new Date('2026-01-01T00:00:01.000Z'), text: 'First' });
    mockTournamentChatMessage.findMany.mockResolvedValue([msg1, msg2]);

    const res = await fetch(`${baseUrl}/tourney-1/chat`);
    expect(res.status).toBe(200);
    const body = await res.json() as { messages: Array<{ id: string }> };
    // After .reverse(), chronological order should be msg2 then msg1
    expect(body.messages[0].id).toBe('msg-1');
    expect(body.messages[1].id).toBe('msg-2');
  });

  it('queries with tournamentId filter, desc order, limit 100', async () => {
    mockTournamentChatMessage.findMany.mockResolvedValue([]);
    await fetch(`${baseUrl}/tourney-abc/chat`);
    expect(mockTournamentChatMessage.findMany).toHaveBeenCalledWith({
      where: { tournamentId: 'tourney-abc' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('returns 500 when DB throws', async () => {
    mockTournamentChatMessage.findMany.mockRejectedValue(new Error('DB down'));
    const res = await fetch(`${baseUrl}/tourney-1/chat`);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Chat unavailable');
  });

  it('serializes message fields correctly', async () => {
    const row = makeChatRow();
    mockTournamentChatMessage.findMany.mockResolvedValue([row]);
    const res = await fetch(`${baseUrl}/tourney-1/chat`);
    const body = await res.json() as { messages: Array<Record<string, unknown>> };
    expect(body.messages).toHaveLength(1);
    const msg = body.messages[0];
    expect(msg.id).toBe('msg-1');
    expect(msg.tournamentId).toBe('tourney-1');
    expect(msg.userId).toBe('user-1');
    expect(msg.username).toBe('Ironbeard');
    expect(msg.text).toBe('Ready to compete!');
    expect(msg.createdAt).toBeDefined();
  });
});
