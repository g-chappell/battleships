/**
 * Clan operations: create, join, leave, chat persistence, stat aggregation.
 */

import { prisma } from './db.ts';
import type { ClanDetail, ClanMember, ClanSummary } from '../../../shared/src/clans.ts';

/* ── Local Prisma result-shape types ── */

interface ClanWithCount {
  id: string; name: string; tag: string; description: string | null;
  createdBy: string; createdAt: Date; totalWins: number; totalLosses: number;
  _count: { members: number };
}

interface MemberWithStats {
  id: string; username: string; clanRole: string | null;
  stats: { rating: number; wins: number; losses: number } | null;
}

interface ChatMessageRow {
  id: string; clanId: string; userId: string;
  username: string; text: string; createdAt: Date;
}

let dbWarned = false;
async function safeDb<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!dbWarned) {
      console.warn(`[clans] DB unreachable (${label}): ${(err as Error).message}`);
      dbWarned = true;
    }
    return null;
  }
}

export async function listClans(search?: string): Promise<ClanSummary[]> {
  const rows = await safeDb('listClans', async () =>
    prisma.clan.findMany({
      where: search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { tag: { contains: search, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { totalWins: 'desc' },
      take: 50,
      include: { _count: { select: { members: true } } },
    })
  );
  return (rows ?? []).map((r: ClanWithCount) => ({
    id: r.id,
    name: r.name,
    tag: r.tag,
    description: r.description,
    memberCount: r._count.members,
    totalWins: r.totalWins,
    totalLosses: r.totalLosses,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getClanDetail(clanId: string): Promise<ClanDetail | null> {
  return safeDb('getClanDetail', async () => {
    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
      include: {
        members: { include: { stats: true } },
        chat: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!clan) return null;
    const members: ClanMember[] = clan.members.map((m: MemberWithStats) => ({
      userId: m.id,
      username: m.username,
      rating: m.stats?.rating ?? 1200,
      wins: m.stats?.wins ?? 0,
      losses: m.stats?.losses ?? 0,
      role: (m.clanRole ?? 'member') as ClanMember['role'],
    }));
    return {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      description: clan.description,
      memberCount: members.length,
      totalWins: clan.totalWins,
      totalLosses: clan.totalLosses,
      createdAt: clan.createdAt.toISOString(),
      members,
      recentChat: clan.chat.reverse().map((c: ChatMessageRow) => ({
        id: c.id,
        clanId: c.clanId,
        userId: c.userId,
        username: c.username,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });
}

export async function createClan(
  userId: string,
  name: string,
  tag: string,
  description?: string
): Promise<{ ok: true; clanId: string } | { error: string }> {
  const result = await safeDb('createClan', async () => {
    const existing = await prisma.clan.findFirst({
      where: { OR: [{ name }, { tag }] },
    });
    if (existing) return { error: 'Name or tag already taken' };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'User not found' };
    if (user.clanId) return { error: 'Already in a clan' };

    const clan = await prisma.clan.create({
      data: { name, tag, description, createdBy: userId },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { clanId: clan.id, clanRole: 'leader' },
    });
    return { ok: true as const, clanId: clan.id };
  });
  return result ?? { error: 'Clans unavailable offline' };
}

export async function joinClan(
  userId: string,
  clanId: string
): Promise<{ ok: true } | { error: string }> {
  const result = await safeDb('joinClan', async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'User not found' };
    if (user.clanId) return { error: 'Already in a clan' };
    const clan = await prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) return { error: 'Clan not found' };
    await prisma.user.update({
      where: { id: userId },
      data: { clanId, clanRole: 'member' },
    });
    return { ok: true as const };
  });
  return result ?? { error: 'Clans unavailable offline' };
}

export async function leaveClan(userId: string): Promise<void> {
  await safeDb('leaveClan', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { clanId: null, clanRole: null },
    });
    return null;
  });
}

export async function addChatMessage(
  clanId: string,
  userId: string,
  username: string,
  text: string
): Promise<{ id: string; createdAt: string } | null> {
  return safeDb('addChatMessage', async () => {
    const msg = await prisma.clanChatMessage.create({
      data: { clanId, userId, username, text },
    });
    return { id: msg.id, createdAt: msg.createdAt.toISOString() };
  });
}

export async function incrementClanStats(clanId: string, won: boolean): Promise<void> {
  await safeDb('incrementClanStats', async () => {
    await prisma.clan.update({
      where: { id: clanId },
      data: {
        totalWins: { increment: won ? 1 : 0 },
        totalLosses: { increment: won ? 0 : 1 },
      },
    });
    return null;
  });
}
