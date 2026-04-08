/**
 * Seasons: active season lookup with short cache, rollover helpers.
 * Admin-seeded via POST /api/seasons with x-admin-token header.
 */

import { prisma } from './db.ts';
import { SEASON_DEFAULT_DURATION_DAYS } from '../../../shared/src/seasons.ts';
import type { SeasonInfo } from '../../../shared/src/seasons.ts';

let cache: { season: SeasonInfo | null; fetchedAt: number } = { season: null, fetchedAt: 0 };
const CACHE_TTL_MS = 60_000; // 1 min

let dbWarned = false;
async function safeDb<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (!dbWarned) {
      console.warn(`[seasons] DB unreachable (${label}): ${(err as Error).message}`);
      dbWarned = true;
    }
    return null;
  }
}

function toInfo(row: {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
}): SeasonInfo {
  return {
    id: row.id,
    name: row.name,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    isActive: row.isActive,
  };
}

export async function getActiveSeason(): Promise<SeasonInfo | null> {
  const now = Date.now();
  if (cache.season && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.season;
  }
  const row = await safeDb('getActiveSeason', async () =>
    prisma.season.findFirst({ where: { isActive: true } })
  );
  cache = { season: row ? toInfo(row) : null, fetchedAt: now };
  return cache.season;
}

export function invalidateSeasonCache(): void {
  cache = { season: null, fetchedAt: 0 };
}

export async function listSeasons(): Promise<SeasonInfo[]> {
  const rows = await safeDb('listSeasons', async () =>
    prisma.season.findMany({ orderBy: { startAt: 'desc' } })
  );
  return (rows ?? []).map(toInfo);
}

export async function createSeason(
  name: string,
  startAt: Date,
  endAt: Date
): Promise<SeasonInfo | null> {
  return safeDb('createSeason', async () => {
    // Deactivate any current active season that ends before or at the new start
    await prisma.season.updateMany({
      where: { isActive: true, endAt: { lte: startAt } },
      data: { isActive: false },
    });
    const row = await prisma.season.create({
      data: { name, startAt, endAt, isActive: true },
    });
    invalidateSeasonCache();
    return toInfo(row);
  });
}

export async function rolloverIfExpired(): Promise<void> {
  await safeDb('rolloverIfExpired', async () => {
    const active = await prisma.season.findFirst({ where: { isActive: true } });
    if (!active) return null;
    if (active.endAt.getTime() > Date.now()) return null;
    // Expire current season
    await prisma.season.update({ where: { id: active.id }, data: { isActive: false } });
    // Auto-create next 30-day season
    const nextStart = new Date();
    const nextEnd = new Date(nextStart.getTime() + SEASON_DEFAULT_DURATION_DAYS * 86400_000);
    await prisma.season.create({
      data: {
        name: `Season ${new Date().getFullYear()}-${new Date().getMonth() + 1}`,
        startAt: nextStart,
        endAt: nextEnd,
        isActive: true,
      },
    });
    invalidateSeasonCache();
    console.log('[seasons] auto-rolled over expired season');
    return null;
  });
}

// Start a 60s rollover watchdog
setInterval(() => {
  rolloverIfExpired().catch(() => {});
}, 60_000);
