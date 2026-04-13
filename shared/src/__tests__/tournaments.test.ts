import { describe, it, expect } from 'vitest';
import {
  VALID_TOURNAMENT_SIZES,
  seedPairings,
  nextBracketSlot,
  totalRounds,
  isFinalRound,
} from '../tournaments';

describe('VALID_TOURNAMENT_SIZES', () => {
  it('contains exactly 4, 8, and 16', () => {
    expect(VALID_TOURNAMENT_SIZES).toContain(4);
    expect(VALID_TOURNAMENT_SIZES).toContain(8);
    expect(VALID_TOURNAMENT_SIZES).toContain(16);
    expect(VALID_TOURNAMENT_SIZES).toHaveLength(3);
  });

  it('all values are powers of 2', () => {
    for (const size of VALID_TOURNAMENT_SIZES) {
      expect(size & (size - 1)).toBe(0);
    }
  });
});

describe('seedPairings', () => {
  it('produces correct pairings for 4 players', () => {
    const ids = ['p1', 'p2', 'p3', 'p4'];
    const pairs = seedPairings(ids);
    expect(pairs).toHaveLength(2);
    // 1 vs 4, 2 vs 3
    expect(pairs[0]).toEqual(['p1', 'p4']);
    expect(pairs[1]).toEqual(['p2', 'p3']);
  });

  it('produces correct pairings for 8 players', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const pairs = seedPairings(ids);
    expect(pairs).toHaveLength(4);
    // 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5
    expect(pairs[0]).toEqual(['p1', 'p8']);
    expect(pairs[1]).toEqual(['p2', 'p7']);
    expect(pairs[2]).toEqual(['p3', 'p6']);
    expect(pairs[3]).toEqual(['p4', 'p5']);
  });

  it('produces correct pairings for 16 players', () => {
    const ids = Array.from({ length: 16 }, (_, i) => `p${i + 1}`);
    const pairs = seedPairings(ids);
    expect(pairs).toHaveLength(8);
    // 1 vs 16, 2 vs 15, ..., 8 vs 9
    expect(pairs[0]).toEqual(['p1', 'p16']);
    expect(pairs[7]).toEqual(['p8', 'p9']);
  });

  it('every player appears in exactly one pairing', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const pairs = seedPairings(ids);
    const allPlayers = pairs.flat();
    expect(new Set(allPlayers).size).toBe(ids.length);
    expect(allPlayers).toHaveLength(ids.length);
  });

  it('throws for non-power-of-2 size', () => {
    expect(() => seedPairings(['a', 'b', 'c'])).toThrow();
    expect(() => seedPairings(['a', 'b', 'c', 'd', 'e'])).toThrow();
    expect(() => seedPairings(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toThrow();
  });

  it('throws for size less than 2', () => {
    expect(() => seedPairings(['a'])).toThrow();
    expect(() => seedPairings([])).toThrow();
  });
});

describe('nextBracketSlot', () => {
  it('bracket index 0 goes to next index 0, slot p1', () => {
    const result = nextBracketSlot(0);
    expect(result.nextBracketIdx).toBe(0);
    expect(result.slot).toBe('p1');
  });

  it('bracket index 1 goes to next index 0, slot p2', () => {
    const result = nextBracketSlot(1);
    expect(result.nextBracketIdx).toBe(0);
    expect(result.slot).toBe('p2');
  });

  it('bracket index 2 goes to next index 1, slot p1', () => {
    const result = nextBracketSlot(2);
    expect(result.nextBracketIdx).toBe(1);
    expect(result.slot).toBe('p1');
  });

  it('bracket index 3 goes to next index 1, slot p2', () => {
    const result = nextBracketSlot(3);
    expect(result.nextBracketIdx).toBe(1);
    expect(result.slot).toBe('p2');
  });

  it('even bracket indices always get p1 slot', () => {
    for (const idx of [0, 2, 4, 6, 8]) {
      expect(nextBracketSlot(idx).slot).toBe('p1');
    }
  });

  it('odd bracket indices always get p2 slot', () => {
    for (const idx of [1, 3, 5, 7, 9]) {
      expect(nextBracketSlot(idx).slot).toBe('p2');
    }
  });

  it('advances correctly through a full 8-player bracket (4 first-round matches)', () => {
    // First round bracket indices 0-3 each advance to quarter-final slots
    expect(nextBracketSlot(0)).toEqual({ nextBracketIdx: 0, slot: 'p1' });
    expect(nextBracketSlot(1)).toEqual({ nextBracketIdx: 0, slot: 'p2' });
    expect(nextBracketSlot(2)).toEqual({ nextBracketIdx: 1, slot: 'p1' });
    expect(nextBracketSlot(3)).toEqual({ nextBracketIdx: 1, slot: 'p2' });
  });
});

describe('totalRounds', () => {
  it('returns 2 for a 4-player tournament', () => {
    expect(totalRounds(4)).toBe(2);
  });

  it('returns 3 for an 8-player tournament', () => {
    expect(totalRounds(8)).toBe(3);
  });

  it('returns 4 for a 16-player tournament', () => {
    expect(totalRounds(16)).toBe(4);
  });

  it('returns 1 for a 2-player tournament', () => {
    expect(totalRounds(2)).toBe(1);
  });
});

describe('isFinalRound', () => {
  it('detects final round in a 4-player tournament (round 1)', () => {
    expect(isFinalRound(4, 1)).toBe(true);
  });

  it('returns false for non-final round in a 4-player tournament (round 0)', () => {
    expect(isFinalRound(4, 0)).toBe(false);
  });

  it('detects final round in an 8-player tournament (round 2)', () => {
    expect(isFinalRound(8, 2)).toBe(true);
  });

  it('returns false for semifinal round in an 8-player tournament (round 1)', () => {
    expect(isFinalRound(8, 1)).toBe(false);
  });

  it('detects final round in a 16-player tournament (round 3)', () => {
    expect(isFinalRound(16, 3)).toBe(true);
  });

  it('returns false for quarterfinal round in a 16-player tournament (round 1)', () => {
    expect(isFinalRound(16, 1)).toBe(false);
  });

  it('returns false for round 0 in all tournament sizes', () => {
    for (const size of VALID_TOURNAMENT_SIZES) {
      expect(isFinalRound(size, 0)).toBe(false);
    }
  });
});
