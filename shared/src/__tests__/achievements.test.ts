import { describe, it, expect } from 'vitest';
import {
  evaluateAchievements,
  newlyUnlocked,
  ACHIEVEMENT_DEFS,
  type MatchEvaluationContext,
} from '../achievements';

function makeCtx(overrides: Partial<MatchEvaluationContext> = {}): MatchEvaluationContext {
  return {
    won: false,
    isMultiplayer: false,
    isRanked: false,
    isCampaign: false,
    turns: 0,
    shotsFired: 0,
    shotsHit: 0,
    shipsSunk: 0,
    shipsLost: 0,
    durationMs: 0,
    abilitiesUsed: {},
    abilitySinks: {},
    ironcladSaved: false,
    submarineSonarBlocked: false,
    totalGames: 1,
    totalWins: 0,
    totalShipsSunk: 0,
    rating: 1200,
    ...overrides,
  };
}

describe('achievements', () => {
  it('has 25+ definitions', () => {
    expect(Object.keys(ACHIEVEMENT_DEFS).length).toBeGreaterThanOrEqual(20);
  });

  it('unlocks first_blood when sinking a ship', () => {
    const result = evaluateAchievements(makeCtx({ shipsSunk: 1 }));
    expect(result).toContain('first_blood');
  });

  it('unlocks sharpshooter at 80% accuracy', () => {
    const result = evaluateAchievements(makeCtx({ shotsFired: 10, shotsHit: 8 }));
    expect(result).toContain('sharpshooter');
  });

  it('does not unlock sharpshooter below 80%', () => {
    const result = evaluateAchievements(makeCtx({ shotsFired: 10, shotsHit: 7 }));
    expect(result).not.toContain('sharpshooter');
  });

  it('unlocks untouchable on flawless win', () => {
    const result = evaluateAchievements(makeCtx({ won: true, shipsLost: 0 }));
    expect(result).toContain('untouchable');
  });

  it('unlocks bullseye on fast 5-ship win', () => {
    const result = evaluateAchievements(makeCtx({ won: true, shipsSunk: 5, turns: 20 }));
    expect(result).toContain('bullseye');
  });

  it('unlocks speedrunner under 12 turns', () => {
    const result = evaluateAchievements(makeCtx({ won: true, turns: 10 }));
    expect(result).toContain('speedrunner');
  });

  it('unlocks veteran at 100 games', () => {
    const result = evaluateAchievements(makeCtx({ totalGames: 100 }));
    expect(result).toContain('veteran');
  });

  it('unlocks first_mate on first MP win', () => {
    const result = evaluateAchievements(makeCtx({ won: true, isMultiplayer: true }));
    expect(result).toContain('first_mate');
  });

  it('unlocks admiral at 1500 rating', () => {
    const result = evaluateAchievements(makeCtx({ rating: 1500 }));
    expect(result).toContain('admiral');
  });

  it('unlocks bombardier when cannon barrage scores a sink', () => {
    const result = evaluateAchievements(makeCtx({ abilitySinks: { cannon_barrage: 1 } as any }));
    expect(result).toContain('bombardier');
  });

  it('unlocks ironclad_survivor when armor absorbs a hit', () => {
    const result = evaluateAchievements(makeCtx({ ironcladSaved: true }));
    expect(result).toContain('ironclad_survivor');
  });

  it('newlyUnlocked filters already-unlocked achievements', () => {
    const ctx = makeCtx({ shipsSunk: 1, won: true, shipsLost: 0 });
    const already = new Set(['first_blood']);
    const newly = newlyUnlocked(ctx, already);
    expect(newly).not.toContain('first_blood');
    expect(newly).toContain('untouchable');
  });
});
