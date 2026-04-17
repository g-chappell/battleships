import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_MISSIONS,
  calculateStars,
  getMission,
  type DifficultyLabel,
  type CampaignMission,
  type ObjectiveThresholds,
} from '../campaign';
import { AbilityType } from '../abilities';

const VALID_DIFFICULTY_LABELS: Set<DifficultyLabel> = new Set([
  'Calm Waters',
  'Rough Seas',
  'Storm Warning',
  'Kraken Waters',
  'No Mercy',
]);

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

  it('every mission has a valid difficultyLabel', () => {
    for (const m of CAMPAIGN_MISSIONS) {
      expect(VALID_DIFFICULTY_LABELS.has(m.difficultyLabel)).toBe(true);
    }
  });

  it('missions 1-5 are Act I (Ironbeard — Calm Waters to Rough Seas)', () => {
    const act1 = CAMPAIGN_MISSIONS.filter((m) => m.id <= 5);
    for (const m of act1) {
      expect(['Calm Waters', 'Rough Seas'].includes(m.difficultyLabel)).toBe(true);
    }
  });

  it('missions 11-15 are Act III (Blackheart — hardest labels)', () => {
    const act3 = CAMPAIGN_MISSIONS.filter((m) => m.id >= 11);
    for (const m of act3) {
      expect(['Kraken Waters', 'No Mercy'].includes(m.difficultyLabel)).toBe(true);
    }
  });
});

describe('getMission', () => {
  it('returns the correct mission by id', () => {
    const m = getMission(1);
    expect(m).toBeDefined();
    expect(m!.id).toBe(1);
    expect(m!.title).toBe('Blood at Dawn');
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

describe('MissionModifiers new fields', () => {
  it('requiredCaptain field is accepted on modifiers', () => {
    const m = getMission(1)!;
    const modified: CampaignMission = {
      ...m,
      modifiers: { ...m.modifiers, requiredCaptain: 'ironbeard' },
    };
    expect(modified.modifiers.requiredCaptain).toBe('ironbeard');
  });

  it('forbiddenAbilities field is accepted on modifiers', () => {
    const m = getMission(1)!;
    const modified: CampaignMission = {
      ...m,
      modifiers: {
        ...m.modifiers,
        forbiddenAbilities: [AbilityType.CannonBarrage, AbilityType.ChainShot],
      },
    };
    expect(modified.modifiers.forbiddenAbilities).toHaveLength(2);
    expect(modified.modifiers.forbiddenAbilities).toContain(AbilityType.CannonBarrage);
  });

  it('starTiers field is accepted on modifiers', () => {
    const tiers = {
      bronze: { maxTurns: 40 },
      silver: { maxTurns: 30, minAccuracyPct: 30 },
      gold: { maxTurns: 20, noShipsLost: true },
    };
    const m = getMission(1)!;
    const modified: CampaignMission = {
      ...m,
      modifiers: { ...m.modifiers, starTiers: tiers },
    };
    expect(modified.modifiers.starTiers).toBeDefined();
    expect(modified.modifiers.starTiers!.bronze.maxTurns).toBe(40);
    expect(modified.modifiers.starTiers!.gold.noShipsLost).toBe(true);
  });

  it('requiredCaptain accepts all valid captain IDs', () => {
    const validIds = ['ironbeard', 'mistral', 'blackheart', 'seawitch'] as const;
    for (const id of validIds) {
      const modified = { ...getMission(1)!.modifiers, requiredCaptain: id };
      expect(modified.requiredCaptain).toBe(id);
    }
  });

  it('all three ObjectiveThresholds fields are optional', () => {
    const empty: ObjectiveThresholds = {};
    expect(empty.maxTurns).toBeUndefined();
    expect(empty.minAccuracyPct).toBeUndefined();
    expect(empty.noShipsLost).toBeUndefined();
  });
});

describe('calculateStars with starTiers', () => {
  const makeTieredMission = (
    bronze: ObjectiveThresholds,
    silver: ObjectiveThresholds,
    gold: ObjectiveThresholds
  ): CampaignMission => ({
    ...getMission(1)!,
    modifiers: { starTiers: { bronze, silver, gold } },
  });

  it('returns 0 on loss regardless of tiers', () => {
    const m = makeTieredMission({ maxTurns: 999 }, { maxTurns: 999 }, { maxTurns: 999 });
    expect(calculateStars(m, { won: false, turns: 5, accuracyPct: 100, shipsLost: 0 })).toBe(0);
  });

  it('returns 0 when won but no tiers met', () => {
    const m = makeTieredMission({ maxTurns: 5 }, { maxTurns: 3 }, { maxTurns: 1 });
    // turns=10 → fails all tiers
    expect(calculateStars(m, { won: true, turns: 10, accuracyPct: 0, shipsLost: 0 })).toBe(0);
  });

  it('returns 1 when only bronze tier met', () => {
    const m = makeTieredMission({ maxTurns: 40 }, { maxTurns: 5 }, { maxTurns: 3 });
    // turns=15 meets bronze (≤40), fails silver (>5), fails gold (>3)
    expect(calculateStars(m, { won: true, turns: 15, accuracyPct: 0, shipsLost: 0 })).toBe(1);
  });

  it('returns 2 when bronze and silver tiers met', () => {
    const m = makeTieredMission({ maxTurns: 40 }, { maxTurns: 30 }, { maxTurns: 5 });
    // turns=25 meets bronze (≤40) and silver (≤30), fails gold (>5)
    expect(calculateStars(m, { won: true, turns: 25, accuracyPct: 0, shipsLost: 0 })).toBe(2);
  });

  it('returns 3 when all tiers met', () => {
    const m = makeTieredMission(
      { maxTurns: 40 },
      { maxTurns: 30 },
      { maxTurns: 20, noShipsLost: true }
    );
    // turns=15, no ships lost → all tiers met
    expect(calculateStars(m, { won: true, turns: 15, accuracyPct: 0, shipsLost: 0 })).toBe(3);
  });

  it('each tier is independent (silver can be met without bronze)', () => {
    // bronze requires noShipsLost; silver requires maxTurns ≤ 30; gold requires maxTurns ≤ 5
    const m = makeTieredMission({ noShipsLost: true }, { maxTurns: 30 }, { maxTurns: 5 });
    // turns=15, ships lost=1 → fails bronze, meets silver, fails gold = 1 star
    expect(calculateStars(m, { won: true, turns: 15, accuracyPct: 0, shipsLost: 1 })).toBe(1);
  });

  it('minAccuracyPct is respected in tiers', () => {
    const m = makeTieredMission(
      { minAccuracyPct: 30 },
      { minAccuracyPct: 50 },
      { minAccuracyPct: 70 }
    );
    // accuracyPct=55 → meets bronze (≥30) and silver (≥50), fails gold (<70) = 2 stars
    expect(calculateStars(m, { won: true, turns: 10, accuracyPct: 55, shipsLost: 0 })).toBe(2);
  });

  it('noShipsLost is respected in tiers', () => {
    const m = makeTieredMission(
      { maxTurns: 40 },
      { noShipsLost: true },
      { maxTurns: 20, noShipsLost: true }
    );
    // ships lost = 1 → bronze met (no noShipsLost requirement), silver failed, gold failed = 1 star
    expect(calculateStars(m, { won: true, turns: 15, accuracyPct: 0, shipsLost: 1 })).toBe(1);
    // ships lost = 0, turns = 15 → bronze, silver (noShipsLost), gold (turns≤20 + noShipsLost) = 3 stars
    expect(calculateStars(m, { won: true, turns: 15, accuracyPct: 0, shipsLost: 0 })).toBe(3);
  });

  it('empty ObjectiveThresholds tier is always met (all conditions vacuously true)', () => {
    // All three tiers are empty → all conditions are undefined → all met
    const m = makeTieredMission({}, {}, {});
    expect(calculateStars(m, { won: true, turns: 100, accuracyPct: 0, shipsLost: 10 })).toBe(3);
  });

  it('boundary: turns exactly at maxTurns counts as met', () => {
    const m = makeTieredMission({ maxTurns: 20 }, { maxTurns: 15 }, { maxTurns: 10 });
    // turns exactly 15 → bronze (≤20 ✓), silver (≤15 ✓), gold (>10 ✗) = 2 stars
    expect(calculateStars(m, { won: true, turns: 15, accuracyPct: 0, shipsLost: 0 })).toBe(2);
    // turns exactly 10 → all met = 3 stars
    expect(calculateStars(m, { won: true, turns: 10, accuracyPct: 0, shipsLost: 0 })).toBe(3);
  });

  it('tiers path does not use starRequirements', () => {
    // starRequirements would award 2 stars for turns≤35, but starTiers overrides
    const m = makeTieredMission({ maxTurns: 10 }, { maxTurns: 5 }, { maxTurns: 3 });
    // turns=30 → meets old starRequirements.twoStars (≤35), but fails all tiers (>10) = 0 stars
    expect(calculateStars(m, { won: true, turns: 30, accuracyPct: 0, shipsLost: 0 })).toBe(0);
  });

  it('legacy path still works when starTiers is absent', () => {
    // Original mission 1 has no starTiers → uses starRequirements
    const m = getMission(1)!;
    expect(m.modifiers.starTiers).toBeUndefined();
    // turns=30, ships lost=1 → 2 stars via legacy path
    expect(calculateStars(m, { won: true, turns: 30, accuracyPct: 0, shipsLost: 1 })).toBe(2);
  });
});
