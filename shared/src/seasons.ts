/**
 * Season types + helpers for the seasonal ladder system.
 */

export interface SeasonInfo {
  id: string;
  name: string;
  startAt: string; // ISO
  endAt: string;
  isActive: boolean;
}

export interface SeasonTimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  total_ms: number;
  ended: boolean;
}

export function getSeasonTimeRemaining(endAt: string | Date): SeasonTimeRemaining {
  const end = typeof endAt === 'string' ? new Date(endAt).getTime() : endAt.getTime();
  const now = Date.now();
  const ms = Math.max(0, end - now);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return {
    days,
    hours,
    minutes,
    total_ms: ms,
    ended: ms === 0,
  };
}

export const SEASON_DEFAULT_DURATION_DAYS = 30;
export const SEASON_START_RATING = 1200;
