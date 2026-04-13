import { describe, it, expect } from 'vitest';
import {
  MAX_REPLAY_EVENTS,
  type ReplaySide,
  type ReplayEvent,
  type ReplayPlayerRef,
  type ReplayData,
} from '../replay';
import { AbilityType } from '../abilities';
import { ShipType, Orientation, ShotResult } from '../types';

describe('MAX_REPLAY_EVENTS', () => {
  it('is defined and is a positive number', () => {
    expect(typeof MAX_REPLAY_EVENTS).toBe('number');
    expect(MAX_REPLAY_EVENTS).toBeGreaterThan(0);
  });

  it('is at least 100 (covers a typical full game)', () => {
    // A standard game has at most 17 ships × 5 cells = 85 shots to sink all ships
    // plus placement events, turn events, and end event — 100 is a reasonable floor
    expect(MAX_REPLAY_EVENTS).toBeGreaterThanOrEqual(100);
  });

  it('is at most 10000 (prevents pathological storage usage)', () => {
    expect(MAX_REPLAY_EVENTS).toBeLessThanOrEqual(10000);
  });

  it('is exactly 500', () => {
    expect(MAX_REPLAY_EVENTS).toBe(500);
  });
});

describe('ReplayPlayerRef structure', () => {
  it('can be constructed with id and username', () => {
    const ref: ReplayPlayerRef = { id: 'user-1', username: 'Ironbeard' };
    expect(ref.id).toBe('user-1');
    expect(ref.username).toBe('Ironbeard');
  });
});

describe('ReplayEvent kinds', () => {
  it('supports a placement event for p1', () => {
    const event: ReplayEvent = {
      t: 0,
      kind: 'placement',
      side: 'p1',
      placements: [
        { type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
      ],
    };
    expect(event.kind).toBe('placement');
    expect(event.side).toBe('p1');
    expect(event.placements).toHaveLength(1);
  });

  it('supports a placement event for p2', () => {
    const event: ReplayEvent = {
      t: 1,
      kind: 'placement',
      side: 'p2',
      placements: [],
    };
    expect(event.side).toBe('p2');
  });

  it('supports a fire event with hit outcome', () => {
    const event: ReplayEvent = {
      t: 5,
      kind: 'fire',
      side: 'p1',
      coord: { row: 3, col: 4 },
      outcome: { result: ShotResult.Hit, coordinate: { row: 3, col: 4 } },
    };
    expect(event.kind).toBe('fire');
    expect(event.coord).toEqual({ row: 3, col: 4 });
    expect(event.outcome.result).toBe(ShotResult.Hit);
  });

  it('supports a fire event with sink outcome', () => {
    const event: ReplayEvent = {
      t: 10,
      kind: 'fire',
      side: 'p2',
      coord: { row: 1, col: 1 },
      outcome: {
        result: ShotResult.Sunk,
        coordinate: { row: 1, col: 1 },
        sunkShip: ShipType.Destroyer,
      },
    };
    expect(event.outcome.result).toBe(ShotResult.Sunk);
    expect(event.outcome.sunkShip).toBe(ShipType.Destroyer);
  });

  it('supports a fire event with miss outcome', () => {
    const event: ReplayEvent = {
      t: 7,
      kind: 'fire',
      side: 'p1',
      coord: { row: 9, col: 9 },
      outcome: { result: ShotResult.Miss, coordinate: { row: 9, col: 9 } },
    };
    expect(event.outcome.result).toBe(ShotResult.Miss);
  });

  it('supports an ability event for each AbilityType', () => {
    const abilityTypes = Object.values(AbilityType);
    expect(abilityTypes.length).toBeGreaterThan(0);

    for (const ability of abilityTypes) {
      const event: ReplayEvent = {
        t: 20,
        kind: 'ability',
        side: 'p1',
        ability,
        coord: { row: 0, col: 0 },
      };
      expect(event.kind).toBe('ability');
      expect(event.ability).toBe(ability);
    }
  });

  it('supports a turn event', () => {
    const event: ReplayEvent = { t: 3, kind: 'turn', turn: 2 };
    expect(event.kind).toBe('turn');
    expect(event.turn).toBe(2);
  });

  it('supports an end event with p1 winner', () => {
    const event: ReplayEvent = { t: 99, kind: 'end', winnerSide: 'p1' };
    expect(event.kind).toBe('end');
    expect(event.winnerSide).toBe('p1');
  });

  it('supports an end event with p2 winner', () => {
    const event: ReplayEvent = { t: 100, kind: 'end', winnerSide: 'p2' };
    expect(event.winnerSide).toBe('p2');
  });

  it('t field records a timestamp for every event kind', () => {
    const events: ReplayEvent[] = [
      { t: 1000, kind: 'placement', side: 'p1', placements: [] },
      { t: 2000, kind: 'fire', side: 'p1', coord: { row: 0, col: 0 }, outcome: { result: ShotResult.Miss, coordinate: { row: 0, col: 0 } } },
      { t: 3000, kind: 'ability', side: 'p1', ability: AbilityType.SonarPing, coord: { row: 5, col: 5 } },
      { t: 4000, kind: 'turn', turn: 3 },
      { t: 5000, kind: 'end', winnerSide: 'p2' },
    ];
    for (const e of events) {
      expect(typeof e.t).toBe('number');
      expect(e.t).toBeGreaterThan(0);
    }
  });
});

describe('ReplayData structure', () => {
  const makeReplay = (): ReplayData => ({
    version: 1,
    matchId: 'match-abc-123',
    p1: { id: 'player-1', username: 'Ironbeard' },
    p2: { id: 'player-2', username: 'Blackheart' },
    mode: 'ranked',
    startedAt: 1713000000000,
    events: [],
  });

  it('can be constructed with required fields', () => {
    const replay = makeReplay();
    expect(replay.version).toBe(1);
    expect(replay.matchId).toBe('match-abc-123');
    expect(replay.p1.username).toBe('Ironbeard');
    expect(replay.p2.username).toBe('Blackheart');
    expect(replay.mode).toBe('ranked');
    expect(replay.startedAt).toBe(1713000000000);
    expect(replay.events).toEqual([]);
  });

  it('can be JSON serialized and deserialized without data loss', () => {
    const replay = makeReplay();
    replay.events.push(
      { t: 100, kind: 'placement', side: 'p1', placements: [{ type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal }] },
      { t: 200, kind: 'fire', side: 'p1', coord: { row: 5, col: 5 }, outcome: { result: ShotResult.Hit, coordinate: { row: 5, col: 5 } } },
      { t: 300, kind: 'turn', turn: 1 },
      { t: 400, kind: 'end', winnerSide: 'p1' }
    );

    const serialized = JSON.stringify(replay);
    const parsed: ReplayData = JSON.parse(serialized);

    expect(parsed.version).toBe(1);
    expect(parsed.matchId).toBe('match-abc-123');
    expect(parsed.events).toHaveLength(4);
    expect(parsed.events[0].kind).toBe('placement');
    expect(parsed.events[3].kind).toBe('end');
  });

  it('holds up to MAX_REPLAY_EVENTS entries', () => {
    const replay = makeReplay();
    for (let i = 0; i < MAX_REPLAY_EVENTS; i++) {
      replay.events.push({ t: i, kind: 'turn', turn: i });
    }
    expect(replay.events).toHaveLength(MAX_REPLAY_EVENTS);
  });

  it('version field is always 1', () => {
    const replay = makeReplay();
    expect(replay.version).toBe(1);
  });

  it('supports non-empty events array with mixed kinds', () => {
    const replay = makeReplay();
    replay.events.push(
      { t: 0, kind: 'placement', side: 'p1', placements: [] },
      { t: 1, kind: 'placement', side: 'p2', placements: [] },
      { t: 2, kind: 'ability', side: 'p1', ability: AbilityType.CannonBarrage, coord: { row: 3, col: 3 } },
      { t: 3, kind: 'fire', side: 'p1', coord: { row: 3, col: 3 }, outcome: { result: ShotResult.Hit, coordinate: { row: 3, col: 3 } } },
      { t: 4, kind: 'end', winnerSide: 'p2' }
    );

    const kinds = replay.events.map((e) => e.kind);
    expect(kinds).toContain('placement');
    expect(kinds).toContain('ability');
    expect(kinds).toContain('fire');
    expect(kinds).toContain('end');
  });
});

describe('ReplaySide type', () => {
  it('accepts only p1 and p2 as valid sides', () => {
    const sides: ReplaySide[] = ['p1', 'p2'];
    expect(sides).toContain('p1');
    expect(sides).toContain('p2');
    expect(sides).toHaveLength(2);
  });
});
