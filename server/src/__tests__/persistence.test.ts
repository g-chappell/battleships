import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock factories (which are hoisted to top of file)
const {
  mockPlayerStats,
  mockSeasonPlayerStats,
  mockMatch,
  mockUser,
  mockGetActiveSeason,
  mockIncrementClanStats,
  mockAwardGold,
  mockRewardForMode,
} = vi.hoisted(() => ({
  mockPlayerStats: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  mockSeasonPlayerStats: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  mockMatch: {
    create: vi.fn(),
  },
  mockUser: {
    findUnique: vi.fn(),
  },
  mockGetActiveSeason: vi.fn(),
  mockIncrementClanStats: vi.fn(),
  mockAwardGold: vi.fn(),
  mockRewardForMode: vi.fn(),
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    playerStats: mockPlayerStats,
    seasonPlayerStats: mockSeasonPlayerStats,
    match: mockMatch,
    user: mockUser,
  },
}));

vi.mock('../services/seasons.ts', () => ({
  getActiveSeason: mockGetActiveSeason,
}));

vi.mock('../services/clans.ts', () => ({
  incrementClanStats: mockIncrementClanStats,
}));

vi.mock('../services/gold.ts', () => ({
  awardGold: mockAwardGold,
  rewardForMode: mockRewardForMode,
}));

import { persistMatch, persistAIMatch } from '../services/persistence.ts';
import type { MatchPersistInput } from '../services/persistence.ts';

// Default rewards returned by mocked rewardForMode
const WIN_REWARD = { amount: 100, reason: 'WIN_MP_RANKED' };
const LOSS_REWARD = { amount: 10, reason: 'LOSS_CONSOLATION' };

function makeMatchInput(overrides: Partial<MatchPersistInput> = {}): MatchPersistInput {
  return {
    player1Id: 'user1',
    player2Id: 'user2',
    winnerId: 'user1',
    isRanked: false,
    mode: 'private',
    turns: 30,
    durationMs: 60_000,
    p1Accuracy: 0.5,
    p2Accuracy: 0.4,
    p1ShipsSunk: 3,
    p2ShipsSunk: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no season active
  mockGetActiveSeason.mockResolvedValue(null);
  // Default: match create returns a match with id
  mockMatch.create.mockResolvedValue({ id: 'match-abc' });
  // Default: awardGold succeeds
  mockAwardGold.mockResolvedValue({ newBalance: 200 });
  // Default: rewardForMode returns win or loss reward based on second arg
  mockRewardForMode.mockImplementation((_mode: string, won: boolean) =>
    won ? WIN_REWARD : LOSS_REWARD
  );
  // Default: no players in clans
  mockUser.findUnique.mockResolvedValue({ clanId: null });
  // Default: playerStats not found (new players)
  mockPlayerStats.findUnique.mockResolvedValue(null);
  mockPlayerStats.upsert.mockResolvedValue({});
  // Default: no season player stats
  mockSeasonPlayerStats.findUnique.mockResolvedValue(null);
  mockSeasonPlayerStats.upsert.mockResolvedValue({});
});

// ─── persistMatch — guest player handling ────────────────────────────────────

describe('persistMatch — guest player handling', () => {
  it('returns null when player1Id is a guest', async () => {
    const result = await persistMatch(makeMatchInput({ player1Id: 'guest_abc' }));
    expect(result).toBeNull();
  });

  it('returns null when player2Id is a guest', async () => {
    const result = await persistMatch(makeMatchInput({ player2Id: 'guest_xyz' }));
    expect(result).toBeNull();
  });

  it('does not create a match record for guest games', async () => {
    await persistMatch(makeMatchInput({ player1Id: 'guest_abc' }));
    expect(mockMatch.create).not.toHaveBeenCalled();
  });

  it('does not award gold for guest games', async () => {
    await persistMatch(makeMatchInput({ player2Id: 'guest_xyz' }));
    expect(mockAwardGold).not.toHaveBeenCalled();
  });
});

// ─── persistMatch — non-ranked match ─────────────────────────────────────────

describe('persistMatch — non-ranked match', () => {
  it('creates a match record with all input fields', async () => {
    const input = makeMatchInput({
      mode: 'private',
      isRanked: false,
      turns: 42,
      durationMs: 90_000,
      p1Accuracy: 0.6,
      p2Accuracy: 0.35,
      p1ShipsSunk: 4,
      p2ShipsSunk: 1,
    });
    await persistMatch(input);
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        player1Id: 'user1',
        player2Id: 'user2',
        winnerId: 'user1',
        mode: 'private',
        turns: 42,
        durationMs: 90_000,
        p1Accuracy: 0.6,
        p2Accuracy: 0.35,
        p1ShipsSunk: 4,
        p2ShipsSunk: 1,
      }),
    });
  });

  it('includes events in match record when provided', async () => {
    const events = [{ type: 'shot', tick: 1 } as any];
    await persistMatch(makeMatchInput({ events }));
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ events }),
    });
  });

  it('returns matchId from created record', async () => {
    mockMatch.create.mockResolvedValue({ id: 'match-99' });
    const result = await persistMatch(makeMatchInput());
    expect(result?.matchId).toBe('match-99');
  });

  it('returns goldAwarded for both players', async () => {
    const result = await persistMatch(makeMatchInput({ winnerId: 'user1' }));
    expect(result?.goldAwarded).toEqual({ p1: WIN_REWARD.amount, p2: LOSS_REWARD.amount });
  });

  it('returns no ratingDelta for non-ranked match', async () => {
    const result = await persistMatch(makeMatchInput({ isRanked: false }));
    expect(result?.ratingDelta).toBeUndefined();
  });

  it('does not upsert playerStats for non-ranked match', async () => {
    await persistMatch(makeMatchInput({ isRanked: false }));
    expect(mockPlayerStats.upsert).not.toHaveBeenCalled();
  });

  it('defaults mode to "private" when not provided and not ranked', async () => {
    const input = makeMatchInput({ isRanked: false });
    delete (input as any).mode;
    await persistMatch(input);
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: 'private' }),
    });
  });

  it('defaults mode to "ranked" when not provided and isRanked is true', async () => {
    const input = makeMatchInput({ isRanked: true });
    delete (input as any).mode;
    mockPlayerStats.findUnique.mockResolvedValue(null);
    await persistMatch(input);
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: 'ranked' }),
    });
  });
});

// ─── persistMatch — ranked match ELO ─────────────────────────────────────────

describe('persistMatch — ranked match ELO', () => {
  it('upserts playerStats for both players', async () => {
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockPlayerStats.upsert).toHaveBeenCalledTimes(2);
  });

  it('fetches playerStats for both players to determine current ratings', async () => {
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockPlayerStats.findUnique).toHaveBeenCalledWith({ where: { userId: 'user1' } });
    expect(mockPlayerStats.findUnique).toHaveBeenCalledWith({ where: { userId: 'user2' } });
  });

  it('uses default rating 1200 when playerStats not found', async () => {
    mockPlayerStats.findUnique.mockResolvedValue(null);
    const result = await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    // Both start at 1200, winner should gain rating and loser lose
    expect(result?.ratingDelta?.p1).toBeGreaterThan(0);
    expect(result?.ratingDelta?.p2).toBeLessThan(0);
  });

  it('winner gets positive ELO delta, loser gets negative delta', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1200 });
    const result = await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    expect(result?.ratingDelta?.p1).toBeGreaterThan(0);
    expect(result?.ratingDelta?.p2).toBeLessThan(0);
  });

  it('higher-rated winner gains less ELO than lower-rated winner', async () => {
    // p1 (winner) has much higher rating → should gain less
    mockPlayerStats.findUnique
      .mockResolvedValueOnce({ rating: 1800 }) // p1 high rated
      .mockResolvedValueOnce({ rating: 1200 }); // p2 low rated
    const resultFavored = await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));

    vi.clearAllMocks();
    mockGetActiveSeason.mockResolvedValue(null);
    mockMatch.create.mockResolvedValue({ id: 'match-2' });
    mockAwardGold.mockResolvedValue({ newBalance: 200 });
    mockRewardForMode.mockImplementation((_: string, won: boolean) => won ? WIN_REWARD : LOSS_REWARD);
    mockUser.findUnique.mockResolvedValue({ clanId: null });
    mockPlayerStats.upsert.mockResolvedValue({});

    // p1 (winner) has lower rating → should gain more
    mockPlayerStats.findUnique
      .mockResolvedValueOnce({ rating: 1200 }) // p1 low rated
      .mockResolvedValueOnce({ rating: 1800 }); // p2 high rated
    const resultUnderdog = await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));

    expect(resultUnderdog?.ratingDelta?.p1).toBeGreaterThan(resultFavored?.ratingDelta?.p1 ?? 0);
  });

  it('returns ratingDelta for ranked match', async () => {
    const result = await persistMatch(makeMatchInput({ isRanked: true }));
    expect(result?.ratingDelta).toBeDefined();
    expect(typeof result?.ratingDelta?.p1).toBe('number');
    expect(typeof result?.ratingDelta?.p2).toBe('number');
  });

  it('upserts p1 stats as winner when p1 wins', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1200 });
    await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    const p1Call = mockPlayerStats.upsert.mock.calls.find(
      (c: any[]) => c[0].where.userId === 'user1'
    );
    expect(p1Call).toBeDefined();
    expect(p1Call![0].create.wins).toBe(1);
    expect(p1Call![0].create.losses).toBe(0);
  });

  it('upserts p2 stats as loser when p1 wins', async () => {
    mockPlayerStats.findUnique.mockResolvedValue({ rating: 1200 });
    await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    const p2Call = mockPlayerStats.upsert.mock.calls.find(
      (c: any[]) => c[0].where.userId === 'user2'
    );
    expect(p2Call).toBeDefined();
    expect(p2Call![0].create.wins).toBe(0);
    expect(p2Call![0].create.losses).toBe(1);
  });
});

// ─── persistMatch — season stats ─────────────────────────────────────────────

describe('persistMatch — season stats', () => {
  const mockSeason = {
    id: 'season-1',
    name: 'Season 1',
    startAt: '2026-01-01T00:00:00Z',
    endAt: '2026-04-01T00:00:00Z',
    isActive: true,
  };

  it('skips season stats when no active season', async () => {
    mockGetActiveSeason.mockResolvedValue(null);
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockSeasonPlayerStats.findUnique).not.toHaveBeenCalled();
    expect(mockSeasonPlayerStats.upsert).not.toHaveBeenCalled();
  });

  it('upserts seasonPlayerStats for both players when season is active', async () => {
    mockGetActiveSeason.mockResolvedValue(mockSeason);
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockSeasonPlayerStats.upsert).toHaveBeenCalledTimes(2);
  });

  it('fetches season stats for both players', async () => {
    mockGetActiveSeason.mockResolvedValue(mockSeason);
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockSeasonPlayerStats.findUnique).toHaveBeenCalledWith({
      where: { seasonId_userId: { seasonId: 'season-1', userId: 'user1' } },
    });
    expect(mockSeasonPlayerStats.findUnique).toHaveBeenCalledWith({
      where: { seasonId_userId: { seasonId: 'season-1', userId: 'user2' } },
    });
  });

  it('uses SEASON_START_RATING (1200) when no prior season stats exist', async () => {
    mockGetActiveSeason.mockResolvedValue(mockSeason);
    mockSeasonPlayerStats.findUnique.mockResolvedValue(null);
    // Should not throw; season stats upsert should be called with derived values
    const result = await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    expect(result).not.toBeNull();
    expect(mockSeasonPlayerStats.upsert).toHaveBeenCalledTimes(2);
  });

  it('does not upsert season stats for non-ranked match', async () => {
    mockGetActiveSeason.mockResolvedValue(mockSeason);
    await persistMatch(makeMatchInput({ isRanked: false }));
    expect(mockSeasonPlayerStats.upsert).not.toHaveBeenCalled();
  });
});

// ─── persistMatch — clan stats ────────────────────────────────────────────────

describe('persistMatch — clan stats', () => {
  it('looks up clan IDs for both players in a ranked match', async () => {
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'user1' },
      select: { clanId: true },
    });
    expect(mockUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'user2' },
      select: { clanId: true },
    });
  });

  it('increments clan stats when player is in a clan', async () => {
    mockUser.findUnique
      .mockResolvedValueOnce({ clanId: 'clan-a' })
      .mockResolvedValueOnce({ clanId: null });
    await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    expect(mockIncrementClanStats).toHaveBeenCalledWith('clan-a', true);
  });

  it('skips incrementClanStats for player not in a clan', async () => {
    mockUser.findUnique
      .mockResolvedValueOnce({ clanId: null })
      .mockResolvedValueOnce({ clanId: null });
    await persistMatch(makeMatchInput({ isRanked: true }));
    expect(mockIncrementClanStats).not.toHaveBeenCalled();
  });

  it('increments clan stats for both players when both in clans', async () => {
    mockUser.findUnique
      .mockResolvedValueOnce({ clanId: 'clan-a' })
      .mockResolvedValueOnce({ clanId: 'clan-b' });
    await persistMatch(makeMatchInput({ isRanked: true, winnerId: 'user1' }));
    expect(mockIncrementClanStats).toHaveBeenCalledWith('clan-a', true);
    expect(mockIncrementClanStats).toHaveBeenCalledWith('clan-b', false);
  });

  it('does not look up clan IDs for non-ranked match', async () => {
    await persistMatch(makeMatchInput({ isRanked: false }));
    expect(mockUser.findUnique).not.toHaveBeenCalled();
  });
});

// ─── persistMatch — gold awards ───────────────────────────────────────────────

describe('persistMatch — gold awards', () => {
  it('awards gold to both players after match creation', async () => {
    await persistMatch(makeMatchInput({ winnerId: 'user1', mode: 'ranked' }));
    expect(mockAwardGold).toHaveBeenCalledTimes(2);
    expect(mockAwardGold).toHaveBeenCalledWith('user1', WIN_REWARD.amount, WIN_REWARD.reason);
    expect(mockAwardGold).toHaveBeenCalledWith('user2', LOSS_REWARD.amount, LOSS_REWARD.reason);
  });

  it('returns goldAwarded amounts from rewardForMode', async () => {
    const result = await persistMatch(makeMatchInput({ winnerId: 'user1' }));
    expect(result?.goldAwarded?.p1).toBe(WIN_REWARD.amount);
    expect(result?.goldAwarded?.p2).toBe(LOSS_REWARD.amount);
  });
});

// ─── persistMatch — DB error handling ────────────────────────────────────────

describe('persistMatch — DB error handling', () => {
  it('returns null when match.create throws', async () => {
    mockMatch.create.mockRejectedValue(new Error('DB connection refused'));
    const result = await persistMatch(makeMatchInput());
    expect(result).toBeNull();
  });

  it('returns null when playerStats.findUnique throws on ranked match', async () => {
    mockPlayerStats.findUnique.mockRejectedValue(new Error('Query failed'));
    const result = await persistMatch(makeMatchInput({ isRanked: true }));
    expect(result).toBeNull();
  });
});

// ─── persistAIMatch — guest handling ─────────────────────────────────────────

describe('persistAIMatch — guest handling', () => {
  it('returns { goldAwarded: 0 } for guest user without DB calls', async () => {
    const result = await persistAIMatch({
      userId: 'guest_abc',
      won: true,
      mode: 'ai_hard',
      turns: 25,
      durationMs: 45_000,
      accuracy: 0.7,
      shipsSunk: 5,
      shipsLost: 0,
    });
    expect(result).toEqual({ goldAwarded: 0 });
    expect(mockPlayerStats.upsert).not.toHaveBeenCalled();
    expect(mockMatch.create).not.toHaveBeenCalled();
  });
});

// ─── persistAIMatch — player stats upsert ─────────────────────────────────────

describe('persistAIMatch — player stats', () => {
  it('upserts playerStats with wins=1 on victory', async () => {
    await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_easy',
      turns: 20,
      durationMs: 30_000,
      accuracy: 0.6,
      shipsSunk: 5,
      shipsLost: 1,
    });
    expect(mockPlayerStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user1' },
        create: expect.objectContaining({ wins: 1, losses: 0, totalGamesAI: 1 }),
        update: expect.objectContaining({ wins: { increment: 1 }, losses: { increment: 0 } }),
      })
    );
  });

  it('upserts playerStats with losses=1 on defeat', async () => {
    await persistAIMatch({
      userId: 'user1',
      won: false,
      mode: 'ai_medium',
      turns: 40,
      durationMs: 60_000,
      accuracy: 0.3,
      shipsSunk: 2,
      shipsLost: 5,
    });
    expect(mockPlayerStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ wins: 0, losses: 1 }),
        update: expect.objectContaining({ wins: { increment: 0 }, losses: { increment: 1 } }),
      })
    );
  });

  it('persists ships sunk and ships lost correctly', async () => {
    await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_hard',
      turns: 30,
      durationMs: 50_000,
      accuracy: 0.8,
      shipsSunk: 4,
      shipsLost: 2,
    });
    expect(mockPlayerStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ shipsSunk: 4, shipsLost: 2 }),
        update: expect.objectContaining({
          shipsSunk: { increment: 4 },
          shipsLost: { increment: 2 },
        }),
      })
    );
  });
});

// ─── persistAIMatch — match record ────────────────────────────────────────────

describe('persistAIMatch — match record', () => {
  it('creates match with player2Id as null (AI opponent)', async () => {
    await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_easy',
      turns: 20,
      durationMs: 30_000,
      accuracy: 0.5,
      shipsSunk: 5,
      shipsLost: 0,
    });
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        player1Id: 'user1',
        player2Id: null,
        winnerId: 'user1',
      }),
    });
  });

  it('sets winnerId to null on defeat', async () => {
    await persistAIMatch({
      userId: 'user1',
      won: false,
      mode: 'ai_easy',
      turns: 35,
      durationMs: 55_000,
      accuracy: 0.3,
      shipsSunk: 1,
      shipsLost: 5,
    });
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        player1Id: 'user1',
        winnerId: null,
      }),
    });
  });

  it('includes accuracy, turns, and duration in match record', async () => {
    await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_hard',
      turns: 28,
      durationMs: 42_000,
      accuracy: 0.72,
      shipsSunk: 5,
      shipsLost: 1,
    });
    expect(mockMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mode: 'ai_hard',
        turns: 28,
        durationMs: 42_000,
        p1Accuracy: 0.72,
        p2Accuracy: 0,
      }),
    });
  });

  it('returns matchId from created record', async () => {
    mockMatch.create.mockResolvedValue({ id: 'ai-match-1' });
    const result = await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_hard',
      turns: 25,
      durationMs: 40_000,
      accuracy: 0.75,
      shipsSunk: 5,
      shipsLost: 0,
    });
    expect(result?.matchId).toBe('ai-match-1');
  });
});

// ─── persistAIMatch — gold awards ─────────────────────────────────────────────

describe('persistAIMatch — gold awards', () => {
  it('returns goldAwarded > 0 when awardGold succeeds', async () => {
    mockRewardForMode.mockReturnValue({ amount: 75, reason: 'WIN_AI_HARD' });
    mockAwardGold.mockResolvedValue({ newBalance: 275 });
    const result = await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_hard',
      turns: 25,
      durationMs: 40_000,
      accuracy: 0.8,
      shipsSunk: 5,
      shipsLost: 0,
    });
    expect(result?.goldAwarded).toBe(75);
  });

  it('returns goldAwarded = 0 when awardGold returns null (DB failure)', async () => {
    mockRewardForMode.mockReturnValue({ amount: 75, reason: 'WIN_AI_HARD' });
    mockAwardGold.mockResolvedValue(null);
    const result = await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_hard',
      turns: 25,
      durationMs: 40_000,
      accuracy: 0.8,
      shipsSunk: 5,
      shipsLost: 0,
    });
    expect(result?.goldAwarded).toBe(0);
  });
});

// ─── persistAIMatch — DB error handling ───────────────────────────────────────

describe('persistAIMatch — DB error handling', () => {
  it('returns null when DB throws', async () => {
    mockPlayerStats.upsert.mockRejectedValue(new Error('DB unavailable'));
    const result = await persistAIMatch({
      userId: 'user1',
      won: true,
      mode: 'ai_easy',
      turns: 20,
      durationMs: 30_000,
      accuracy: 0.5,
      shipsSunk: 5,
      shipsLost: 0,
    });
    expect(result).toBeNull();
  });
});
