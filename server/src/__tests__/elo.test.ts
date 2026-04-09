import { describe, it, expect } from 'vitest';
import { expectedScore, calculateDelta, applyMatchResult } from '../services/elo.ts';

describe('expectedScore', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });

  it('sums to 1 for any two players (symmetry)', () => {
    const pA = expectedScore(1200, 1800);
    const pB = expectedScore(1800, 1200);
    expect(pA + pB).toBeCloseTo(1);
  });

  it('higher-rated player has expected score > 0.5', () => {
    expect(expectedScore(1800, 1200)).toBeGreaterThan(0.5);
    expect(expectedScore(1200, 1800)).toBeLessThan(0.5);
  });
});

describe('calculateDelta', () => {
  it('returns positive delta for a win', () => {
    const delta = calculateDelta(1500, 1500, 1);
    expect(delta).toBeGreaterThan(0);
  });

  it('returns negative delta for a loss', () => {
    const delta = calculateDelta(1500, 1500, 0);
    expect(delta).toBeLessThan(0);
  });

  it('win + loss deltas cancel out for equal ratings', () => {
    const winDelta = calculateDelta(1500, 1500, 1);
    const lossDelta = calculateDelta(1500, 1500, 0);
    expect(winDelta + lossDelta).toBe(0);
  });

  it('higher-rated player gets smaller delta on win', () => {
    const strongWinDelta = calculateDelta(1800, 1200, 1);
    const weakWinDelta = calculateDelta(1200, 1800, 1);
    expect(strongWinDelta).toBeLessThan(weakWinDelta);
  });

  it('deltas are bounded by K-factor (32)', () => {
    // Even the most extreme upset shouldn't exceed K
    const delta = calculateDelta(1000, 2000, 1);
    expect(Math.abs(delta)).toBeLessThanOrEqual(32);
  });
});

describe('applyMatchResult', () => {
  it('winner gains and loser loses rating', () => {
    const result = applyMatchResult(1500, 1500);
    expect(result.winnerNew).toBeGreaterThan(1500);
    expect(result.loserNew).toBeLessThan(1500);
  });

  it('ratings never drop below 100', () => {
    const result = applyMatchResult(200, 100);
    expect(result.loserNew).toBeGreaterThanOrEqual(100);
  });

  it('returns correct deltas', () => {
    const result = applyMatchResult(1500, 1500);
    expect(result.winnerNew).toBe(1500 + result.winnerDelta);
    expect(result.loserNew).toBe(1500 + result.loserDelta);
  });
});
