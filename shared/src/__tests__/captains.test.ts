import { describe, it, expect } from 'vitest';
import { CAPTAIN_DEFS, CAPTAIN_IDS, DEFAULT_CAPTAIN, type CaptainDef } from '../captains';
import { ABILITY_DEFS, AbilityType } from '../abilities';

const VALID_ABILITY_TYPES = new Set<string>(Object.values(AbilityType));

describe('CAPTAIN_DEFS', () => {
  it('is a non-empty record', () => {
    expect(typeof CAPTAIN_DEFS).toBe('object');
    expect(Object.keys(CAPTAIN_DEFS).length).toBeGreaterThan(0);
  });

  it('has exactly 4 captains', () => {
    expect(Object.keys(CAPTAIN_DEFS).length).toBe(4);
  });

  it('contains entries for ironbeard, mistral, blackheart, and seawitch', () => {
    expect(CAPTAIN_DEFS['ironbeard']).toBeDefined();
    expect(CAPTAIN_DEFS['mistral']).toBeDefined();
    expect(CAPTAIN_DEFS['blackheart']).toBeDefined();
    expect(CAPTAIN_DEFS['seawitch']).toBeDefined();
  });

  it('all captain keys match their id field', () => {
    for (const [key, captain] of Object.entries(CAPTAIN_DEFS)) {
      expect(captain.id).toBe(key);
    }
  });

  it('all captains have non-empty name and title strings', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.name).toBe('string');
      expect(captain.name.length).toBeGreaterThan(0);
      expect(typeof captain.title).toBe('string');
      expect(captain.title.length).toBeGreaterThan(0);
    }
  });

  it('all captains have non-empty description strings', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.description).toBe('string');
      expect(captain.description.length).toBeGreaterThan(0);
    }
  });

  it('all captains have a color string', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.color).toBe('string');
      expect(captain.color.length).toBeGreaterThan(0);
    }
  });

  it('all captains have exactly 3 abilities', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(Array.isArray(captain.abilities)).toBe(true);
      expect(captain.abilities.length).toBe(3);
    }
  });

  it('all captain abilities exist in ABILITY_DEFS', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      for (const ability of captain.abilities) {
        expect(VALID_ABILITY_TYPES).toContain(ability);
        expect(ABILITY_DEFS[ability]).toBeDefined();
      }
    }
  });

  it('no duplicate IDs across all captains', () => {
    const ids = Object.values(CAPTAIN_DEFS).map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('CAPTAIN_IDS', () => {
  it('is an array of strings', () => {
    expect(Array.isArray(CAPTAIN_IDS)).toBe(true);
    for (const id of CAPTAIN_IDS) {
      expect(typeof id).toBe('string');
    }
  });

  it('matches the keys of CAPTAIN_DEFS', () => {
    const defKeys = Object.keys(CAPTAIN_DEFS).sort();
    const idsorted = [...CAPTAIN_IDS].sort();
    expect(idsorted).toEqual(defKeys);
  });

  it('contains all expected captain IDs', () => {
    expect(CAPTAIN_IDS).toContain('ironbeard');
    expect(CAPTAIN_IDS).toContain('mistral');
    expect(CAPTAIN_IDS).toContain('blackheart');
    expect(CAPTAIN_IDS).toContain('seawitch');
  });

  it('has no duplicate IDs', () => {
    const unique = new Set(CAPTAIN_IDS);
    expect(unique.size).toBe(CAPTAIN_IDS.length);
  });
});

describe('DEFAULT_CAPTAIN', () => {
  it('is a string', () => {
    expect(typeof DEFAULT_CAPTAIN).toBe('string');
  });

  it('is a valid captain ID in CAPTAIN_DEFS', () => {
    expect(CAPTAIN_DEFS[DEFAULT_CAPTAIN]).toBeDefined();
  });

  it('is included in CAPTAIN_IDS', () => {
    expect(CAPTAIN_IDS).toContain(DEFAULT_CAPTAIN);
  });

  it('is ironbeard', () => {
    expect(DEFAULT_CAPTAIN).toBe('ironbeard');
  });
});

describe('Individual captain ability loadouts', () => {
  it('ironbeard has CannonBarrage, ChainShot, BoardingParty', () => {
    const { abilities } = CAPTAIN_DEFS['ironbeard'];
    expect(abilities).toContain(AbilityType.CannonBarrage);
    expect(abilities).toContain(AbilityType.ChainShot);
    expect(abilities).toContain(AbilityType.BoardingParty);
  });

  it('mistral has SonarPing, Spyglass, SmokeScreen', () => {
    const { abilities } = CAPTAIN_DEFS['mistral'];
    expect(abilities).toContain(AbilityType.SonarPing);
    expect(abilities).toContain(AbilityType.Spyglass);
    expect(abilities).toContain(AbilityType.SmokeScreen);
  });

  it('blackheart has RepairKit, CannonBarrage, SonarPing', () => {
    const { abilities } = CAPTAIN_DEFS['blackheart'];
    expect(abilities).toContain(AbilityType.RepairKit);
    expect(abilities).toContain(AbilityType.CannonBarrage);
    expect(abilities).toContain(AbilityType.SonarPing);
  });

  it('seawitch has SummonKraken, SonarPing, SmokeScreen', () => {
    const { abilities } = CAPTAIN_DEFS['seawitch'];
    expect(abilities).toContain(AbilityType.SummonKraken);
    expect(abilities).toContain(AbilityType.SonarPing);
    expect(abilities).toContain(AbilityType.SmokeScreen);
  });
});

describe('CaptainDef type structure', () => {
  it('all CAPTAIN_DEFS entries satisfy the CaptainDef interface shape', () => {
    const requiredFields: (keyof CaptainDef)[] = [
      'id',
      'name',
      'title',
      'description',
      'abilities',
      'color',
    ];
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      for (const field of requiredFields) {
        expect(captain[field]).toBeDefined();
      }
    }
  });
});
