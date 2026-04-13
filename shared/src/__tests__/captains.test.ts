import { describe, it, expect } from 'vitest';
import {
  CAPTAIN_DEFS,
  CAPTAIN_IDS,
  DEFAULT_CAPTAIN,
  type CaptainDef,
} from '../captains';
import { ABILITY_DEFS, AbilityType } from '../abilities';

describe('CAPTAIN_IDS', () => {
  it('contains exactly three captain IDs', () => {
    expect(CAPTAIN_IDS).toHaveLength(3);
  });

  it('contains ironbeard, mistral, and blackheart', () => {
    expect(CAPTAIN_IDS).toContain('ironbeard');
    expect(CAPTAIN_IDS).toContain('mistral');
    expect(CAPTAIN_IDS).toContain('blackheart');
  });

  it('has no duplicate IDs', () => {
    const unique = new Set(CAPTAIN_IDS);
    expect(unique.size).toBe(CAPTAIN_IDS.length);
  });

  it('matches the keys of CAPTAIN_DEFS', () => {
    const defKeys = Object.keys(CAPTAIN_DEFS).sort();
    expect([...CAPTAIN_IDS].sort()).toEqual(defKeys);
  });
});

describe('CAPTAIN_DEFS', () => {
  it('has an entry for every CAPTAIN_ID', () => {
    for (const id of CAPTAIN_IDS) {
      expect(CAPTAIN_DEFS[id]).toBeDefined();
    }
  });

  it('each entry id matches its key', () => {
    for (const [key, captain] of Object.entries(CAPTAIN_DEFS)) {
      expect(captain.id).toBe(key);
    }
  });

  it('each captain has a non-empty name', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.name).toBe('string');
      expect(captain.name.length).toBeGreaterThan(0);
    }
  });

  it('each captain has a non-empty title', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.title).toBe('string');
      expect(captain.title.length).toBeGreaterThan(0);
    }
  });

  it('each captain has a non-empty description', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.description).toBe('string');
      expect(captain.description.length).toBeGreaterThan(0);
    }
  });

  it('each captain has a color string', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(typeof captain.color).toBe('string');
      expect(captain.color.length).toBeGreaterThan(0);
    }
  });

  it('each captain has exactly 3 abilities', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      expect(captain.abilities).toHaveLength(3);
    }
  });

  it('all abilities in each loadout exist in ABILITY_DEFS', () => {
    const validAbilityTypes = new Set(Object.values(AbilityType));
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      for (const ability of captain.abilities) {
        expect(validAbilityTypes.has(ability)).toBe(true);
        expect(ABILITY_DEFS[ability]).toBeDefined();
      }
    }
  });

  it('no duplicate abilities within a single captain loadout', () => {
    for (const captain of Object.values(CAPTAIN_DEFS)) {
      const unique = new Set(captain.abilities);
      expect(unique.size).toBe(captain.abilities.length);
    }
  });
});

describe('ironbeard', () => {
  const captain: CaptainDef = CAPTAIN_DEFS['ironbeard'];

  it('has id ironbeard', () => {
    expect(captain.id).toBe('ironbeard');
  });

  it('has name Ironbeard', () => {
    expect(captain.name).toBe('Ironbeard');
  });

  it('has abilities CannonBarrage, ChainShot, BoardingParty', () => {
    expect(captain.abilities).toContain(AbilityType.CannonBarrage);
    expect(captain.abilities).toContain(AbilityType.ChainShot);
    expect(captain.abilities).toContain(AbilityType.BoardingParty);
  });
});

describe('mistral', () => {
  const captain: CaptainDef = CAPTAIN_DEFS['mistral'];

  it('has id mistral', () => {
    expect(captain.id).toBe('mistral');
  });

  it('has name Mistral', () => {
    expect(captain.name).toBe('Mistral');
  });

  it('has abilities SonarPing, Spyglass, SmokeScreen', () => {
    expect(captain.abilities).toContain(AbilityType.SonarPing);
    expect(captain.abilities).toContain(AbilityType.Spyglass);
    expect(captain.abilities).toContain(AbilityType.SmokeScreen);
  });
});

describe('blackheart', () => {
  const captain: CaptainDef = CAPTAIN_DEFS['blackheart'];

  it('has id blackheart', () => {
    expect(captain.id).toBe('blackheart');
  });

  it('has name Blackheart', () => {
    expect(captain.name).toBe('Blackheart');
  });

  it('has abilities RepairKit, CannonBarrage, SonarPing', () => {
    expect(captain.abilities).toContain(AbilityType.RepairKit);
    expect(captain.abilities).toContain(AbilityType.CannonBarrage);
    expect(captain.abilities).toContain(AbilityType.SonarPing);
  });
});

describe('DEFAULT_CAPTAIN', () => {
  it('is a valid captain ID', () => {
    expect(CAPTAIN_IDS).toContain(DEFAULT_CAPTAIN);
  });

  it('is ironbeard', () => {
    expect(DEFAULT_CAPTAIN).toBe('ironbeard');
  });

  it('has a corresponding entry in CAPTAIN_DEFS', () => {
    expect(CAPTAIN_DEFS[DEFAULT_CAPTAIN]).toBeDefined();
  });
});
