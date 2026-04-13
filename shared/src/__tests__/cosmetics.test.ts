import { describe, it, expect } from 'vitest';
import {
  COSMETIC_CATALOG,
  GOLD_REWARDS,
  getCosmetic,
  getCosmeticsByKind,
  type CosmeticKind,
  type CosmeticRarity,
} from '../cosmetics';

const VALID_KINDS: CosmeticKind[] = ['ship_skin', 'board_theme', 'explosion_fx'];
const VALID_RARITIES: CosmeticRarity[] = ['common', 'rare', 'legendary'];

describe('COSMETIC_CATALOG', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(COSMETIC_CATALOG)).toBe(true);
    expect(COSMETIC_CATALOG.length).toBeGreaterThan(0);
  });

  it('all entries have non-empty id strings', () => {
    for (const entry of COSMETIC_CATALOG) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    }
  });

  it('IDs are unique within each kind', () => {
    for (const kind of VALID_KINDS) {
      const ids = COSMETIC_CATALOG.filter((c) => c.kind === kind).map((c) => c.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });

  it('all prices are non-negative numbers', () => {
    for (const entry of COSMETIC_CATALOG) {
      expect(typeof entry.price).toBe('number');
      expect(entry.price).toBeGreaterThanOrEqual(0);
    }
  });

  it('non-default items have price > 0', () => {
    for (const entry of COSMETIC_CATALOG) {
      if (entry.id !== 'default') {
        expect(entry.price).toBeGreaterThan(0);
      }
    }
  });

  it('all rarity values are valid', () => {
    for (const entry of COSMETIC_CATALOG) {
      expect(VALID_RARITIES).toContain(entry.rarity);
    }
  });

  it('all kind values are valid', () => {
    for (const entry of COSMETIC_CATALOG) {
      expect(VALID_KINDS).toContain(entry.kind);
    }
  });

  it('all entries have name and description strings', () => {
    for (const entry of COSMETIC_CATALOG) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('all entries have a previewColor string', () => {
    for (const entry of COSMETIC_CATALOG) {
      expect(typeof entry.previewColor).toBe('string');
      expect(entry.previewColor.length).toBeGreaterThan(0);
    }
  });

  it('contains entries for all three kinds', () => {
    for (const kind of VALID_KINDS) {
      const matching = COSMETIC_CATALOG.filter((c) => c.kind === kind);
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  it('each kind has exactly one default entry', () => {
    for (const kind of VALID_KINDS) {
      const defaults = COSMETIC_CATALOG.filter(
        (c) => c.kind === kind && c.id === 'default'
      );
      expect(defaults.length).toBe(1);
    }
  });
});

describe('getCosmetic', () => {
  it('returns a CosmeticDef for a known id', () => {
    const result = getCosmetic('default');
    expect(result).toBeDefined();
    expect(result?.id).toBe('default');
  });

  it('returns a specific non-default cosmetic by id', () => {
    const result = getCosmetic('skin.blackbeard');
    expect(result).toBeDefined();
    expect(result?.id).toBe('skin.blackbeard');
    expect(result?.kind).toBe('ship_skin');
    expect(result?.rarity).toBe('rare');
  });

  it('returns a legendary cosmetic correctly', () => {
    const result = getCosmetic('skin.ghost_fleet');
    expect(result).toBeDefined();
    expect(result?.rarity).toBe('legendary');
    expect(result?.price).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown id', () => {
    const result = getCosmetic('nonexistent.id');
    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    const result = getCosmetic('');
    expect(result).toBeUndefined();
  });
});

describe('getCosmeticsByKind', () => {
  it('returns only ship_skin entries', () => {
    const result = getCosmeticsByKind('ship_skin');
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.kind).toBe('ship_skin');
    }
  });

  it('returns only board_theme entries', () => {
    const result = getCosmeticsByKind('board_theme');
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.kind).toBe('board_theme');
    }
  });

  it('returns only explosion_fx entries', () => {
    const result = getCosmeticsByKind('explosion_fx');
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.kind).toBe('explosion_fx');
    }
  });

  it('results do not overlap across kinds', () => {
    const skins = getCosmeticsByKind('ship_skin');
    const themes = getCosmeticsByKind('board_theme');
    const fx = getCosmeticsByKind('explosion_fx');
    const total = skins.length + themes.length + fx.length;
    expect(total).toBe(COSMETIC_CATALOG.length);
  });

  it('returns items matching the full catalog count per kind', () => {
    for (const kind of VALID_KINDS) {
      const expected = COSMETIC_CATALOG.filter((c) => c.kind === kind).length;
      const actual = getCosmeticsByKind(kind).length;
      expect(actual).toBe(expected);
    }
  });
});

describe('GOLD_REWARDS', () => {
  it('has entries for standard win scenarios', () => {
    expect(GOLD_REWARDS.WIN_MP_RANKED).toBeDefined();
    expect(GOLD_REWARDS.WIN_MP_CASUAL).toBeDefined();
    expect(GOLD_REWARDS.WIN_AI_EASY).toBeDefined();
    expect(GOLD_REWARDS.WIN_AI_MEDIUM).toBeDefined();
    expect(GOLD_REWARDS.WIN_AI_HARD).toBeDefined();
    expect(GOLD_REWARDS.WIN_CAMPAIGN).toBeDefined();
  });

  it('has entries for consolation and tournament rewards', () => {
    expect(GOLD_REWARDS.LOSS_CONSOLATION).toBeDefined();
    expect(GOLD_REWARDS.TOURNAMENT_WIN).toBeDefined();
    expect(GOLD_REWARDS.TOURNAMENT_RUNNER_UP).toBeDefined();
  });

  it('all reward values are positive integers', () => {
    for (const value of Object.values(GOLD_REWARDS)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('ranked win rewards more than casual', () => {
    expect(GOLD_REWARDS.WIN_MP_RANKED).toBeGreaterThan(GOLD_REWARDS.WIN_MP_CASUAL);
  });

  it('AI difficulty rewards scale correctly', () => {
    expect(GOLD_REWARDS.WIN_AI_HARD).toBeGreaterThan(GOLD_REWARDS.WIN_AI_MEDIUM);
    expect(GOLD_REWARDS.WIN_AI_MEDIUM).toBeGreaterThan(GOLD_REWARDS.WIN_AI_EASY);
  });

  it('tournament win rewards more than runner-up', () => {
    expect(GOLD_REWARDS.TOURNAMENT_WIN).toBeGreaterThan(GOLD_REWARDS.TOURNAMENT_RUNNER_UP);
  });
});
