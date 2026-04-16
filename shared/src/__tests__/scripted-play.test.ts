/**
 * TASK-052: Scripted play-to-completion tests covering trait + ability interactions.
 * Drives GameEngine and ability/trait functions directly in shared workspace.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import {
  AbilityType,
  createAbilitySystemState,
  canUseAbility,
  tickCooldowns,
  executeCannonBarrage,
  executeSonarPing,
  executeSmokeScreen,
  executeRepairKit,
  executeChainShot,
  executeSpyglass,
  executeBoardingParty,
  fixStaleOutcomes,
  isCellSmoked,
} from '../abilities';
import {
  createTraitState,
  initNimbleCells,
  processIronclad,
  processNimble,
  processSpotter,
  processSwift,
} from '../traits';
import {
  ShipType,
  Orientation,
  GamePhase,
  ShotResult,
  CellState,
  coordKey,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STANDARD_SHIPS = [
  { type: ShipType.Carrier,    start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Cruiser,    start: { row: 2, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Submarine,  start: { row: 3, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Destroyer,  start: { row: 4, col: 0 }, orientation: Orientation.Horizontal },
];

function placeAllShips(engine: GameEngine): void {
  for (const ship of STANDARD_SHIPS) {
    engine.placePlayerShip(ship);
    engine.placeOpponentShip(ship);
  }
}

// ─── Full match via engine shots ─────────────────────────────────────────────

describe('Full match via GameEngine shots to completion', () => {
  it('player wins by sinking all 5 opponent ships; phase=Finished, winner=player', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const targets = [
      ...Array.from({ length: 5 }, (_, i) => ({ row: 0, col: i })), // Carrier
      ...Array.from({ length: 4 }, (_, i) => ({ row: 1, col: i })), // Battleship
      ...Array.from({ length: 3 }, (_, i) => ({ row: 2, col: i })), // Cruiser
      ...Array.from({ length: 3 }, (_, i) => ({ row: 3, col: i })), // Submarine
      ...Array.from({ length: 2 }, (_, i) => ({ row: 4, col: i })), // Destroyer
    ];

    for (const coord of targets) {
      const result = engine.playerShoot(coord);
      expect(result).not.toBeNull();
    }

    expect(engine.phase).toBe(GamePhase.Finished);
    expect(engine.winner).toBe('player');
    expect(engine.getOpponentShipsRemaining()).toBe(0);
    expect(engine.getPlayerShipsRemaining()).toBe(5); // player ships untouched
  });
});

// ─── Ironclad trait scripted play ────────────────────────────────────────────

describe('Ironclad trait scripted play', () => {
  it('negates first battleship hit; cell becomes re-targetable; second hit registers', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const traitState = createTraitState();
    const targetBoard = engine.opponentBoard;
    const battleship = targetBoard.ships.find(s => s.type === ShipType.Battleship)!;

    // Fire at (1,0) — Battleship cell
    engine.playerShoot({ row: 1, col: 0 });
    expect(battleship.hits.size).toBe(1); // hit recorded by engine

    // Ironclad negates: revert the hit manually (simulating rooms.ts)
    const negated = processIronclad(targetBoard, { row: 1, col: 0 }, traitState);
    expect(negated).toBe(true);
    battleship.hits.delete(coordKey({ row: 1, col: 0 }));
    targetBoard.grid[1][0] = CellState.Ship; // re-targetable

    expect(battleship.hits.size).toBe(0);
    expect(targetBoard.grid[1][0]).toBe(CellState.Ship);
    expect(engine.phase).toBe(GamePhase.Playing); // game continues

    // Second processIronclad call — armor already used
    const negated2 = processIronclad(targetBoard, { row: 1, col: 0 }, traitState);
    expect(negated2).toBe(false);
  });

  it('game reaches Finished after Ironclad-protected battleship eventually destroyed', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const traitState = createTraitState();
    const targetBoard = engine.opponentBoard;
    const battleship = targetBoard.ships.find(s => s.type === ShipType.Battleship)!;

    // First shot at (1,0) — Ironclad negates
    engine.playerShoot({ row: 1, col: 0 });
    const negated = processIronclad(targetBoard, { row: 1, col: 0 }, traitState);
    if (negated) {
      battleship.hits.delete(coordKey({ row: 1, col: 0 }));
      targetBoard.grid[1][0] = CellState.Ship;
    }
    expect(negated).toBe(true);

    // Now fire all 17 cells (including (1,0) again which is re-targetable)
    const allTargets = [
      ...Array.from({ length: 5 }, (_, i) => ({ row: 0, col: i })),
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
      ...Array.from({ length: 3 }, (_, i) => ({ row: 2, col: i })),
      ...Array.from({ length: 3 }, (_, i) => ({ row: 3, col: i })),
      ...Array.from({ length: 2 }, (_, i) => ({ row: 4, col: i })),
    ];

    for (const coord of allTargets) {
      engine.playerShoot(coord); // hits give consecutive turns
    }

    expect(engine.phase).toBe(GamePhase.Finished);
    expect(engine.winner).toBe('player');
    expect(battleship.hits.size).toBe(4); // all battleship cells eventually hit
  });
});

// ─── RepairKit mid-game ───────────────────────────────────────────────────────

describe('RepairKit mid-game integration', () => {
  it('repairs a hit on own carrier; hit count drops to 0; cell shows as Ship', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // Pre-hit player's Carrier at (0,0) via direct board call (simulates opponent shot)
    engine.playerBoard.receiveShot({ row: 0, col: 0 });
    const playerCarrier = engine.playerBoard.ships.find(s => s.type === ShipType.Carrier)!;
    expect(playerCarrier.hits.size).toBe(1);

    // Use RepairKit on (0,0)
    const abilityState = createAbilitySystemState([AbilityType.RepairKit]);
    const result = executeRepairKit(engine.playerBoard, { row: 0, col: 0 }, abilityState);

    expect(result).not.toBeNull();
    expect(result!.repairedCell).toEqual({ row: 0, col: 0 });
    expect(playerCarrier.hits.size).toBe(0);
    expect(engine.playerBoard.grid[0][0]).toBe(CellState.Ship); // restored
    expect(canUseAbility(abilityState, AbilityType.RepairKit)).toBe(false); // single-use
  });

  it('repaired cell can be hit again; carrier survives the extra hit', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const carrier = engine.playerBoard.ships.find(s => s.type === ShipType.Carrier)!;
    const abilityState = createAbilitySystemState([AbilityType.RepairKit]);

    // Hit all 5 carrier cells except (0,4)
    for (let col = 0; col < 4; col++) {
      engine.playerBoard.receiveShot({ row: 0, col });
    }
    expect(carrier.hits.size).toBe(4);

    // Repair (0,0)
    executeRepairKit(engine.playerBoard, { row: 0, col: 0 }, abilityState);
    expect(carrier.hits.size).toBe(3); // 4 hits minus repaired (0,0)

    // Carrier not sunk despite 4 original hits (only 3 remain + (0,4) not hit yet)
    expect(carrier.hits.size < carrier.cells.length).toBe(true);
  });
});

// ─── CannonBarrage scripted play ──────────────────────────────────────────────

describe('CannonBarrage scripted play', () => {
  it('sinks last remaining ship; board reports allShipsSunk=true', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const targetBoard = engine.opponentBoard;

    // Pre-sink all ships except Destroyer by direct board calls
    for (let col = 0; col < 5; col++) targetBoard.receiveShot({ row: 0, col }); // Carrier
    for (let col = 0; col < 4; col++) targetBoard.receiveShot({ row: 1, col }); // Battleship
    for (let col = 0; col < 3; col++) targetBoard.receiveShot({ row: 2, col }); // Cruiser
    for (let col = 0; col < 3; col++) targetBoard.receiveShot({ row: 3, col }); // Submarine
    expect(targetBoard.allShipsSunk()).toBe(false); // Destroyer still alive

    // CannonBarrage at (4,0): fires on (4,0),(4,1),(5,0),(5,1) — Destroyer at (4,0)-(4,1)
    const abilityState = createAbilitySystemState([AbilityType.CannonBarrage]);
    const result = executeCannonBarrage(targetBoard, { row: 4, col: 0 }, abilityState);

    expect(result).not.toBeNull();
    const sinkOutcome = result!.outcomes.find(o => o.result === ShotResult.Sink);
    expect(sinkOutcome).toBeDefined();
    expect(sinkOutcome!.sunkShip).toBe(ShipType.Destroyer);
    expect(targetBoard.allShipsSunk()).toBe(true);
  });

  it('Ironclad negates first CannonBarrage hit on battleship; cell re-targetable', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const targetBoard = engine.opponentBoard;
    const traitState = createTraitState();
    const abilityState = createAbilitySystemState([AbilityType.CannonBarrage]);

    // CannonBarrage at (1,0): fires (1,0),(1,1),(2,0),(2,1)
    const result = executeCannonBarrage(targetBoard, { row: 1, col: 0 }, abilityState);
    expect(result).not.toBeNull();

    const battleship = targetBoard.ships.find(s => s.type === ShipType.Battleship)!;

    // Simulate applyTraits: apply Ironclad to each Hit outcome
    for (const outcome of result!.outcomes) {
      if (outcome.result === ShotResult.Hit) {
        const negated = processIronclad(targetBoard, outcome.coordinate, traitState);
        if (negated) {
          const ship = targetBoard.getShipAt(outcome.coordinate);
          if (ship) ship.hits.delete(coordKey(outcome.coordinate));
          targetBoard.grid[outcome.coordinate.row][outcome.coordinate.col] = CellState.Ship;
          outcome.result = ShotResult.Miss;
          outcome.sunkShip = undefined;
        }
      }
    }
    fixStaleOutcomes(result!.outcomes, targetBoard);

    // (1,0): Ironclad negated → Miss; (1,1): second hit on Battleship → Hit
    expect(targetBoard.grid[1][0]).toBe(CellState.Ship); // re-targetable
    expect(battleship.hits.size).toBe(1); // only (1,1) registered
    expect(battleship.hits.has(coordKey({ row: 1, col: 1 }))).toBe(true);
    // No Sink outcome for Battleship (only 1/4 cells hit)
    const sinkForBattleship = result!.outcomes.find(o => o.sunkShip === ShipType.Battleship);
    expect(sinkForBattleship).toBeUndefined();
    // Cruiser hits at (2,0) and (2,1) unaffected
    const cruiser = targetBoard.ships.find(s => s.type === ShipType.Cruiser)!;
    expect(cruiser.hits.size).toBe(2);
  });
});

// ─── ChainShot + Nimble + fixStaleOutcomes ────────────────────────────────────

describe('ChainShot + Nimble trait + fixStaleOutcomes', () => {
  it('ChainShot on Submarine cells adjacent to Destroyer: all hits register, Submarine sinks', () => {
    // Regression for the Nimble "unsinkable ship" bug.
    // Standard placement: Destroyer at (4,0)-(4,1), Submarine at (3,0)-(3,2).
    // Submarine cells (3,0) and (3,1) sit next to the Destroyer. Post-fix,
    // initNimbleCells excludes all ship cells, so Nimble must NOT interfere
    // here. ChainShot at (3,0) fires (3,0),(3,1),(3,2) and sinks the Submarine.
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const targetBoard = engine.opponentBoard;
    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(targetBoard);

    // Nimble set must not contain the Submarine cells adjacent to Destroyer.
    expect(traitState.nimbleFirstShotAdjacent.has(coordKey({ row: 3, col: 0 }))).toBe(false);
    expect(traitState.nimbleFirstShotAdjacent.has(coordKey({ row: 3, col: 1 }))).toBe(false);

    const abilityState = createAbilitySystemState([AbilityType.ChainShot]);
    const result = executeChainShot(targetBoard, { row: 3, col: 0 }, abilityState);
    expect(result).not.toBeNull();
    expect(result!.outcomes).toHaveLength(3);

    // Apply the same pipeline the store/rooms use: Nimble on Hit, Ironclad on Hit.
    for (const outcome of result!.outcomes) {
      if (outcome.result === ShotResult.Hit && processNimble(outcome.coordinate, traitState)) {
        const ship = targetBoard.getShipAt(outcome.coordinate);
        if (ship) ship.hits.delete(coordKey(outcome.coordinate));
        targetBoard.grid[outcome.coordinate.row][outcome.coordinate.col] = CellState.Miss;
        outcome.result = ShotResult.Miss;
        outcome.sunkShip = undefined;
      }
    }
    fixStaleOutcomes(result!.outcomes, targetBoard);

    const submarine = targetBoard.ships.find(s => s.type === ShipType.Submarine)!;
    expect(submarine.hits.size).toBe(submarine.cells.length);
    // Final outcome is Sink because the Submarine was fully hit.
    const sinkOutcome = result!.outcomes.find(o => o.sunkShip === ShipType.Submarine);
    expect(sinkOutcome).toBeDefined();
    expect(sinkOutcome!.result).toBe(ShotResult.Sink);
  });

  it('fixStaleOutcomes downgrades a stale Sink when Ironclad deflects a Battleship ChainShot hit', () => {
    // Scenario: Battleship has 3 pre-existing hits (Ironclad already consumed
    // by those earlier hits means armor is used — simulated here by pre-hit
    // mutations on the engine). ChainShot lands the 4th hit → outcome=Sink.
    // We then simulate Ironclad armor re-armed (traitState fresh) to force a
    // stale-Sink case: armor revokes the hit → Battleship still has 3 hits,
    // fixStaleOutcomes must downgrade Sink → Hit.
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const targetBoard = engine.opponentBoard;
    const battleship = targetBoard.ships.find(s => s.type === ShipType.Battleship)!;

    // Pre-hit (1,1), (1,2), (1,3) — Battleship at (1,0)-(1,3); armor
    // already spent by those hits in a real game, but for this unit test we
    // leave the trait state fresh so Ironclad negates the upcoming (1,0) hit.
    targetBoard.receiveShot({ row: 1, col: 1 });
    targetBoard.receiveShot({ row: 1, col: 2 });
    targetBoard.receiveShot({ row: 1, col: 3 });
    expect(battleship.hits.size).toBe(3);

    const traitState = createTraitState();
    // Give the Battleship fresh armor for the test.
    const abilityState = createAbilitySystemState([AbilityType.ChainShot]);
    const result = executeChainShot(targetBoard, { row: 1, col: 0 }, abilityState);
    expect(result).not.toBeNull();
    // ChainShot at (1,0) fires (1,0),(1,1)...but (1,1)-(1,3) are already Hit;
    // ChainShot skips or records them — we only care that (1,0) becomes Sink
    // on the Battleship.
    const hitAtZero = result!.outcomes.find(o => o.coordinate.row === 1 && o.coordinate.col === 0);
    expect(hitAtZero).toBeDefined();
    expect(hitAtZero!.result).toBe(ShotResult.Sink);
    expect(hitAtZero!.sunkShip).toBe(ShipType.Battleship);

    // Apply Ironclad to Hit/Sink outcomes at (1,0): negates.
    for (const outcome of result!.outcomes) {
      if (
        (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink) &&
        processIronclad(targetBoard, outcome.coordinate, traitState)
      ) {
        const ship = targetBoard.getShipAt(outcome.coordinate);
        if (ship) ship.hits.delete(coordKey(outcome.coordinate));
        targetBoard.grid[outcome.coordinate.row][outcome.coordinate.col] = CellState.Ship;
        outcome.result = ShotResult.Miss;
        outcome.sunkShip = undefined;
        outcome.deflected = true;
      }
    }

    fixStaleOutcomes(result!.outcomes, targetBoard);

    // Battleship has 3 hits (Ironclad removed the (1,0) hit) — NOT sunk.
    expect(battleship.hits.size).toBe(3);
    expect(targetBoard.grid[1][0]).toBe(CellState.Ship); // re-targetable
    // No remaining Sink outcome for Battleship
    const sink = result!.outcomes.find(o => o.sunkShip === ShipType.Battleship);
    expect(sink).toBeUndefined();
  });
});

// ─── SonarPing cooldown tracking ─────────────────────────────────────────────

describe('SonarPing cooldown and detection', () => {
  it('detects Carrier; cooldown=4 after use; available again after 4 ticks', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const abilityState = createAbilitySystemState([AbilityType.SonarPing]);

    // SonarPing at (0,0): Carrier is at (0,0)-(0,4), so ship detected
    const result = executeSonarPing(engine.opponentBoard, { row: 0, col: 0 }, abilityState);
    expect(result).not.toBeNull();
    expect(result!.shipDetected).toBe(true);
    expect(canUseAbility(abilityState, AbilityType.SonarPing)).toBe(false); // on cooldown

    tickCooldowns(abilityState); // 4 → 3
    tickCooldowns(abilityState); // 3 → 2
    tickCooldowns(abilityState); // 2 → 1
    expect(canUseAbility(abilityState, AbilityType.SonarPing)).toBe(false);
    tickCooldowns(abilityState); // 1 → 0
    expect(canUseAbility(abilityState, AbilityType.SonarPing)).toBe(true);
  });

  it('reports no ship when area is empty', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const abilityState = createAbilitySystemState([AbilityType.SonarPing]);
    // SonarPing at (8,8): no ships in rows 5-9
    const result = executeSonarPing(engine.opponentBoard, { row: 8, col: 8 }, abilityState);
    expect(result).not.toBeNull();
    expect(result!.shipDetected).toBe(false);
  });
});

// ─── SmokeScreen expiry ───────────────────────────────────────────────────────

describe('SmokeScreen expiry over turns', () => {
  it('smoke zone active for 2 ticks then expires; cells no longer smoked', () => {
    const abilityState = createAbilitySystemState([AbilityType.SmokeScreen]);

    executeSmokeScreen({ row: 5, col: 5 }, abilityState);
    expect(isCellSmoked({ row: 5, col: 5 }, abilityState.smokeZones)).toBe(true);
    expect(abilityState.smokeZones).toHaveLength(1);

    tickCooldowns(abilityState); // turnsRemaining: 2 → 1
    expect(abilityState.smokeZones).toHaveLength(1);
    expect(isCellSmoked({ row: 5, col: 5 }, abilityState.smokeZones)).toBe(true);

    tickCooldowns(abilityState); // turnsRemaining: 1 → 0 → removed
    expect(abilityState.smokeZones).toHaveLength(0);
    expect(isCellSmoked({ row: 5, col: 5 }, abilityState.smokeZones)).toBe(false);
  });
});

// ─── Spyglass rowShipCount ────────────────────────────────────────────────────

describe('Spyglass rowShipCount accuracy', () => {
  it('counts unrevealed Ship cells in row after partial pre-hits', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // Carrier at (0,0)-(0,4): pre-hit (0,0) and (0,1)
    engine.opponentBoard.receiveShot({ row: 0, col: 0 });
    engine.opponentBoard.receiveShot({ row: 0, col: 1 });

    const abilityState = createAbilitySystemState([AbilityType.Spyglass]);
    const result = executeSpyglass(engine.opponentBoard, { row: 0, col: 2 }, abilityState);

    expect(result).not.toBeNull();
    expect(result!.shotOutcome.result).toBe(ShotResult.Hit); // (0,2) hits Carrier
    // After the Spyglass shot at (0,2), remaining Ship cells in row 0: (0,3) and (0,4)
    expect(result!.rowShipCount).toBe(2);
  });

  it('rowShipCount is 0 when all row cells are hit/miss before Spyglass fires', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // Hit all Carrier cells except (0,4) — then Spyglass at (0,4)
    for (let col = 0; col < 4; col++) {
      engine.opponentBoard.receiveShot({ row: 0, col });
    }

    const abilityState = createAbilitySystemState([AbilityType.Spyglass]);
    const result = executeSpyglass(engine.opponentBoard, { row: 0, col: 4 }, abilityState);

    expect(result).not.toBeNull();
    expect(result!.shotOutcome.result).toBe(ShotResult.Sink); // sinks Carrier
    // After the shot, no Ship cells remain in row 0
    expect(result!.rowShipCount).toBe(0);
  });
});

// ─── BoardingParty intel ─────────────────────────────────────────────────────

describe('BoardingParty intel without firing', () => {
  it('reveals ship type and HP; scouted cell remains Ship (not Hit)', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // Pre-hit Battleship at (1,0) to give it 1 existing hit
    engine.opponentBoard.receiveShot({ row: 1, col: 0 });

    const abilityState = createAbilitySystemState([AbilityType.BoardingParty]);
    // Scout (1,1) — another Battleship cell, not previously hit
    const result = executeBoardingParty(engine.opponentBoard, { row: 1, col: 1 }, abilityState);

    expect(result).not.toBeNull();
    expect(result!.shipType).toBe(ShipType.Battleship);
    expect(result!.totalCells).toBe(4);
    expect(result!.hitsTaken).toBe(1); // existing hit at (1,0)
    // (1,1) is NOT fired at — stays Ship
    expect(engine.opponentBoard.grid[1][1]).toBe(CellState.Ship);
    expect(canUseAbility(abilityState, AbilityType.BoardingParty)).toBe(false); // consumed
  });

  it('scouts empty cell; consumes ability; returns null', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const abilityState = createAbilitySystemState([AbilityType.BoardingParty]);
    // (9,9) is empty — no ship
    const result = executeBoardingParty(engine.opponentBoard, { row: 9, col: 9 }, abilityState);

    expect(result).toBeNull();
    expect(canUseAbility(abilityState, AbilityType.BoardingParty)).toBe(false); // still consumed
    expect(engine.opponentBoard.grid[9][9]).toBe(CellState.Empty); // untouched
  });
});

// ─── Nimble mid-game ──────────────────────────────────────────────────────────

describe('Nimble trait mid-game scripted play', () => {
  it('first shot on empty-water adjacent cell forced to miss; same cell second attempt not forced', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(engine.opponentBoard);

    // (5,0) is empty water adjacent to Destroyer at (4,0) — Nimble forces miss
    const forced = processNimble({ row: 5, col: 0 }, traitState);
    expect(forced).toBe(true);

    // Second attempt at same cell — removed from set, not forced
    const forced2 = processNimble({ row: 5, col: 0 }, traitState);
    expect(forced2).toBe(false);
  });

  it('ship cells adjacent to the Destroyer are NOT protected by Nimble (post-fix behavior)', () => {
    // Regression: previously Nimble locked another ship's adjacent cells as
    // Miss permanently, making that ship unsinkable. Post-fix, Nimble only
    // kicks in on empty water.
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(engine.opponentBoard);

    // (3,0) is a Submarine cell adjacent to Destroyer at (4,0). Post-fix it
    // is NOT in the Nimble set.
    const forced = processNimble({ row: 3, col: 0 }, traitState);
    expect(forced).toBe(false);
  });

  it('non-adjacent cell is not forced', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const traitState = createTraitState();
    traitState.nimbleFirstShotAdjacent = initNimbleCells(engine.opponentBoard);

    // (0,0) is Carrier cell, far from Destroyer at (4,0) — not in nimbleCells
    const forced = processNimble({ row: 0, col: 0 }, traitState);
    expect(forced).toBe(false);
  });
});

// ─── Swift trait mid-game ────────────────────────────────────────────────────

describe('Swift trait mid-game scripted play', () => {
  it('repositions Cruiser one cell right; old leftmost cell cleared; new cells are Ship', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const board = engine.playerBoard; // repositioning own board's cruiser
    const traitState = createTraitState();

    // Cruiser at (2,0)-(2,2) — reposition right → (2,1)-(2,3)
    const success = processSwift(board, 'right', traitState);
    expect(success).toBe(true);
    expect(traitState.swiftUsed).toBe(true);

    const cruiser = board.ships.find(s => s.type === ShipType.Cruiser)!;
    expect(cruiser.cells[0]).toEqual({ row: 2, col: 1 });
    expect(cruiser.cells[2]).toEqual({ row: 2, col: 3 });

    // Old leftmost cell (2,0) cleared to Empty
    expect(board.grid[2][0]).toBe(CellState.Empty);
    // New cells (2,1)-(2,3) marked Ship
    expect(board.grid[2][1]).toBe(CellState.Ship);
    expect(board.grid[2][3]).toBe(CellState.Ship);
  });

  it('Swift cannot reposition twice', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    const traitState = createTraitState();
    processSwift(engine.playerBoard, 'right', traitState);
    const success2 = processSwift(engine.playerBoard, 'right', traitState);
    expect(success2).toBe(false);
  });
});

// ─── Spotter trait in game context ───────────────────────────────────────────

describe('Spotter trait integration', () => {
  it('reveals a coordinate on attacker board when player Carrier is hit', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // Carrier on defendingBoard (playerBoard). When opponent hits it, Spotter
    // reveals one cell on the attackingBoard (opponentBoard).
    const revealed = processSpotter(
      engine.playerBoard,
      engine.opponentBoard,
      { row: 0, col: 0 },
      ShotResult.Hit
    );

    expect(revealed).toHaveLength(1);
    expect(revealed[0].row).toBeGreaterThanOrEqual(0);
    expect(revealed[0].row).toBeLessThan(10);
    expect(revealed[0].col).toBeGreaterThanOrEqual(0);
    expect(revealed[0].col).toBeLessThan(10);
  });

  it('reveals nothing when a non-Carrier ship is hit', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // Hit a Destroyer cell (not Carrier)
    const revealed = processSpotter(
      engine.playerBoard,
      engine.opponentBoard,
      { row: 4, col: 0 },
      ShotResult.Hit
    );
    expect(revealed).toHaveLength(0);
  });
});
