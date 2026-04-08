/**
 * Tournament lifecycle: create, join, start, bracket propagation.
 * In-memory bracket state is synced to Postgres when available.
 */

import { prisma } from './db.ts';
import { seedPairings, nextBracketSlot, totalRounds } from '../../../shared/src/tournaments.ts';
import type {
  TournamentDetail,
  TournamentSummary,
  TournamentBracketMatch,
} from '../../../shared/src/tournaments.ts';
import { awardGold } from './gold.ts';
import { GOLD_REWARDS } from '../../../shared/src/cosmetics.ts';

let dbWarned = false;
async function safeDb<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!dbWarned) {
      console.warn(`[tournaments] DB unreachable (${label}): ${(err as Error).message}`);
      dbWarned = true;
    }
    return null;
  }
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  const rows = await safeDb('listTournaments', async () =>
    prisma.tournament.findMany({
      where: { status: { in: ['lobby', 'active'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { entries: true } } },
    })
  );
  return (rows ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    maxPlayers: r.maxPlayers,
    playerCount: r._count.entries,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString(),
    finishedAt: r.finishedAt?.toISOString(),
    winnerId: r.winnerId ?? undefined,
  }));
}

export async function getTournamentDetail(id: string): Promise<TournamentDetail | null> {
  return safeDb('getTournamentDetail', async () => {
    const t = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: { include: { tournament: false } },
        matches: { orderBy: [{ round: 'asc' }, { bracketIdx: 'asc' }] },
      },
    });
    if (!t) return null;

    // Resolve usernames for entries and match players
    const userIds = new Set<string>();
    t.entries.forEach((e: any) => userIds.add(e.userId));
    t.matches.forEach((m: any) => {
      if (m.p1UserId) userIds.add(m.p1UserId);
      if (m.p2UserId) userIds.add(m.p2UserId);
    });
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, username: true },
    });
    const nameOf = new Map(users.map((u: any) => [u.id, u.username]));

    const entries = t.entries.map((e: any) => ({
      userId: e.userId,
      username: nameOf.get(e.userId) ?? 'Unknown',
      seed: e.seed,
      eliminated: e.eliminated,
    }));

    const matches: TournamentBracketMatch[] = t.matches.map((m: any) => ({
      id: m.id,
      round: m.round,
      bracketIdx: m.bracketIdx,
      p1UserId: m.p1UserId,
      p2UserId: m.p2UserId,
      p1Username: m.p1UserId ? nameOf.get(m.p1UserId) : undefined,
      p2Username: m.p2UserId ? nameOf.get(m.p2UserId) : undefined,
      winnerUserId: m.winnerUserId,
      status: m.status,
      matchId: m.matchId ?? undefined,
    }));

    return {
      id: t.id,
      name: t.name,
      status: t.status as any,
      maxPlayers: t.maxPlayers,
      playerCount: entries.length,
      createdBy: t.createdBy,
      createdAt: t.createdAt.toISOString(),
      startedAt: t.startedAt?.toISOString(),
      finishedAt: t.finishedAt?.toISOString(),
      winnerId: t.winnerId ?? undefined,
      entries,
      matches,
    };
  });
}

export async function createTournament(
  createdBy: string,
  name: string,
  maxPlayers: number
): Promise<{ id: string } | { error: string }> {
  if (![4, 8, 16].includes(maxPlayers)) return { error: 'Invalid size' };
  const result = await safeDb('createTournament', async () => {
    const t = await prisma.tournament.create({
      data: { name, maxPlayers, createdBy, status: 'lobby' },
    });
    return { id: t.id as string };
  });
  return result ?? { error: 'Tournaments unavailable offline' };
}

export async function joinTournament(
  userId: string,
  tournamentId: string
): Promise<{ ok: true; started: boolean } | { error: string }> {
  const result = await safeDb('joinTournament', async () => {
    const t = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { entries: true },
    });
    if (!t) return { error: 'Tournament not found' };
    if (t.status !== 'lobby') return { error: 'Tournament already started' };
    if (t.entries.length >= t.maxPlayers) return { error: 'Tournament full' };
    if (t.entries.some((e: any) => e.userId === userId)) return { error: 'Already joined' };

    await prisma.tournamentEntry.create({
      data: {
        tournamentId,
        userId,
        seed: t.entries.length,
      },
    });

    let started = false;
    if (t.entries.length + 1 === t.maxPlayers) {
      await startTournamentInternal(tournamentId);
      started = true;
    }
    return { ok: true as const, started };
  });
  return result ?? { error: 'Tournaments unavailable offline' };
}

async function startTournamentInternal(tournamentId: string): Promise<void> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { entries: true },
  });
  if (!t) return;

  // Sort entries by rating (descending) for seeding
  const entries = await Promise.all(
    t.entries.map(async (e: any) => {
      const stats = await prisma.playerStats.findUnique({ where: { userId: e.userId } });
      return { userId: e.userId, rating: stats?.rating ?? 1200 };
    })
  );
  entries.sort((a, b) => b.rating - a.rating);

  const pairs = seedPairings(entries.map((e) => e.userId));

  // Create round-0 matches
  for (let i = 0; i < pairs.length; i++) {
    const [p1, p2] = pairs[i];
    await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: 0,
        bracketIdx: i,
        p1UserId: p1,
        p2UserId: p2,
        status: 'ready',
      },
    });
  }

  // Create empty match slots for subsequent rounds
  const rounds = totalRounds(t.maxPlayers);
  for (let r = 1; r < rounds; r++) {
    const count = t.maxPlayers / Math.pow(2, r + 1);
    for (let i = 0; i < count; i++) {
      await prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round: r,
          bracketIdx: i,
          status: 'pending',
        },
      });
    }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'active', startedAt: new Date() },
  });
}

/**
 * Called when a tournament match's real game finishes.
 * Updates the bracket and advances the winner, or finalizes the tournament.
 */
export async function onTournamentMatchComplete(
  tournamentMatchId: string,
  winnerUserId: string
): Promise<{ tournamentFinished: boolean; tournamentId: string } | null> {
  return safeDb('onTournamentMatchComplete', async () => {
    const tm = await prisma.tournamentMatch.findUnique({
      where: { id: tournamentMatchId },
      include: { tournament: true },
    });
    if (!tm) return null;

    const loserUserId = tm.p1UserId === winnerUserId ? tm.p2UserId : tm.p1UserId;

    await prisma.tournamentMatch.update({
      where: { id: tournamentMatchId },
      data: { winnerUserId, status: 'done' },
    });
    if (loserUserId) {
      await prisma.tournamentEntry.updateMany({
        where: { tournamentId: tm.tournamentId, userId: loserUserId },
        data: { eliminated: true },
      });
    }

    const totalR = totalRounds(tm.tournament.maxPlayers);
    const isFinal = tm.round === totalR - 1;

    if (isFinal) {
      // Tournament finished
      await prisma.tournament.update({
        where: { id: tm.tournamentId },
        data: { status: 'finished', finishedAt: new Date(), winnerId: winnerUserId },
      });
      // Award gold
      await awardGold(winnerUserId, GOLD_REWARDS.TOURNAMENT_WIN, 'TOURNAMENT_WIN');
      if (loserUserId) {
        await awardGold(loserUserId, GOLD_REWARDS.TOURNAMENT_RUNNER_UP, 'TOURNAMENT_RUNNER_UP');
      }
      return { tournamentFinished: true, tournamentId: tm.tournamentId };
    }

    // Advance winner to next round
    const nextRound = tm.round + 1;
    const { nextBracketIdx, slot } = nextBracketSlot(tm.bracketIdx);
    const nextMatch = await prisma.tournamentMatch.findFirst({
      where: { tournamentId: tm.tournamentId, round: nextRound, bracketIdx: nextBracketIdx },
    });
    if (nextMatch) {
      const updateData: any = {};
      if (slot === 'p1') updateData.p1UserId = winnerUserId;
      else updateData.p2UserId = winnerUserId;

      // Determine if both slots are now filled
      const currentP1 = slot === 'p1' ? winnerUserId : nextMatch.p1UserId;
      const currentP2 = slot === 'p2' ? winnerUserId : nextMatch.p2UserId;
      if (currentP1 && currentP2) {
        updateData.status = 'ready';
      }

      await prisma.tournamentMatch.update({
        where: { id: nextMatch.id },
        data: updateData,
      });
    }

    return { tournamentFinished: false, tournamentId: tm.tournamentId };
  });
}

export async function getNextReadyMatchForUser(
  userId: string
): Promise<{ tournamentMatchId: string; tournamentId: string; opponentUserId: string } | null> {
  return safeDb('getNextReadyMatchForUser', async () => {
    const match = await prisma.tournamentMatch.findFirst({
      where: {
        status: 'ready',
        OR: [{ p1UserId: userId }, { p2UserId: userId }],
      },
    });
    if (!match || !match.p1UserId || !match.p2UserId) return null;
    return {
      tournamentMatchId: match.id,
      tournamentId: match.tournamentId,
      opponentUserId: match.p1UserId === userId ? match.p2UserId : match.p1UserId,
    };
  });
}

export async function getTournamentLeaderboard(): Promise<
  Array<{ userId: string; username: string; wins: number }>
> {
  const rows = await safeDb('getTournamentLeaderboard', async () => {
    const wins = await prisma.tournament.groupBy({
      by: ['winnerId'],
      where: { winnerId: { not: null }, status: 'finished' },
      _count: { _all: true },
      orderBy: { _count: { winnerId: 'desc' } },
      take: 20,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: wins.map((w: any) => w.winnerId!).filter(Boolean) } },
      select: { id: true, username: true },
    });
    const nameOf = new Map(users.map((u: any) => [u.id, u.username]));
    return wins.map((w: any) => ({
      userId: w.winnerId!,
      username: nameOf.get(w.winnerId!) ?? 'Unknown',
      wins: w._count._all,
    }));
  });
  return rows ?? [];
}
