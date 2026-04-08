/**
 * Graceful DB persistence layer.
 * If Postgres is unreachable (e.g. Docker not running), all writes
 * become no-ops with a warning logged once.
 */

import { prisma } from './db.js';
import { applyMatchResult } from './elo.js';
import { awardGold, rewardForMode } from './gold.ts';
import { getActiveSeason } from './seasons.ts';
import { incrementClanStats } from './clans.ts';
import { SEASON_START_RATING } from '../../../shared/src/seasons.ts';
import type { ReplayEvent } from '../../../shared/src/replay.ts';

let dbWarned = false;

async function safeDbCall<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!dbWarned) {
      console.warn(`[persistence] DB unreachable — operating in memory-only mode. (${label}: ${(err as Error).message})`);
      dbWarned = true;
    }
    return null;
  }
}

export interface MatchPersistInput {
  player1Id: string;
  player2Id: string;
  winnerId: string;
  isRanked: boolean;
  mode?: string; // 'ai_easy', 'ai_medium', 'ai_hard', 'ranked', 'private', 'tournament'
  turns: number;
  durationMs: number;
  p1Accuracy: number;
  p2Accuracy: number;
  p1ShipsSunk: number;
  p2ShipsSunk: number;
  events?: ReplayEvent[];
}

export async function persistMatch(input: MatchPersistInput): Promise<{
  ratingDelta?: { p1: number; p2: number };
  goldAwarded?: { p1: number; p2: number };
  matchId?: string;
} | null> {
  return safeDbCall('persistMatch', async () => {
    // Skip persistence for guest players
    if (input.player1Id.startsWith('guest_') || input.player2Id.startsWith('guest_')) {
      return null;
    }

    let ratingDelta: { p1: number; p2: number } | undefined;
    const winnerIsP1 = input.winnerId === input.player1Id;
    const mode = input.mode ?? (input.isRanked ? 'ranked' : 'private');

    if (input.isRanked) {
      // Fetch current lifetime stats
      const [p1Stats, p2Stats] = await Promise.all([
        prisma.playerStats.findUnique({ where: { userId: input.player1Id } }),
        prisma.playerStats.findUnique({ where: { userId: input.player2Id } }),
      ]);
      const p1Rating = p1Stats?.rating ?? 1200;
      const p2Rating = p2Stats?.rating ?? 1200;
      const result = applyMatchResult(
        winnerIsP1 ? p1Rating : p2Rating,
        winnerIsP1 ? p2Rating : p1Rating
      );
      const newP1 = winnerIsP1 ? result.winnerNew : result.loserNew;
      const newP2 = winnerIsP1 ? result.loserNew : result.winnerNew;
      ratingDelta = {
        p1: newP1 - p1Rating,
        p2: newP2 - p2Rating,
      };

      // Lifetime stats upsert
      await prisma.playerStats.upsert({
        where: { userId: input.player1Id },
        create: {
          userId: input.player1Id,
          rating: newP1,
          wins: winnerIsP1 ? 1 : 0,
          losses: winnerIsP1 ? 0 : 1,
          totalGamesMP: 1,
          shipsSunk: input.p1ShipsSunk,
          shipsLost: input.p2ShipsSunk,
          totalTurns: input.turns,
          totalGameTimeMs: BigInt(input.durationMs),
        },
        update: {
          rating: newP1,
          wins: { increment: winnerIsP1 ? 1 : 0 },
          losses: { increment: winnerIsP1 ? 0 : 1 },
          totalGamesMP: { increment: 1 },
          shipsSunk: { increment: input.p1ShipsSunk },
          shipsLost: { increment: input.p2ShipsSunk },
          totalTurns: { increment: input.turns },
          totalGameTimeMs: { increment: BigInt(input.durationMs) },
        },
      });
      await prisma.playerStats.upsert({
        where: { userId: input.player2Id },
        create: {
          userId: input.player2Id,
          rating: newP2,
          wins: winnerIsP1 ? 0 : 1,
          losses: winnerIsP1 ? 1 : 0,
          totalGamesMP: 1,
          shipsSunk: input.p2ShipsSunk,
          shipsLost: input.p1ShipsSunk,
          totalTurns: input.turns,
          totalGameTimeMs: BigInt(input.durationMs),
        },
        update: {
          rating: newP2,
          wins: { increment: winnerIsP1 ? 0 : 1 },
          losses: { increment: winnerIsP1 ? 1 : 0 },
          totalGamesMP: { increment: 1 },
          shipsSunk: { increment: input.p2ShipsSunk },
          shipsLost: { increment: input.p1ShipsSunk },
          totalTurns: { increment: input.turns },
          totalGameTimeMs: { increment: BigInt(input.durationMs) },
        },
      });

      // === Season stats ===
      const season = await getActiveSeason();
      if (season) {
        const [sP1, sP2] = await Promise.all([
          prisma.seasonPlayerStats.findUnique({
            where: { seasonId_userId: { seasonId: season.id, userId: input.player1Id } },
          }),
          prisma.seasonPlayerStats.findUnique({
            where: { seasonId_userId: { seasonId: season.id, userId: input.player2Id } },
          }),
        ]);
        const sP1Rating = sP1?.rating ?? SEASON_START_RATING;
        const sP2Rating = sP2?.rating ?? SEASON_START_RATING;
        const sResult = applyMatchResult(
          winnerIsP1 ? sP1Rating : sP2Rating,
          winnerIsP1 ? sP2Rating : sP1Rating
        );
        const newSP1 = winnerIsP1 ? sResult.winnerNew : sResult.loserNew;
        const newSP2 = winnerIsP1 ? sResult.loserNew : sResult.winnerNew;

        await prisma.seasonPlayerStats.upsert({
          where: { seasonId_userId: { seasonId: season.id, userId: input.player1Id } },
          create: {
            seasonId: season.id,
            userId: input.player1Id,
            rating: newSP1,
            wins: winnerIsP1 ? 1 : 0,
            losses: winnerIsP1 ? 0 : 1,
            peakRating: Math.max(SEASON_START_RATING, newSP1),
          },
          update: {
            rating: newSP1,
            wins: { increment: winnerIsP1 ? 1 : 0 },
            losses: { increment: winnerIsP1 ? 0 : 1 },
            peakRating: Math.max((sP1?.peakRating ?? SEASON_START_RATING), newSP1),
          },
        });
        await prisma.seasonPlayerStats.upsert({
          where: { seasonId_userId: { seasonId: season.id, userId: input.player2Id } },
          create: {
            seasonId: season.id,
            userId: input.player2Id,
            rating: newSP2,
            wins: winnerIsP1 ? 0 : 1,
            losses: winnerIsP1 ? 1 : 0,
            peakRating: Math.max(SEASON_START_RATING, newSP2),
          },
          update: {
            rating: newSP2,
            wins: { increment: winnerIsP1 ? 0 : 1 },
            losses: { increment: winnerIsP1 ? 1 : 0 },
            peakRating: Math.max((sP2?.peakRating ?? SEASON_START_RATING), newSP2),
          },
        });
      }

      // === Clan stats ===
      const [p1User, p2User] = await Promise.all([
        prisma.user.findUnique({ where: { id: input.player1Id }, select: { clanId: true } }),
        prisma.user.findUnique({ where: { id: input.player2Id }, select: { clanId: true } }),
      ]);
      if (p1User?.clanId) await incrementClanStats(p1User.clanId, winnerIsP1);
      if (p2User?.clanId) await incrementClanStats(p2User.clanId, !winnerIsP1);
    }

    // Persist match record (with events for replay)
    const match = await prisma.match.create({
      data: {
        player1Id: input.player1Id,
        player2Id: input.player2Id,
        winnerId: input.winnerId,
        mode,
        turns: input.turns,
        durationMs: input.durationMs,
        p1Accuracy: input.p1Accuracy,
        p2Accuracy: input.p2Accuracy,
        p1ShipsSunk: input.p1ShipsSunk,
        p2ShipsSunk: input.p2ShipsSunk,
        events: input.events ? (input.events as any) : undefined,
      },
    });

    // === Gold awards ===
    const p1Reward = rewardForMode(mode, winnerIsP1);
    const p2Reward = rewardForMode(mode, !winnerIsP1);
    await awardGold(input.player1Id, p1Reward.amount, p1Reward.reason);
    await awardGold(input.player2Id, p2Reward.amount, p2Reward.reason);

    return {
      ratingDelta,
      goldAwarded: { p1: p1Reward.amount, p2: p2Reward.amount },
      matchId: match.id,
    };
  });
}

/** Persist an AI-mode match (single user). */
export async function persistAIMatch(input: {
  userId: string;
  won: boolean;
  mode: string;
  turns: number;
  durationMs: number;
  accuracy: number;
  shipsSunk: number;
  shipsLost: number;
  events?: ReplayEvent[];
}): Promise<{ goldAwarded: number; matchId?: string } | null> {
  return safeDbCall('persistAIMatch', async () => {
    if (input.userId.startsWith('guest_')) return { goldAwarded: 0 };

    await prisma.playerStats.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        wins: input.won ? 1 : 0,
        losses: input.won ? 0 : 1,
        totalGamesAI: 1,
        shipsSunk: input.shipsSunk,
        shipsLost: input.shipsLost,
        totalTurns: input.turns,
        totalGameTimeMs: BigInt(input.durationMs),
      },
      update: {
        wins: { increment: input.won ? 1 : 0 },
        losses: { increment: input.won ? 0 : 1 },
        totalGamesAI: { increment: 1 },
        shipsSunk: { increment: input.shipsSunk },
        shipsLost: { increment: input.shipsLost },
        totalTurns: { increment: input.turns },
        totalGameTimeMs: { increment: BigInt(input.durationMs) },
      },
    });

    const match = await prisma.match.create({
      data: {
        player1Id: input.userId,
        player2Id: null,
        winnerId: input.won ? input.userId : null,
        mode: input.mode,
        turns: input.turns,
        durationMs: input.durationMs,
        p1Accuracy: input.accuracy,
        p2Accuracy: 0,
        p1ShipsSunk: input.shipsSunk,
        p2ShipsSunk: input.shipsLost,
        events: input.events ? (input.events as any) : undefined,
      },
    });

    const reward = rewardForMode(input.mode, input.won);
    const result = await awardGold(input.userId, reward.amount, reward.reason);
    return { goldAwarded: result?.newBalance ? reward.amount : 0, matchId: match.id };
  });
}
