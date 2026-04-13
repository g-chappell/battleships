import { describe, it, expect } from 'vitest';
import {
  type ClanRole,
  type ClanSummary,
  type ClanMember,
  type ClanChatMessage,
  type ClanDetail,
} from '../clans';

describe('ClanRole', () => {
  it('has exactly three valid values: leader, officer, member', () => {
    const roles: ClanRole[] = ['leader', 'officer', 'member'];
    expect(roles).toHaveLength(3);
    expect(roles).toContain('leader');
    expect(roles).toContain('officer');
    expect(roles).toContain('member');
  });

  it('leader is a valid role', () => {
    const role: ClanRole = 'leader';
    expect(role).toBe('leader');
  });

  it('officer is a valid role', () => {
    const role: ClanRole = 'officer';
    expect(role).toBe('officer');
  });

  it('member is a valid role', () => {
    const role: ClanRole = 'member';
    expect(role).toBe('member');
  });
});

describe('ClanSummary structure', () => {
  const makeSummary = (): ClanSummary => ({
    id: 'clan-001',
    name: 'The Iron Fleet',
    tag: 'IRON',
    description: 'Elite naval warriors',
    memberCount: 12,
    totalWins: 150,
    totalLosses: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  it('can be constructed with required fields', () => {
    const clan = makeSummary();
    expect(clan.id).toBe('clan-001');
    expect(clan.name).toBe('The Iron Fleet');
    expect(clan.tag).toBe('IRON');
    expect(clan.description).toBe('Elite naval warriors');
    expect(clan.memberCount).toBe(12);
    expect(clan.totalWins).toBe(150);
    expect(clan.totalLosses).toBe(40);
    expect(clan.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('allows null description', () => {
    const clan: ClanSummary = { ...makeSummary(), description: null };
    expect(clan.description).toBeNull();
  });

  it('memberCount is a number', () => {
    const clan = makeSummary();
    expect(typeof clan.memberCount).toBe('number');
  });

  it('totalWins and totalLosses are numbers', () => {
    const clan = makeSummary();
    expect(typeof clan.totalWins).toBe('number');
    expect(typeof clan.totalLosses).toBe('number');
  });

  it('createdAt is a string (ISO date)', () => {
    const clan = makeSummary();
    expect(typeof clan.createdAt).toBe('string');
    expect(new Date(clan.createdAt).toISOString()).toBe(clan.createdAt);
  });
});

describe('ClanMember structure', () => {
  const makeMember = (): ClanMember => ({
    userId: 'user-42',
    username: 'Ironbeard',
    rating: 1250,
    wins: 75,
    losses: 20,
    role: 'member',
  });

  it('can be constructed with required fields', () => {
    const member = makeMember();
    expect(member.userId).toBe('user-42');
    expect(member.username).toBe('Ironbeard');
    expect(member.rating).toBe(1250);
    expect(member.wins).toBe(75);
    expect(member.losses).toBe(20);
    expect(member.role).toBe('member');
  });

  it('role can be leader', () => {
    const member: ClanMember = { ...makeMember(), role: 'leader' };
    expect(member.role).toBe('leader');
  });

  it('role can be officer', () => {
    const member: ClanMember = { ...makeMember(), role: 'officer' };
    expect(member.role).toBe('officer');
  });

  it('rating is a number', () => {
    const member = makeMember();
    expect(typeof member.rating).toBe('number');
  });
});

describe('ClanChatMessage structure', () => {
  const makeMessage = (): ClanChatMessage => ({
    id: 'msg-001',
    clanId: 'clan-001',
    userId: 'user-42',
    username: 'Ironbeard',
    text: 'All hands on deck!',
    createdAt: '2026-01-15T10:00:00.000Z',
  });

  it('can be constructed with required fields', () => {
    const msg = makeMessage();
    expect(msg.id).toBe('msg-001');
    expect(msg.clanId).toBe('clan-001');
    expect(msg.userId).toBe('user-42');
    expect(msg.username).toBe('Ironbeard');
    expect(msg.text).toBe('All hands on deck!');
    expect(msg.createdAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('createdAt is a string', () => {
    const msg = makeMessage();
    expect(typeof msg.createdAt).toBe('string');
  });

  it('text is a string (non-empty)', () => {
    const msg = makeMessage();
    expect(typeof msg.text).toBe('string');
    expect(msg.text.length).toBeGreaterThan(0);
  });
});

describe('ClanDetail structure', () => {
  const makeSummary = (): ClanSummary => ({
    id: 'clan-001',
    name: 'The Iron Fleet',
    tag: 'IRON',
    description: null,
    memberCount: 2,
    totalWins: 50,
    totalLosses: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  const makeDetail = (): ClanDetail => ({
    ...makeSummary(),
    members: [
      {
        userId: 'user-1',
        username: 'Ironbeard',
        rating: 1300,
        wins: 40,
        losses: 8,
        role: 'leader',
      },
      {
        userId: 'user-2',
        username: 'Mistral',
        rating: 1100,
        wins: 10,
        losses: 2,
        role: 'member',
      },
    ],
    recentChat: [
      {
        id: 'msg-1',
        clanId: 'clan-001',
        userId: 'user-1',
        username: 'Ironbeard',
        text: 'Let us sail!',
        createdAt: '2026-01-10T12:00:00.000Z',
      },
    ],
  });

  it('can be constructed with all ClanSummary fields plus members and recentChat', () => {
    const detail = makeDetail();
    expect(detail.id).toBe('clan-001');
    expect(detail.name).toBe('The Iron Fleet');
    expect(detail.tag).toBe('IRON');
    expect(detail.description).toBeNull();
    expect(detail.memberCount).toBe(2);
    expect(detail.totalWins).toBe(50);
    expect(detail.totalLosses).toBe(10);
    expect(detail.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(detail.members).toHaveLength(2);
    expect(detail.recentChat).toHaveLength(1);
  });

  it('extends ClanSummary — all ClanSummary fields are present', () => {
    const detail = makeDetail();
    const summaryKeys: (keyof ClanSummary)[] = [
      'id', 'name', 'tag', 'description', 'memberCount', 'totalWins', 'totalLosses', 'createdAt',
    ];
    for (const key of summaryKeys) {
      expect(key in detail).toBe(true);
    }
  });

  it('members array contains ClanMember objects with role', () => {
    const detail = makeDetail();
    expect(detail.members[0].role).toBe('leader');
    expect(detail.members[1].role).toBe('member');
  });

  it('recentChat can be empty', () => {
    const detail: ClanDetail = { ...makeDetail(), recentChat: [] };
    expect(detail.recentChat).toHaveLength(0);
  });

  it('members can be empty', () => {
    const detail: ClanDetail = { ...makeDetail(), members: [] };
    expect(detail.members).toHaveLength(0);
  });

  it('can be JSON serialized and deserialized without data loss', () => {
    const detail = makeDetail();
    const parsed: ClanDetail = JSON.parse(JSON.stringify(detail));
    expect(parsed.id).toBe(detail.id);
    expect(parsed.members).toHaveLength(2);
    expect(parsed.members[0].username).toBe('Ironbeard');
    expect(parsed.recentChat[0].text).toBe('Let us sail!');
  });
});
