/**
 * TASK-052: Scripted play-to-completion tests via rooms.ts.
 * Drives createRoom/joinRoom/placeShips/fireShot/useAbility directly,
 * covering the full ability→trait→stale-fix pipeline.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  placeShips,
  fireShot,
  useAbility,
  deleteRoom,
  type GameRoom,
  type RoomPlayer,
} from '../services/rooms.ts';
import {
  AbilityType,
  canUseAbility,
} from '../../../shared/src/abilities.ts';
import { ShipType, Orientation, GamePhase, ShotResult, CellState, coordKey } from '../../../shared/src/types.ts';
import type { ShipPlacement } from '../../../shared/src/types.ts';

// ─── Standard placements ──────────────────────────────────────────────────────

const STANDARD_PLACEMENTS: ShipPlacement[] = [
  { type: ShipType.Carrier,    start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Cruiser,    start: { row: 2, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Submarine,  start: { row: 3, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Destroyer,  start: { row: 4, col: 0 }, orientation: Orientation.Horizontal },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(
  id: string,
  abilities: AbilityType[] = []
): Omit<RoomPlayer, 'abilities' | 'traits' | 'hasPlaced' | 'isConnected'> {
  return {
    id,
    username: `user_${id}`,
    rating: 1500,
    socketId: `socket_${id}`,
    selectedAbilities: abilities,
  };
}

/** Create a room with both players placed and game started. */
function createPlayingRoom(
  p1Abilities: AbilityType[] = [],
  p2Abilities: AbilityType[] = []
): GameRoom {
  const room = createRoom(makePlayer('p1', p1Abilities), false, false);
  joinRoom(room, makePlayer('p2', p2Abilities));
  placeShips(room, 'p1', STANDARD_PLACEMENTS);
  placeShips(room, 'p2', STANDARD_PLACEMENTS);
  return room;
}

// ─── fireShot trait pipeline ──────────────────────────────────────────────────

describe('fireShot — Ironclad trait pipeline', () => {
  it('negates first Battleship hit; cell returns to Ship (re-targetable)', () => {
    const room = createPlayingRoom();
    // P1 fires at P2's Battleship at (1,0) — Ironclad should negate
    const outcome = fireShot(room, 'p1', { row: 1, col: 0 });
    expect(outcome).not.toBeNull();
    expect(outcome!.result).toBe(ShotResult.Miss); // Ironclad negated the hit
    // Cell re-targetable: grid shows Ship, not Hit
    expect(room.engine.opponentBoard.grid[1][0]).toBe(CellState.Ship);
    // P2's Battleship has no registered hits
    const battleship = room.engine.opponentBoard.ships.find(s => s.type === ShipType.Battleship)!;
    expect(battleship.hits.size).toBe(0);
    // Turn forced to opponent after Ironclad negation
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });

  it('second Battleship hit registers normally after Ironclad is consumed', () => {
    const room = createPlayingRoom();

    // First hit: Ironclad negates → outcome=Miss, turn=opponent
    const outcome1 = fireShot(room, 'p1', { row: 1, col: 0 });
    expect(outcome1!.result).toBe(ShotResult.Miss);

    // P2 fires miss so turn returns to P1
    fireShot(room, 'p2', { row: 9, col: 9 });
    expect(room.engine.currentTurn).toBe('player');

    // P1 fires at (1,0) again — Ironclad already used, normal Hit
    const outcome2 = fireShot(room, 'p1', { row: 1, col: 0 });
    expect(outcome2).not.toBeNull();
    expect(outcome2!.result).toBe(ShotResult.Hit);

    const battleship = room.engine.opponentBoard.ships.find(s => s.type === ShipType.Battleship)!;
    expect(battleship.hits.size).toBe(1);
    deleteRoom(room.id);
  });

  it('Ironclad negation does not credit a hit for accuracy', () => {
    const room = createPlayingRoom();

    fireShot(room, 'p1', { row: 1, col: 0 }); // Ironclad negates → outcome=Miss

    expect(room.engine.totalPlayerActions).toBe(1);
    expect(room.engine.totalPlayerHits).toBe(0); // not credited
    deleteRoom(room.id);
  });

  it('Ironclad negation sets outcome.deflected=true so the client can render ricochet feedback', () => {
    const room = createPlayingRoom();
    const outcome = fireShot(room, 'p1', { row: 1, col: 0 });
    expect(outcome).not.toBeNull();
    expect(outcome!.deflected).toBe(true);
    expect(outcome!.result).toBe(ShotResult.Miss);
    deleteRoom(room.id);
  });
});

// Nimble removed as a no-op trait; ship cells adjacent to the Destroyer
// are now normal targets (covered by sinkability tests).

// ─── useAbility pipeline — all 7 abilities ────────────────────────────────────

describe('useAbility — CannonBarrage', () => {
  it('fires 2×2 area; ok=true; turn switches to opponent', () => {
    const room = createPlayingRoom([AbilityType.CannonBarrage]);
    // P2's Carrier at (0,0)-(0,4)
    const result = useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 0, col: 0 });
    expect(result.ok).toBe(true);
    // Area (0,0),(0,1),(1,0),(1,1) fired
    expect(room.engine.opponentBoard.grid[0][0]).toBe(CellState.Hit); // Carrier
    expect(room.engine.opponentBoard.grid[0][1]).toBe(CellState.Hit); // Carrier
    expect(room.engine.opponentBoard.grid[1][0]).toBe(CellState.Ship); // Ironclad negated!
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });

  it('CannonBarrage with Ironclad: first Battleship hit negated; grid re-targetable', () => {
    const room = createPlayingRoom([AbilityType.CannonBarrage]);
    // CannonBarrage at (1,0): fires (1,0),(1,1),(2,0),(2,1)
    // P2's Battleship at (1,0)-(1,3); P2 has Ironclad (Battleship armor)
    useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 1, col: 0 });

    const p2Battleship = room.engine.opponentBoard.ships.find(s => s.type === ShipType.Battleship)!;
    // (1,0) negated by Ironclad → grid back to Ship; only (1,1) registers as hit
    expect(room.engine.opponentBoard.grid[1][0]).toBe(CellState.Ship);
    expect(p2Battleship.hits.size).toBe(1);
    expect(p2Battleship.hits.has(coordKey({ row: 1, col: 1 }))).toBe(true);
    // Cruiser at (2,0)-(2,2): (2,0) and (2,1) hit
    const p2Cruiser = room.engine.opponentBoard.ships.find(s => s.type === ShipType.Cruiser)!;
    expect(p2Cruiser.hits.size).toBe(2);
    deleteRoom(room.id);
  });

  it('CannonBarrage sinks last ship; game ends with phase=Finished', () => {
    const room = createPlayingRoom([AbilityType.CannonBarrage]);
    // Pre-sink all P2 ships except Destroyer via direct board calls (avoids Nimble)
    const oppBoard = room.engine.opponentBoard;
    for (const ship of oppBoard.ships) {
      if (ship.type === ShipType.Destroyer) continue;
      for (const cell of ship.cells) {
        oppBoard.receiveShot(cell);
      }
    }
    expect(oppBoard.allShipsSunk()).toBe(false);

    // P1 uses CannonBarrage at (4,0): hits Destroyer at (4,0) and (4,1)
    const result = useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 4, col: 0 });
    expect(result.ok).toBe(true);
    expect(room.engine.phase).toBe(GamePhase.Finished);
    expect(room.engine.winner).toBe('player');
    expect(room.endedAt).toBeDefined();
    deleteRoom(room.id);
  });
});

describe('useAbility — SonarPing', () => {
  it('detects ship in area; sonarShipDetected=true; turn switches', () => {
    const room = createPlayingRoom([AbilityType.SonarPing]);
    // Carrier at (0,0)-(0,4) — center (0,0) should detect it
    const result = useAbility(room, 'p1', AbilityType.SonarPing, { row: 0, col: 0 });
    expect(result.ok).toBe(true);
    expect(result.sonarShipDetected).toBe(true);
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });

  it('detects no ship in empty area; sonarShipDetected=false', () => {
    const room = createPlayingRoom([AbilityType.SonarPing]);
    // Row 8-9 area has no ships (standard placement rows 0-4)
    const result = useAbility(room, 'p1', AbilityType.SonarPing, { row: 8, col: 8 });
    expect(result.ok).toBe(true);
    expect(result.sonarShipDetected).toBe(false);
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });
});

describe('useAbility — SmokeScreen', () => {
  it('ok=true; turn switches to opponent', () => {
    const room = createPlayingRoom([AbilityType.SmokeScreen]);
    const result = useAbility(room, 'p1', AbilityType.SmokeScreen, { row: 5, col: 5 });
    expect(result.ok).toBe(true);
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });
});

describe('useAbility — RepairKit', () => {
  it('repairs a hit on own board; ok=true; turn switches', () => {
    const room = createPlayingRoom([AbilityType.RepairKit]);
    // Pre-hit P1's Carrier at (0,0) via direct board call
    room.engine.playerBoard.receiveShot({ row: 0, col: 0 });
    const carrier = room.engine.playerBoard.ships.find(s => s.type === ShipType.Carrier)!;
    expect(carrier.hits.size).toBe(1);

    const result = useAbility(room, 'p1', AbilityType.RepairKit, { row: 0, col: 0 });
    expect(result.ok).toBe(true);
    expect(carrier.hits.size).toBe(0); // repaired
    expect(room.engine.playerBoard.grid[0][0]).toBe(CellState.Ship); // restored
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });

  it('RepairKit fails on non-hit cell; ok=false', () => {
    const room = createPlayingRoom([AbilityType.RepairKit]);
    // (0,0) not hit — RepairKit cannot repair
    const result = useAbility(room, 'p1', AbilityType.RepairKit, { row: 0, col: 0 });
    expect(result.ok).toBe(false);
    expect(room.engine.currentTurn).toBe('player'); // turn did not switch
    deleteRoom(room.id);
  });
});

describe('useAbility — ChainShot', () => {
  it('fires 1×3 horizontal line; ok=true; turn switches', () => {
    const room = createPlayingRoom([AbilityType.ChainShot]);
    // ChainShot at (0,0): fires (0,0),(0,1),(0,2) — all Carrier cells
    const result = useAbility(room, 'p1', AbilityType.ChainShot, { row: 0, col: 0 });
    expect(result.ok).toBe(true);
    expect(room.engine.opponentBoard.grid[0][0]).toBe(CellState.Hit);
    expect(room.engine.opponentBoard.grid[0][1]).toBe(CellState.Hit);
    expect(room.engine.opponentBoard.grid[0][2]).toBe(CellState.Hit);
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });

  it('ChainShot on Submarine cells adjacent to Destroyer: all hits register, Submarine sinks', () => {
    // Regression: previously (3,0) and (3,1) were in the Nimble set (both
    // Submarine cells adjacent to Destroyer), causing ChainShot to revert
    // them and leaving the Submarine partially unsinkable. Post-fix, Nimble
    // only protects empty water, so all three ChainShot hits land and the
    // Submarine sinks.
    const room = createPlayingRoom([AbilityType.ChainShot]);
    useAbility(room, 'p1', AbilityType.ChainShot, { row: 3, col: 0 });

    const submarine = room.engine.opponentBoard.ships.find(s => s.type === ShipType.Submarine)!;
    expect(room.engine.opponentBoard.grid[3][0]).toBe(CellState.Hit);
    expect(room.engine.opponentBoard.grid[3][1]).toBe(CellState.Hit);
    expect(room.engine.opponentBoard.grid[3][2]).toBe(CellState.Hit);
    expect(submarine.hits.size).toBe(submarine.cells.length);
    expect(room.engine.phase).toBe(GamePhase.Playing);
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });
});

describe('useAbility — Spyglass', () => {
  it('fires one shot; ok=true; turn switches', () => {
    const room = createPlayingRoom([AbilityType.Spyglass]);
    // Spyglass at (0,0): fires and reports row ship count
    const result = useAbility(room, 'p1', AbilityType.Spyglass, { row: 0, col: 0 });
    expect(result.ok).toBe(true);
    expect(room.engine.opponentBoard.grid[0][0]).toBe(CellState.Hit); // shot fired
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });
});

describe('useAbility — BoardingParty', () => {
  it('returns ok=true; turn switches; scouted cell remains Ship', () => {
    const room = createPlayingRoom([AbilityType.BoardingParty]);
    // BoardingParty at (1,0): Battleship cell — stealth intel, no shot fired
    const result = useAbility(room, 'p1', AbilityType.BoardingParty, { row: 1, col: 0 });
    expect(result.ok).toBe(true);
    // Cell (1,0) remains Ship — no shot fired
    expect(room.engine.opponentBoard.grid[1][0]).toBe(CellState.Ship);
    expect(room.engine.currentTurn).toBe('opponent');
    deleteRoom(room.id);
  });

  it('BoardingParty on empty cell: ok=true; ability consumed; cell untouched', () => {
    const room = createPlayingRoom([AbilityType.BoardingParty]);
    const result = useAbility(room, 'p1', AbilityType.BoardingParty, { row: 9, col: 9 });
    expect(result.ok).toBe(true);
    expect(room.engine.opponentBoard.grid[9][9]).toBe(CellState.Empty); // untouched
    // Ability consumed (usesRemaining = 0)
    const p1Abilities = room.players[0]!.abilities!;
    expect(canUseAbility(p1Abilities, AbilityType.BoardingParty)).toBe(false);
    deleteRoom(room.id);
  });
});

// ─── Ability cooldown enforcement via rooms ───────────────────────────────────

describe('Ability cooldown enforcement via rooms', () => {
  it('CannonBarrage cannot be used immediately after use (on cooldown)', () => {
    const room = createPlayingRoom([AbilityType.CannonBarrage]);

    // P1 uses CannonBarrage — succeeds
    const r1 = useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 8, col: 8 });
    expect(r1.ok).toBe(true);

    // Turn now on P2; P2 fires miss → turn back to P1
    fireShot(room, 'p2', { row: 9, col: 9 });
    expect(room.engine.currentTurn).toBe('player');

    // P1 tries CannonBarrage again → on cooldown → ok=false
    const r2 = useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 8, col: 8 });
    expect(r2.ok).toBe(false);
    deleteRoom(room.id);
  });

  it('CannonBarrage available again after 3 P1 fireShots tick cooldown to 0', () => {
    const room = createPlayingRoom([AbilityType.CannonBarrage]);
    const p1Abilities = room.players[0]!.abilities!;

    // P1 uses CannonBarrage → cooldown=3, turn=opponent
    useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 8, col: 8 });
    expect(canUseAbility(p1Abilities, AbilityType.CannonBarrage)).toBe(false);

    // 3 rounds of P2-miss → P1-miss to tick P1's cooldown down
    for (let i = 0; i < 3; i++) {
      fireShot(room, 'p2', { row: 9, col: i });     // P2 miss → P1's turn
      fireShot(room, 'p1', { row: 9, col: i + 3 }); // P1 miss → tick P1 CD; P2's turn
    }

    // After 3 P1 fires: CD ticked from 3→0
    expect(canUseAbility(p1Abilities, AbilityType.CannonBarrage)).toBe(true);
    deleteRoom(room.id);
  });
});

// ─── Full match to completion via rooms ───────────────────────────────────────

describe('Full match to completion via rooms', () => {
  it('P1 wins by sinking all P2 ships via sequential fireShots (no Nimble workaround)', () => {
    // Regression for the "Nimble locks other-ship cells" bug: with the fix,
    // all Submarine cells adjacent to the Destroyer are hittable, so no
    // workaround is needed and the game reaches Finished cleanly.
    const room = createPlayingRoom();

    // Carrier (0,0)-(0,4) — 5 hits, consecutive turns (no Ironclad, no Nimble here)
    for (let c = 0; c < 5; c++) fireShot(room, 'p1', { row: 0, col: c });

    // Battleship (1,0)-(1,3): first hit at (1,0) is Ironclad-deflected and
    // switches the turn to P2. P2 fires a miss, then P1 fires (1,0) again
    // (Ironclad consumed) and the remaining three cells.
    const deflected = fireShot(room, 'p1', { row: 1, col: 0 });
    expect(deflected!.deflected).toBe(true);
    expect(room.engine.opponentBoard.grid[1][0]).toBe(CellState.Ship); // re-targetable
    expect(room.engine.currentTurn).toBe('opponent');

    fireShot(room, 'p2', { row: 9, col: 9 }); // P2 miss → back to P1

    // Now fire through the rest of the Battleship
    for (let c = 0; c < 4; c++) fireShot(room, 'p1', { row: 1, col: c });

    // Cruiser (2,0)-(2,2)
    for (let c = 0; c < 3; c++) fireShot(room, 'p1', { row: 2, col: c });

    // Submarine (3,0)-(3,2) — (3,0) and (3,1) were previously Nimble-locked;
    // post-fix they are hittable and the sub sinks normally.
    for (let c = 0; c < 3; c++) fireShot(room, 'p1', { row: 3, col: c });

    // Destroyer (4,0)-(4,1) — final ship; sinking triggers Finished.
    fireShot(room, 'p1', { row: 4, col: 0 });
    fireShot(room, 'p1', { row: 4, col: 1 });

    expect(room.engine.opponentBoard.allShipsSunk()).toBe(true);
    expect(room.engine.phase).toBe(GamePhase.Finished);
    expect(room.engine.winner).toBe('player');
    deleteRoom(room.id);
  });

  it('P1 wins via CannonBarrage clearing the final ship; endedAt set', () => {
    const room = createPlayingRoom([AbilityType.CannonBarrage]);

    // Pre-sink all P2 ships except Destroyer via direct board calls
    const oppBoard = room.engine.opponentBoard;
    for (const ship of oppBoard.ships) {
      if (ship.type === ShipType.Destroyer) continue;
      for (const cell of ship.cells) {
        oppBoard.receiveShot(cell);
      }
    }
    expect(oppBoard.allShipsSunk()).toBe(false);
    expect(room.engine.phase).toBe(GamePhase.Playing);

    // P1 uses CannonBarrage at (4,0) — hits Destroyer at (4,0) and (4,1)
    const result = useAbility(room, 'p1', AbilityType.CannonBarrage, { row: 4, col: 0 });
    expect(result.ok).toBe(true);
    expect(oppBoard.allShipsSunk()).toBe(true);
    expect(room.engine.phase).toBe(GamePhase.Finished);
    expect(room.engine.winner).toBe('player');
    expect(room.endedAt).toBeDefined();
    deleteRoom(room.id);
  });
});
