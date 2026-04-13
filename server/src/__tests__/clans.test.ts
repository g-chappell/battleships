import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock factories (which are hoisted to top of file)
const { mockClan, mockUser, mockClanChatMessage } = vi.hoisted(() => ({
  mockClan: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockClanChatMessage: {
    create: vi.fn(),
  },
}));

vi.mock('../services/db.ts', () => ({
  prisma: {
    clan: mockClan,
    user: mockUser,
    clanChatMessage: mockClanChatMessage,
  },
}));

import {
  listClans,
  getClanDetail,
  createClan,
  joinClan,
  leaveClan,
  addChatMessage,
  incrementClanStats,
} from '../services/clans.ts';

function makeClanRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'clan1',
    name: 'Iron Wolves',
    tag: 'IW',
    description: 'Elite pirates',
    createdBy: 'user1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    totalWins: 10,
    totalLosses: 3,
    _count: { members: 5 },
    ...overrides,
  };
}

function makeMemberRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user1',
    username: 'Ironbeard',
    clanRole: 'leader',
    stats: { rating: 1600, wins: 20, losses: 5 },
    ...overrides,
  };
}

function makeChatRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'chat1',
    clanId: 'clan1',
    userId: 'user1',
    username: 'Ironbeard',
    text: 'Ahoy!',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listClans ────────────────────────────────────────────────────────────────

describe('listClans', () => {
  it('returns empty array when DB throws', async () => {
    mockClan.findMany.mockRejectedValue(new Error('DB error'));
    const result = await listClans();
    expect(result).toEqual([]);
  });

  it('returns mapped ClanSummary[] on success', async () => {
    mockClan.findMany.mockResolvedValue([makeClanRow()]);
    const result = await listClans();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'clan1',
      name: 'Iron Wolves',
      tag: 'IW',
      description: 'Elite pirates',
      memberCount: 5,
      totalWins: 10,
      totalLosses: 3,
    });
  });

  it('returns ISO string for createdAt', async () => {
    mockClan.findMany.mockResolvedValue([makeClanRow()]);
    const result = await listClans();
    expect(result[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('handles empty result set', async () => {
    mockClan.findMany.mockResolvedValue([]);
    const result = await listClans();
    expect(result).toEqual([]);
  });

  it('passes search term to Prisma query when provided', async () => {
    mockClan.findMany.mockResolvedValue([]);
    await listClans('wolves');
    expect(mockClan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: expect.objectContaining({ contains: 'wolves' }) }),
          ]),
        }),
      })
    );
  });

  it('passes no where clause when no search term', async () => {
    mockClan.findMany.mockResolvedValue([]);
    await listClans();
    expect(mockClan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });

  it('handles null description', async () => {
    mockClan.findMany.mockResolvedValue([makeClanRow({ description: null })]);
    const result = await listClans();
    expect(result[0].description).toBeNull();
  });
});

// ─── getClanDetail ────────────────────────────────────────────────────────────

describe('getClanDetail', () => {
  it('returns null when clan not found', async () => {
    mockClan.findUnique.mockResolvedValue(null);
    const result = await getClanDetail('clan1');
    expect(result).toBeNull();
  });

  it('returns null when DB throws', async () => {
    mockClan.findUnique.mockRejectedValue(new Error('DB error'));
    const result = await getClanDetail('clan1');
    expect(result).toBeNull();
  });

  it('returns full ClanDetail with members and chat on success', async () => {
    mockClan.findUnique.mockResolvedValue({
      ...makeClanRow(),
      members: [makeMemberRow()],
      chat: [makeChatRow()],
    });
    const result = await getClanDetail('clan1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('clan1');
    expect(result!.name).toBe('Iron Wolves');
    expect(result!.members).toHaveLength(1);
    expect(result!.members[0]).toMatchObject({
      userId: 'user1',
      username: 'Ironbeard',
      rating: 1600,
      wins: 20,
      losses: 5,
      role: 'leader',
    });
    expect(result!.recentChat).toHaveLength(1);
    expect(result!.recentChat[0]).toMatchObject({
      id: 'chat1',
      clanId: 'clan1',
      userId: 'user1',
      username: 'Ironbeard',
      text: 'Ahoy!',
    });
  });

  it('uses default stats when member has no stats', async () => {
    mockClan.findUnique.mockResolvedValue({
      ...makeClanRow(),
      members: [makeMemberRow({ stats: null })],
      chat: [],
    });
    const result = await getClanDetail('clan1');
    expect(result!.members[0].rating).toBe(1200);
    expect(result!.members[0].wins).toBe(0);
    expect(result!.members[0].losses).toBe(0);
  });

  it('uses "member" role when clanRole is null', async () => {
    mockClan.findUnique.mockResolvedValue({
      ...makeClanRow(),
      members: [makeMemberRow({ clanRole: null })],
      chat: [],
    });
    const result = await getClanDetail('clan1');
    expect(result!.members[0].role).toBe('member');
  });

  it('reverses chat messages (returns chronological order)', async () => {
    const chat = [
      makeChatRow({ id: 'chat2', createdAt: new Date('2026-01-01T14:00:00Z') }),
      makeChatRow({ id: 'chat1', createdAt: new Date('2026-01-01T12:00:00Z') }),
    ];
    mockClan.findUnique.mockResolvedValue({
      ...makeClanRow(),
      members: [],
      chat,
    });
    const result = await getClanDetail('clan1');
    // chat is returned from DB in desc order, service reverses it to asc
    expect(result!.recentChat[0].id).toBe('chat1');
    expect(result!.recentChat[1].id).toBe('chat2');
  });

  it('uses memberCount from in-memory members length (not _count)', async () => {
    mockClan.findUnique.mockResolvedValue({
      ...makeClanRow({ _count: { members: 99 } }),
      members: [makeMemberRow()],
      chat: [],
    });
    const result = await getClanDetail('clan1');
    expect(result!.memberCount).toBe(1);
  });

  it('returns ISO string dates for chat messages', async () => {
    mockClan.findUnique.mockResolvedValue({
      ...makeClanRow(),
      members: [],
      chat: [makeChatRow()],
    });
    const result = await getClanDetail('clan1');
    expect(result!.recentChat[0].createdAt).toBe('2026-01-01T12:00:00.000Z');
  });
});

// ─── createClan ───────────────────────────────────────────────────────────────

describe('createClan', () => {
  it('returns error when name or tag already taken', async () => {
    mockClan.findFirst.mockResolvedValue(makeClanRow());
    const result = await createClan('user1', 'Iron Wolves', 'IW');
    expect(result).toEqual({ error: 'Name or tag already taken' });
    expect(mockClan.create).not.toHaveBeenCalled();
  });

  it('returns error when user not found', async () => {
    mockClan.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue(null);
    const result = await createClan('user1', 'New Clan', 'NC');
    expect(result).toEqual({ error: 'User not found' });
  });

  it('returns error when user is already in a clan', async () => {
    mockClan.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue({ id: 'user1', username: 'Ironbeard', clanId: 'existing-clan' });
    const result = await createClan('user1', 'New Clan', 'NC');
    expect(result).toEqual({ error: 'Already in a clan' });
  });

  it('creates clan and updates user role to leader on success', async () => {
    mockClan.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue({ id: 'user1', username: 'Ironbeard', clanId: null });
    mockClan.create.mockResolvedValue({ id: 'new-clan-id' });
    mockUser.update.mockResolvedValue({});

    const result = await createClan('user1', 'New Wolves', 'NW', 'Best pirates');
    expect(result).toEqual({ ok: true, clanId: 'new-clan-id' });
    expect(mockClan.create).toHaveBeenCalledWith({
      data: { name: 'New Wolves', tag: 'NW', description: 'Best pirates', createdBy: 'user1' },
    });
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { clanId: 'new-clan-id', clanRole: 'leader' },
    });
  });

  it('creates clan without optional description', async () => {
    mockClan.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue({ id: 'user1', username: 'Ironbeard', clanId: null });
    mockClan.create.mockResolvedValue({ id: 'new-clan-id' });
    mockUser.update.mockResolvedValue({});

    const result = await createClan('user1', 'New Wolves', 'NW');
    expect(result).toEqual({ ok: true, clanId: 'new-clan-id' });
  });

  it('returns offline error when DB throws', async () => {
    mockClan.findFirst.mockRejectedValue(new Error('DB error'));
    const result = await createClan('user1', 'New Clan', 'NC');
    expect(result).toEqual({ error: 'Clans unavailable offline' });
  });
});

// ─── joinClan ─────────────────────────────────────────────────────────────────

describe('joinClan', () => {
  it('returns error when user not found', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const result = await joinClan('user1', 'clan1');
    expect(result).toEqual({ error: 'User not found' });
  });

  it('returns error when user already in a clan', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'user1', clanId: 'existing-clan' });
    const result = await joinClan('user1', 'clan1');
    expect(result).toEqual({ error: 'Already in a clan' });
  });

  it('returns error when clan not found', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'user1', clanId: null });
    mockClan.findUnique.mockResolvedValue(null);
    const result = await joinClan('user1', 'clan1');
    expect(result).toEqual({ error: 'Clan not found' });
  });

  it('joins clan successfully and sets role to member', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'user1', clanId: null });
    mockClan.findUnique.mockResolvedValue(makeClanRow());
    mockUser.update.mockResolvedValue({});

    const result = await joinClan('user1', 'clan1');
    expect(result).toEqual({ ok: true });
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { clanId: 'clan1', clanRole: 'member' },
    });
  });

  it('returns offline error when DB throws', async () => {
    mockUser.findUnique.mockRejectedValue(new Error('DB error'));
    const result = await joinClan('user1', 'clan1');
    expect(result).toEqual({ error: 'Clans unavailable offline' });
  });
});

// ─── leaveClan ────────────────────────────────────────────────────────────────

describe('leaveClan', () => {
  it('clears clanId and clanRole on user', async () => {
    mockUser.update.mockResolvedValue({});
    await leaveClan('user1');
    expect(mockUser.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { clanId: null, clanRole: null },
    });
  });

  it('does not throw when DB throws (safeDb swallows errors)', async () => {
    mockUser.update.mockRejectedValue(new Error('DB error'));
    await expect(leaveClan('user1')).resolves.toBeUndefined();
  });
});

// ─── addChatMessage ───────────────────────────────────────────────────────────

describe('addChatMessage', () => {
  it('creates a chat message and returns id and createdAt', async () => {
    const createdAt = new Date('2026-01-01T15:00:00Z');
    mockClanChatMessage.create.mockResolvedValue({ id: 'msg1', createdAt });
    const result = await addChatMessage('clan1', 'user1', 'Ironbeard', 'Hello crew!');
    expect(result).toEqual({ id: 'msg1', createdAt: '2026-01-01T15:00:00.000Z' });
    expect(mockClanChatMessage.create).toHaveBeenCalledWith({
      data: { clanId: 'clan1', userId: 'user1', username: 'Ironbeard', text: 'Hello crew!' },
    });
  });

  it('returns null when DB throws', async () => {
    mockClanChatMessage.create.mockRejectedValue(new Error('DB error'));
    const result = await addChatMessage('clan1', 'user1', 'Ironbeard', 'Hello');
    expect(result).toBeNull();
  });
});

// ─── incrementClanStats ───────────────────────────────────────────────────────

describe('incrementClanStats', () => {
  it('increments totalWins when won=true', async () => {
    mockClan.update.mockResolvedValue({});
    await incrementClanStats('clan1', true);
    expect(mockClan.update).toHaveBeenCalledWith({
      where: { id: 'clan1' },
      data: {
        totalWins: { increment: 1 },
        totalLosses: { increment: 0 },
      },
    });
  });

  it('increments totalLosses when won=false', async () => {
    mockClan.update.mockResolvedValue({});
    await incrementClanStats('clan1', false);
    expect(mockClan.update).toHaveBeenCalledWith({
      where: { id: 'clan1' },
      data: {
        totalWins: { increment: 0 },
        totalLosses: { increment: 1 },
      },
    });
  });

  it('does not throw when DB throws (safeDb swallows errors)', async () => {
    mockClan.update.mockRejectedValue(new Error('DB error'));
    await expect(incrementClanStats('clan1', true)).resolves.toBeUndefined();
  });
});
