import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: mock objects must exist before vi.mock() factories (which are hoisted)
const { mockSeason } = vi.hoisted(() => ({
  mockSeason: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('../services/db.ts', () => ({
  prisma: { season: mockSeason },
}));

import {
  getActiveSeason,
  invalidateSeasonCache,
  listSeasons,
  createSeason,
  rolloverIfExpired,
} from '../services/seasons.ts';
import { SEASON_DEFAULT_DURATION_DAYS } from '../../../shared/src/seasons.ts';

// ─── Helper factory ───────────────────────────────────────────────────────────

function makeRow(overrides: {
  id?: string;
  name?: string;
  startAt?: Date;
  endAt?: Date;
  isActive?: boolean;
} = {}) {
  return {
    id: 's1',
    name: 'Season 1',
    startAt: new Date('2026-01-01T00:00:00Z'),
    endAt: new Date('2026-02-01T00:00:00Z'),
    isActive: true,
    ...overrides,
  };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSeasonCache(); // reset module-level cache between tests
});

// ─── getActiveSeason ─────────────────────────────────────────────────────────

describe('getActiveSeason', () => {
  it('returns active season info from DB', async () => {
    const row = makeRow();
    mockSeason.findFirst.mockResolvedValue(row);

    const result = await getActiveSeason();

    expect(result).toEqual({
      id: 's1',
      name: 'Season 1',
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      isActive: true,
    });
    expect(mockSeason.findFirst).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it('returns null when no active season exists', async () => {
    mockSeason.findFirst.mockResolvedValue(null);

    const result = await getActiveSeason();

    expect(result).toBeNull();
  });

  it('returns null when DB throws (safeDb swallows error)', async () => {
    mockSeason.findFirst.mockRejectedValue(new Error('DB connection failed'));

    const result = await getActiveSeason();

    expect(result).toBeNull();
  });

  it('returns cached season within TTL without a second DB call', async () => {
    mockSeason.findFirst.mockResolvedValue(makeRow());

    const first = await getActiveSeason();
    const second = await getActiveSeason(); // should be a cache hit

    expect(first).toEqual(second);
    expect(mockSeason.findFirst).toHaveBeenCalledTimes(1);
  });

  it('makes a fresh DB call when cache has expired', async () => {
    mockSeason.findFirst.mockResolvedValue(makeRow());

    // First call at t=0 (fetchedAt=0); second call at t=61s (stale)
    const spy = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(61_000);

    await getActiveSeason();
    await getActiveSeason();

    expect(mockSeason.findFirst).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('converts Date fields to ISO strings in returned SeasonInfo', async () => {
    const startAt = new Date('2026-03-01T12:00:00Z');
    const endAt = new Date('2026-03-31T23:59:59Z');
    mockSeason.findFirst.mockResolvedValue(makeRow({ startAt, endAt }));

    const result = await getActiveSeason();

    expect(result?.startAt).toBe(startAt.toISOString());
    expect(result?.endAt).toBe(endAt.toISOString());
  });
});

// ─── invalidateSeasonCache ────────────────────────────────────────────────────

describe('invalidateSeasonCache', () => {
  it('forces a fresh DB call on the next getActiveSeason invocation', async () => {
    mockSeason.findFirst.mockResolvedValue(makeRow());

    await getActiveSeason(); // prime cache
    invalidateSeasonCache();
    await getActiveSeason(); // cache cleared — must re-query DB

    expect(mockSeason.findFirst).toHaveBeenCalledTimes(2);
  });
});

// ─── listSeasons ──────────────────────────────────────────────────────────────

describe('listSeasons', () => {
  it('returns all seasons ordered by startAt desc', async () => {
    const rows = [
      makeRow({ id: 's2', name: 'Season 2' }),
      makeRow({ id: 's1', name: 'Season 1' }),
    ];
    mockSeason.findMany.mockResolvedValue(rows);

    const result = await listSeasons();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('s2');
    expect(result[1].id).toBe('s1');
    expect(mockSeason.findMany).toHaveBeenCalledWith({ orderBy: { startAt: 'desc' } });
  });

  it('returns empty array when DB returns empty list', async () => {
    mockSeason.findMany.mockResolvedValue([]);

    const result = await listSeasons();

    expect(result).toEqual([]);
  });

  it('returns empty array when DB throws (safeDb swallows error)', async () => {
    mockSeason.findMany.mockRejectedValue(new Error('DB error'));

    const result = await listSeasons();

    expect(result).toEqual([]);
  });
});

// ─── createSeason ─────────────────────────────────────────────────────────────

describe('createSeason', () => {
  it('creates a new season and returns its SeasonInfo', async () => {
    const startAt = new Date('2026-04-01T00:00:00Z');
    const endAt = new Date('2026-05-01T00:00:00Z');
    const createdRow = makeRow({ id: 's3', name: 'Season 3', startAt, endAt });
    mockSeason.updateMany.mockResolvedValue({ count: 0 });
    mockSeason.create.mockResolvedValue(createdRow);

    const result = await createSeason('Season 3', startAt, endAt);

    expect(result).toEqual({
      id: 's3',
      name: 'Season 3',
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      isActive: true,
    });
    expect(mockSeason.create).toHaveBeenCalledWith({
      data: { name: 'Season 3', startAt, endAt, isActive: true },
    });
  });

  it('deactivates expired active seasons before creating the new one', async () => {
    const startAt = new Date('2026-04-01T00:00:00Z');
    const endAt = new Date('2026-05-01T00:00:00Z');
    mockSeason.updateMany.mockResolvedValue({ count: 1 });
    mockSeason.create.mockResolvedValue(makeRow({ startAt, endAt }));

    await createSeason('Season 3', startAt, endAt);

    expect(mockSeason.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, endAt: { lte: startAt } },
      data: { isActive: false },
    });
  });

  it('invalidates the cache after creating a season', async () => {
    mockSeason.findFirst.mockResolvedValue(makeRow());
    const startAt = new Date('2026-04-01T00:00:00Z');
    const endAt = new Date('2026-05-01T00:00:00Z');
    mockSeason.updateMany.mockResolvedValue({ count: 0 });
    mockSeason.create.mockResolvedValue(makeRow({ id: 'new', startAt, endAt }));

    await getActiveSeason(); // prime cache
    await createSeason('New', startAt, endAt); // should invalidate
    await getActiveSeason(); // should re-query DB

    expect(mockSeason.findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns null when DB throws (safeDb swallows error)', async () => {
    mockSeason.updateMany.mockRejectedValue(new Error('DB error'));

    const result = await createSeason('X', new Date(), new Date());

    expect(result).toBeNull();
  });
});

// ─── rolloverIfExpired ────────────────────────────────────────────────────────

describe('rolloverIfExpired', () => {
  it('does nothing when no active season exists', async () => {
    mockSeason.findFirst.mockResolvedValue(null);

    await rolloverIfExpired();

    expect(mockSeason.update).not.toHaveBeenCalled();
    expect(mockSeason.create).not.toHaveBeenCalled();
  });

  it('does nothing when active season has not yet expired', async () => {
    const row = makeRow({ endAt: new Date(Date.now() + 86_400_000) }); // ends tomorrow
    mockSeason.findFirst.mockResolvedValue(row);

    await rolloverIfExpired();

    expect(mockSeason.update).not.toHaveBeenCalled();
    expect(mockSeason.create).not.toHaveBeenCalled();
  });

  it('deactivates expired season and creates a new one', async () => {
    const expiredRow = makeRow({ id: 'exp', endAt: new Date(Date.now() - 86_400_000) }); // expired yesterday
    mockSeason.findFirst.mockResolvedValue(expiredRow);
    mockSeason.update.mockResolvedValue({ ...expiredRow, isActive: false });
    mockSeason.create.mockResolvedValue(makeRow({ id: 'new' }));

    await rolloverIfExpired();

    expect(mockSeason.update).toHaveBeenCalledWith({
      where: { id: 'exp' },
      data: { isActive: false },
    });
    expect(mockSeason.create).toHaveBeenCalledOnce();
    const { data } = mockSeason.create.mock.calls[0][0];
    expect(data.isActive).toBe(true);
    expect(typeof data.name).toBe('string');
    expect(data.name.length).toBeGreaterThan(0);
  });

  it('new season spans SEASON_DEFAULT_DURATION_DAYS days', async () => {
    const expiredRow = makeRow({ id: 'exp', endAt: new Date(Date.now() - 1_000) });
    mockSeason.findFirst.mockResolvedValue(expiredRow);
    mockSeason.update.mockResolvedValue({});
    mockSeason.create.mockResolvedValue(makeRow({ id: 'new' }));

    await rolloverIfExpired();

    const { startAt, endAt } = mockSeason.create.mock.calls[0][0].data;
    const durationDays = (endAt.getTime() - startAt.getTime()) / 86_400_000;
    expect(durationDays).toBeCloseTo(SEASON_DEFAULT_DURATION_DAYS, 0);
  });

  it('invalidates cache after rolling over', async () => {
    // Prime the cache
    mockSeason.findFirst.mockResolvedValueOnce(makeRow({ id: 'old' }));
    await getActiveSeason();

    // Trigger rollover
    const expiredRow = makeRow({ id: 'exp', endAt: new Date(Date.now() - 1_000) });
    mockSeason.findFirst.mockResolvedValueOnce(expiredRow);
    mockSeason.update.mockResolvedValue({});
    mockSeason.create.mockResolvedValue(makeRow({ id: 'new' }));
    await rolloverIfExpired();

    // Cache was invalidated — next call goes to DB
    mockSeason.findFirst.mockResolvedValueOnce(makeRow({ id: 'new' }));
    await getActiveSeason();

    // calls: cache prime (1) + rollover findFirst (1) + post-rollover lookup (1) = 3
    expect(mockSeason.findFirst).toHaveBeenCalledTimes(3);
  });

  it('handles DB errors gracefully without throwing', async () => {
    mockSeason.findFirst.mockRejectedValue(new Error('DB down'));

    await expect(rolloverIfExpired()).resolves.toBeUndefined();
  });
});
