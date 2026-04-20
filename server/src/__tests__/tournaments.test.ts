import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock factories (which are hoisted to top of file)
const {
  mockTournament,
  mockTournamentEntry,
  mockTournamentMatch,
  mockPlayerStats,
  mockUser,
} = vi.hoisted(() => ({
  mockTournament: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  mockTournamentEntry: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  mockTournamentMatch: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockPlayerStats: {
    findUnique: vi.fn(),
  },
  mockUser: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    tournament: mockTournament,
    tournamentEntry: mockTournamentEntry,
    tournamentMatch: mockTournamentMatch,
    playerStats: mockPlayerStats,
    user: mockUser,
  },
}));

import {
  listTournaments,
  createTournament,
  joinTournament,
  onTournamentMatchComplete,
  getNextReadyMatchForUser,
  getTournamentLeaderboard,
  getTournamentDetail,
} from '../services/tournaments.ts';

function makeTournamentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    name: 'Test Cup',
    status: 'lobby',
    maxPlayers: 4,
    createdBy: 'user1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    startedAt: null,
    finishedAt: null,
    winnerId: null,
    _count: { entries: 2 },
    ...overrides,
  };
}

function makeTournamentMatchRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tm1',
    tournamentId: 't1',
    round: 0,
    bracketIdx: 0,
    p1UserId: 'user1',
    p2UserId: 'user2',
    winnerUserId: null,
    matchId: null,
    status: 'ready',
    tournament: { maxPlayers: 4, id: 't1', status: 'active' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listTournaments ─────────────────────────────────────────────────────────

describe('listTournaments', () => {
  it('returns empty array when DB throws', async () => {
    mockTournament.findMany.mockRejectedValue(new Error('DB error'));
    const result = await listTournaments();
    expect(result).toEqual([]);
  });

  it('returns mapped TournamentSummary[] on success', async () => {
    mockTournament.findMany.mockResolvedValue([makeTournamentRow()]);
    const result = await listTournaments();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 't1',
      name: 'Test Cup',
      status: 'lobby',
      maxPlayers: 4,
      playerCount: 2,
      createdBy: 'user1',
    });
  });

  it('includes ISO string dates in summary', async () => {
    mockTournament.findMany.mockResolvedValue([
      makeTournamentRow({
        startedAt: new Date('2026-02-01T00:00:00Z'),
        finishedAt: new Date('2026-02-02T00:00:00Z'),
      }),
    ]);
    const result = await listTournaments();
    expect(result[0].startedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(result[0].finishedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('handles empty result set', async () => {
    mockTournament.findMany.mockResolvedValue([]);
    const result = await listTournaments();
    expect(result).toEqual([]);
  });
});

// ─── createTournament ────────────────────────────────────────────────────────

describe('createTournament', () => {
  it('rejects invalid maxPlayers sizes', async () => {
    for (const size of [1, 2, 3, 5, 7, 32]) {
      const result = await createTournament('user1', 'Cup', size);
      expect(result).toEqual({ error: 'Invalid size' });
    }
    expect(mockTournament.create).not.toHaveBeenCalled();
  });

  it('accepts valid sizes 4, 8, 16', async () => {
    mockTournament.create.mockResolvedValue({ id: 't1' });
    for (const size of [4, 8, 16]) {
      vi.clearAllMocks();
      mockTournament.create.mockResolvedValue({ id: 't1' });
      const result = await createTournament('user1', 'Cup', size);
      expect(result).toEqual({ id: 't1' });
    }
  });

  it('returns tournament id on success', async () => {
    mockTournament.create.mockResolvedValue({ id: 'new-tournament-id' });
    const result = await createTournament('user1', 'Grand Cup', 8);
    expect(result).toEqual({ id: 'new-tournament-id' });
    expect(mockTournament.create).toHaveBeenCalledWith({
      data: { name: 'Grand Cup', maxPlayers: 8, createdBy: 'user1', status: 'lobby' },
    });
  });

  it('returns offline error when DB throws', async () => {
    mockTournament.create.mockRejectedValue(new Error('DB error'));
    const result = await createTournament('user1', 'Cup', 4);
    expect(result).toEqual({ error: 'Tournaments unavailable offline' });
  });
});

// ─── joinTournament ──────────────────────────────────────────────────────────

describe('joinTournament', () => {
  it('returns error when tournament not found', async () => {
    mockTournament.findUnique.mockResolvedValue(null);
    const result = await joinTournament('user1', 't1');
    expect(result).toEqual({ error: 'Tournament not found' });
  });

  it('returns error when tournament already started', async () => {
    mockTournament.findUnique.mockResolvedValue({
      ...makeTournamentRow({ status: 'active' }),
      entries: [],
    });
    const result = await joinTournament('user1', 't1');
    expect(result).toEqual({ error: 'Tournament already started' });
  });

  it('returns error when tournament is full', async () => {
    const entries = [
      { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u4' },
    ];
    mockTournament.findUnique.mockResolvedValue({
      ...makeTournamentRow({ maxPlayers: 4, status: 'lobby' }),
      entries,
    });
    const result = await joinTournament('user5', 't1');
    expect(result).toEqual({ error: 'Tournament full' });
  });

  it('returns error when user already joined', async () => {
    mockTournament.findUnique.mockResolvedValue({
      ...makeTournamentRow({ status: 'lobby' }),
      entries: [{ userId: 'user1' }],
    });
    const result = await joinTournament('user1', 't1');
    expect(result).toEqual({ error: 'Already joined' });
  });

  it('returns { ok: true, started: false } when joining with room remaining', async () => {
    mockTournament.findUnique.mockResolvedValue({
      ...makeTournamentRow({ maxPlayers: 4, status: 'lobby' }),
      entries: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    mockTournamentEntry.create.mockResolvedValue({});
    const result = await joinTournament('u3', 't1');
    expect(result).toEqual({ ok: true, started: false });
  });

  it('returns { ok: true, started: true } and starts tournament when last slot filled', async () => {
    // First findUnique (joinTournament guard check): 3 entries already, maxPlayers=4
    mockTournament.findUnique
      .mockResolvedValueOnce({
        ...makeTournamentRow({ id: 't1', maxPlayers: 4, status: 'lobby' }),
        entries: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }],
      })
      // Second findUnique (startTournamentInternal): includes entries for seeding
      .mockResolvedValueOnce({
        ...makeTournamentRow({ id: 't1', maxPlayers: 4 }),
        entries: [
          { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }, { userId: 'u4' },
        ],
      });
    mockTournamentEntry.create.mockResolvedValue({});
    // Mock playerStats for each of 4 entries
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1500 });
    // Mock tournamentMatch.create for round-0 matches and subsequent rounds
    mockTournamentMatch.create.mockResolvedValue({ id: 'match1' });
    mockTournament.update.mockResolvedValue({});

    const result = await joinTournament('u4', 't1');
    expect(result).toEqual({ ok: true, started: true });
    expect(mockTournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ status: 'active' }),
      })
    );
  });

  it('returns offline error when DB throws', async () => {
    mockTournament.findUnique.mockRejectedValue(new Error('DB error'));
    const result = await joinTournament('u1', 't1');
    expect(result).toEqual({ error: 'Tournaments unavailable offline' });
  });
});

// ─── onTournamentMatchComplete ───────────────────────────────────────────────

describe('onTournamentMatchComplete', () => {
  it('returns null when match not found', async () => {
    mockTournamentMatch.findUnique.mockResolvedValue(null);
    const result = await onTournamentMatchComplete('tm1', 'user1');
    expect(result).toBeNull();
  });

  it('returns null when DB throws', async () => {
    mockTournamentMatch.findUnique.mockRejectedValue(new Error('DB error'));
    const result = await onTournamentMatchComplete('tm1', 'user1');
    expect(result).toBeNull();
  });

  it('advances winner to next bracket slot on non-final round', async () => {
    // round=0, bracketIdx=0, totalRounds(4)=2, so not final (final is round 1)
    const tm = makeTournamentMatchRow({
      round: 0,
      bracketIdx: 0,
      p1UserId: 'user1',
      p2UserId: 'user2',
      tournament: { maxPlayers: 4 },
    });
    mockTournamentMatch.findUnique.mockResolvedValue(tm);
    mockTournamentMatch.update.mockResolvedValue({});
    mockTournamentEntry.updateMany.mockResolvedValue({});
    // findFirst for next match
    mockTournamentMatch.findFirst.mockResolvedValue({
      id: 'tm-next',
      p1UserId: null,
      p2UserId: null,
    });

    const result = await onTournamentMatchComplete('tm1', 'user1');
    expect(result).toEqual({ tournamentFinished: false, tournamentId: 't1' });
    expect(mockTournamentMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tm1' }, data: expect.objectContaining({ winnerUserId: 'user1', status: 'done' }) })
    );
  });

  it('advances winner to p2 slot when bracketIdx is odd', async () => {
    // bracketIdx=1, nextBracketSlot(1) => nextBracketIdx=0, slot='p2'
    const tm = makeTournamentMatchRow({
      round: 0,
      bracketIdx: 1,
      p1UserId: 'user3',
      p2UserId: 'user4',
      tournament: { maxPlayers: 4 },
    });
    mockTournamentMatch.findUnique.mockResolvedValue(tm);
    mockTournamentMatch.update.mockResolvedValue({});
    mockTournamentEntry.updateMany.mockResolvedValue({});
    mockTournamentMatch.findFirst.mockResolvedValue({
      id: 'tm-next',
      p1UserId: 'user1',  // p1 already filled
      p2UserId: null,
    });

    const result = await onTournamentMatchComplete('tm1', 'user3');
    expect(result).toEqual({ tournamentFinished: false, tournamentId: 't1' });
    // Status stays 'pending' — admin must advance the round
    const lastCall = mockTournamentMatch.update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(lastCall.data.p2UserId).toBe('user3');
    expect(lastCall.data.status).toBeUndefined();
  });

  it('finalizes tournament on final round and awards gold', async () => {
    // round=1 is final for maxPlayers=4 (totalRounds=2, final is round 1)
    const tm = makeTournamentMatchRow({
      round: 1,
      bracketIdx: 0,
      p1UserId: 'winner',
      p2UserId: 'loser',
      tournament: { maxPlayers: 4 },
    });
    mockTournamentMatch.findUnique.mockResolvedValue(tm);
    mockTournamentMatch.update.mockResolvedValue({});
    mockTournamentEntry.updateMany.mockResolvedValue({});
    mockTournament.update.mockResolvedValue({});
    // awardGold calls user.update for each award
    mockUser.update.mockResolvedValue({ gold: 500 });

    const result = await onTournamentMatchComplete('tm1', 'winner');
    expect(result).toEqual({ tournamentFinished: true, tournamentId: 't1' });
    expect(mockTournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ status: 'finished', winnerId: 'winner' }),
      })
    );
  });

  it('marks loser as eliminated when loser is p2', async () => {
    const tm = makeTournamentMatchRow({
      round: 0,
      bracketIdx: 0,
      p1UserId: 'winner',
      p2UserId: 'loser',
      tournament: { maxPlayers: 4 },
    });
    mockTournamentMatch.findUnique.mockResolvedValue(tm);
    mockTournamentMatch.update.mockResolvedValue({});
    mockTournamentEntry.updateMany.mockResolvedValue({});
    mockTournamentMatch.findFirst.mockResolvedValue(null);

    await onTournamentMatchComplete('tm1', 'winner');
    expect(mockTournamentEntry.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: 't1', userId: 'loser' },
      data: { eliminated: true },
    });
  });
});

// ─── getNextReadyMatchForUser ─────────────────────────────────────────────────

describe('getNextReadyMatchForUser', () => {
  it('returns null when no ready match found', async () => {
    mockTournamentMatch.findFirst.mockResolvedValue(null);
    const result = await getNextReadyMatchForUser('user1');
    expect(result).toBeNull();
  });

  it('returns null when match has no players set', async () => {
    mockTournamentMatch.findFirst.mockResolvedValue({
      id: 'tm1',
      tournamentId: 't1',
      p1UserId: null,
      p2UserId: null,
    });
    const result = await getNextReadyMatchForUser('user1');
    expect(result).toBeNull();
  });

  it('returns match info with correct opponent when user is p1', async () => {
    mockTournamentMatch.findFirst.mockResolvedValue({
      id: 'tm1',
      tournamentId: 't1',
      p1UserId: 'user1',
      p2UserId: 'user2',
    });
    const result = await getNextReadyMatchForUser('user1');
    expect(result).toEqual({
      tournamentMatchId: 'tm1',
      tournamentId: 't1',
      opponentUserId: 'user2',
    });
  });

  it('returns match info with correct opponent when user is p2', async () => {
    mockTournamentMatch.findFirst.mockResolvedValue({
      id: 'tm1',
      tournamentId: 't1',
      p1UserId: 'user1',
      p2UserId: 'user2',
    });
    const result = await getNextReadyMatchForUser('user2');
    expect(result).toEqual({
      tournamentMatchId: 'tm1',
      tournamentId: 't1',
      opponentUserId: 'user1',
    });
  });

  it('returns null when DB throws', async () => {
    mockTournamentMatch.findFirst.mockRejectedValue(new Error('DB error'));
    const result = await getNextReadyMatchForUser('user1');
    expect(result).toBeNull();
  });
});

// ─── getTournamentLeaderboard ─────────────────────────────────────────────────

describe('getTournamentLeaderboard', () => {
  it('returns empty array when DB throws', async () => {
    mockTournament.groupBy.mockRejectedValue(new Error('DB error'));
    const result = await getTournamentLeaderboard();
    expect(result).toEqual([]);
  });

  it('returns leaderboard with usernames on success', async () => {
    mockTournament.groupBy.mockResolvedValue([
      { winnerId: 'user1', _count: { _all: 3 } },
      { winnerId: 'user2', _count: { _all: 1 } },
    ]);
    mockUser.findMany.mockResolvedValue([
      { id: 'user1', username: 'Captain Jack' },
      { id: 'user2', username: 'Bluebeard' },
    ]);
    const result = await getTournamentLeaderboard();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ userId: 'user1', username: 'Captain Jack', wins: 3 });
    expect(result[1]).toEqual({ userId: 'user2', username: 'Bluebeard', wins: 1 });
  });

  it('falls back to Unknown for missing usernames', async () => {
    mockTournament.groupBy.mockResolvedValue([
      { winnerId: 'user-gone', _count: { _all: 2 } },
    ]);
    mockUser.findMany.mockResolvedValue([]);
    const result = await getTournamentLeaderboard();
    expect(result[0].username).toBe('Unknown');
  });
});

// ─── getTournamentDetail ──────────────────────────────────────────────────────

describe('getTournamentDetail', () => {
  it('returns null when tournament not found', async () => {
    mockTournament.findUnique.mockResolvedValue(null);
    const result = await getTournamentDetail('t1');
    expect(result).toBeNull();
  });

  it('returns null when DB throws', async () => {
    mockTournament.findUnique.mockRejectedValue(new Error('DB error'));
    const result = await getTournamentDetail('t1');
    expect(result).toBeNull();
  });

  it('returns full TournamentDetail on success', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    mockTournament.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Grand Cup',
      status: 'active',
      maxPlayers: 4,
      createdBy: 'user1',
      createdAt,
      startedAt: null,
      finishedAt: null,
      winnerId: null,
      entries: [
        { userId: 'user1', seed: 0, eliminated: false },
        { userId: 'user2', seed: 1, eliminated: false },
      ],
      matches: [
        {
          id: 'tm1',
          round: 0,
          bracketIdx: 0,
          p1UserId: 'user1',
          p2UserId: 'user2',
          winnerUserId: null,
          matchId: null,
          status: 'ready',
        },
      ],
    });
    mockUser.findMany.mockResolvedValue([
      { id: 'user1', username: 'Ironbeard' },
      { id: 'user2', username: 'Mistral' },
    ]);

    const result = await getTournamentDetail('t1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('t1');
    expect(result!.name).toBe('Grand Cup');
    expect(result!.entries).toHaveLength(2);
    expect(result!.entries[0]).toMatchObject({ userId: 'user1', username: 'Ironbeard', seed: 0 });
    expect(result!.matches).toHaveLength(1);
    expect(result!.matches[0]).toMatchObject({
      id: 'tm1',
      p1Username: 'Ironbeard',
      p2Username: 'Mistral',
    });
  });
});
