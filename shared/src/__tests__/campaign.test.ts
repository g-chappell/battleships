import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_MISSIONS,
  calculateStars,
  getMission,
  type CampaignMission,
} from '../campaign';
import { AbilityType } from '../abilities';

describe('CAMPAIGN_MISSIONS data integrity', () => {
  it('has exactly 15 missions', () => {
    expect(CAMPAIGN_MISSIONS).toHaveLength(15);
  });

  it('mission IDs are 1 through 15 with no gaps or duplicates', () => {
    const ids = CAMPAIGN_MISSIONS.map((m) => m.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('every mission has a non-empty title and subtitle', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      expect(m.title.trim().length).toBeGreaterThan(0);
      expect(m.subtitle.trim().length).toBeGreaterThan(0);
    }
  });

  it('every mission has a valid difficulty', () => {
    const valid = new Set(['easy', 'medium', 'hard']);
    for (const m of CAMPAIGN_MISSIONS) {
      expect(valid.has(m.difficulty)).toBe(true);
    }
  });

  it('every mission has a valid aiPersonality', () => {
    const valid = new Set(['standard', 'aggressive', 'cautious', 'kraken']);
    for (const m of CAMPAIGN_MISSIONS) {
      expect(valid.has(m.aiPersonality)).toBe(true);
    }
  });

  it('early missions (1-3) are easy difficulty', () => {
    const earlyMissions = CAMPAIGN_MISSIONS.filter((m) => m.id <= 3);
    for (const m of earlyMissions) {
      expect(m.difficulty).toBe('easy');
    }
  });

  it('later missions (8-15) are hard difficulty', () => {
    const hardMissions = CAMPAIGN_MISSIONS.filter((m) => m.id >= 8);
    for (const m of hardMissions) {
      expect(m.difficulty).toBe('hard');
    }
  });

  it('every mission has at least one intro panel', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      expect(m.introPanels.length).toBeGreaterThan(0);
    }
  });

  it('every mission has at least one outro panel', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      expect(m.outroPanels.length).toBeGreaterThan(0);
    }
  });

  it('every comic panel has a non-empty background and caption', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      for (const panel of [...m.introPanels, ...m.outroPanels]) {
        expect(panel.background.trim().length).toBeGreaterThan(0);
        expect(panel.caption.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every mission has two-star requirements', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      const two = m.starRequirements.twoStars;
      expect(two).toBeDefined();
      // at least one criterion set
      expect(two.maxTurns !== undefined || two.minAccuracyPct !== undefined).toBe(true);
    }
  });

  it('every mission has three-star requirements', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      const three = m.starRequirements.threeStars;
      expect(three).toBeDefined();
      // at least one criterion set
      expect(
        three.maxTurns !== undefined ||
          three.minAccuracyPct !== undefined ||
          three.noShipsLost !== undefined
      ).toBe(true);
    }
  });

  it('three-star maxTurns is always stricter (lower) than two-star when both are set', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      const two = m.starRequirements.twoStars;
      const three = m.starRequirements.threeStars;
      if (two.maxTurns !== undefined && three.maxTurns !== undefined) {
        expect(three.maxTurns).toBeLessThan(two.maxTurns);
      }
    }
  });

  it('fixedAbilities reference valid AbilityType values', () => {
    const validAbilities = new Set(Object.values(AbilityType));
    for (const m of CAMPAIGN_MISSIONS) {
      if (m.modifiers.fixedAbilities) {
        for (const ability of m.modifiers.fixedAbilities) {
          expect(validAbilities.has(ability)).toBe(true);
        }
      }
    }
  });

  it('missions with fixedAbilities have exactly 2 abilities', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      if (m.modifiers.fixedAbilities) {
        expect(m.modifiers.fixedAbilities).toHaveLength(2);
      }
    }
  });

  it('the final mission (id 15) uses both foggyVision and krakenAttack', () => {
    const last = CAMPAIGN_MISSIONS.find((m) => m.id === 15)!;
    expect(last.modifiers.foggyVision).toBe(true);
    expect(last.modifiers.krakenAttack).toBe(true);
  });
});

describe('getMission', () => {
  it('returns the correct mission by id', () => {
    const m = getMission(1);
    expect(m).toBeDefined();
    expect(m!.id).toBe(1);
    expect(m!.title).toBe('Maiden Voyage');
  });

  it('returns undefined for an out-of-range id', () => {
    expect(getMission(0)).toBeUndefined();
    expect(getMission(16)).toBeUndefined();
    expect(getMission(-1)).toBeUndefined();
  });

  it('finds all 15 missions by id', () => {
    for (let i = 1; i <= 15; i++) {
      expect(getMission(i)).toBeDefined();
    }
  });
});

describe('calculateStars', () => {
  const mission1 = getMission(1)!; // twoStars: maxTurns 35, threeStars: maxTurns 25, noShipsLost

  it('returns 0 on a loss', () => {
    expect(calculateStars(mission1, { won: false, turns: 10, accuracyPct: 100, shipsLost: 0 })).toBe(0);
  });

  it('returns 1 star when won but does not meet two-star criteria', () => {
    // turns > 35 → only 1 star
    expect(calculateStars(mission1, { won: true, turns: 36, accuracyPct: 0, shipsLost: 2 })).toBe(1);
  });

  it('returns 2 stars when two-star criteria met but not three-star', () => {
    // turns 30 (≤35) but ships lost and turns > 25
    expect(calculateStars(mission1, { won: true, turns: 30, accuracyPct: 0, shipsLost: 1 })).toBe(2);
  });

  it('returns 3 stars when all criteria met', () => {
    // turns 20 (≤25), no ships lost
    expect(calculateStars(mission1, { won: true, turns: 20, accuracyPct: 0, shipsLost: 0 })).toBe(3);
  });

  it('does not award 3 stars if noShipsLost is required but ships were lost', () => {
    expect(calculateStars(mission1, { won: true, turns: 20, accuracyPct: 0, shipsLost: 1 })).toBe(2);
  });

  it('handles minAccuracyPct requirement correctly (mission 3)', () => {
    // mission 3: threeStars: { maxTurns: 22, minAccuracyPct: 40 }
    const m3 = getMission(3)!;
    // meets turns but not accuracy
    expect(calculateStars(m3, { won: true, turns: 20, accuracyPct: 39, shipsLost: 0 })).toBe(2);
    // meets both
    expect(calculateStars(m3, { won: true, turns: 20, accuracyPct: 40, shipsLost: 0 })).toBe(3);
  });

  it('awards exactly at the boundary (turns === maxTurns)', () => {
    // turns exactly 35 should still earn 2 stars
    expect(calculateStars(mission1, { won: true, turns: 35, accuracyPct: 0, shipsLost: 1 })).toBe(2);
    // turns exactly 25 with no ships lost should earn 3 stars
    expect(calculateStars(mission1, { won: true, turns: 25, accuracyPct: 0, shipsLost: 0 })).toBe(3);
  });

  it('returns 3 stars for a perfect run on the last mission', () => {
    const last = getMission(15)!;
    // threeStars: { maxTurns: 35, noShipsLost: true }
    expect(calculateStars(last, { won: true, turns: 30, accuracyPct: 0, shipsLost: 0 })).toBe(3);
  });

  it('cannot skip from 1 star to 3 stars (must pass 2-star first)', () => {
    // mission1 threeStars needs maxTurns 25 and noShipsLost
    // but twoStars needs maxTurns 35 — if we fail 2-star (turns > 35),
    // we cannot earn 3 stars even if three-star conditions would otherwise pass
    // turns > 35 fails 2-star, so result must be 1
    expect(calculateStars(mission1, { won: true, turns: 40, accuracyPct: 0, shipsLost: 0 })).toBe(1);
  });
});
