import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getSeasonTimeRemaining,
  SEASON_DEFAULT_DURATION_DAYS,
  SEASON_START_RATING,
} from '../seasons';

afterEach(() => {
  vi.useRealTimers();
});

describe('SEASON constants', () => {
  it('SEASON_DEFAULT_DURATION_DAYS is a positive integer', () => {
    expect(SEASON_DEFAULT_DURATION_DAYS).toBeGreaterThan(0);
    expect(Number.isInteger(SEASON_DEFAULT_DURATION_DAYS)).toBe(true);
  });

  it('SEASON_DEFAULT_DURATION_DAYS is 30', () => {
    expect(SEASON_DEFAULT_DURATION_DAYS).toBe(30);
  });

  it('SEASON_START_RATING is a positive integer', () => {
    expect(SEASON_START_RATING).toBeGreaterThan(0);
    expect(Number.isInteger(SEASON_START_RATING)).toBe(true);
  });

  it('SEASON_START_RATING is 1200', () => {
    expect(SEASON_START_RATING).toBe(1200);
  });
});

describe('getSeasonTimeRemaining', () => {
  it('returns positive days/hours/minutes for a future end date', () => {
    const now = new Date('2026-04-13T12:00:00.000Z').getTime();
    vi.setSystemTime(now);

    const endAt = new Date('2026-05-13T12:00:00.000Z').toISOString(); // 30 days later
    const result = getSeasonTimeRemaining(endAt);

    expect(result.days).toBe(30);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.total_ms).toBe(30 * 24 * 60 * 60 * 1000);
    expect(result.ended).toBe(false);
  });

  it('returns zeros for a past end date', () => {
    const now = new Date('2026-04-13T12:00:00.000Z').getTime();
    vi.setSystemTime(now);

    const endAt = new Date('2026-03-01T00:00:00.000Z').toISOString(); // past
    const result = getSeasonTimeRemaining(endAt);

    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.total_ms).toBe(0);
    expect(result.ended).toBe(true);
  });

  it('returns zeros when end date is exactly now', () => {
    const now = new Date('2026-04-13T12:00:00.000Z').getTime();
    vi.setSystemTime(now);

    const endAt = new Date(now).toISOString();
    const result = getSeasonTimeRemaining(endAt);

    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.total_ms).toBe(0);
    expect(result.ended).toBe(true);
  });

  it('handles 1 second remaining', () => {
    const now = new Date('2026-04-13T12:00:00.000Z').getTime();
    vi.setSystemTime(now);

    const endAt = new Date(now + 1000).toISOString(); // 1 second later
    const result = getSeasonTimeRemaining(endAt);

    expect(result.total_ms).toBe(1000);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.ended).toBe(false);
  });

  it('correctly breaks down mixed days/hours/minutes', () => {
    const now = new Date('2026-04-13T00:00:00.000Z').getTime();
    vi.setSystemTime(now);

    // 2 days + 3 hours + 45 minutes
    const ms = (2 * 24 * 60 * 60 + 3 * 60 * 60 + 45 * 60) * 1000;
    const endAt = new Date(now + ms).toISOString();
    const result = getSeasonTimeRemaining(endAt);

    expect(result.days).toBe(2);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(45);
    expect(result.total_ms).toBe(ms);
    expect(result.ended).toBe(false);
  });

  it('accepts a Date object as well as a string', () => {
    const now = new Date('2026-04-13T12:00:00.000Z').getTime();
    vi.setSystemTime(now);

    const endDate = new Date(now + 24 * 60 * 60 * 1000); // 1 day later
    const result = getSeasonTimeRemaining(endDate);

    expect(result.days).toBe(1);
    expect(result.ended).toBe(false);
  });

  it('1 hour remaining returns correct breakdown', () => {
    const now = new Date('2026-04-13T00:00:00.000Z').getTime();
    vi.setSystemTime(now);

    const endAt = new Date(now + 60 * 60 * 1000).toISOString();
    const result = getSeasonTimeRemaining(endAt);

    expect(result.days).toBe(0);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(0);
    expect(result.ended).toBe(false);
  });
});
