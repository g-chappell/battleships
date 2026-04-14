/**
 * Property-based fuzz tests for GameEngine.
 *
 * Uses a seeded pseudo-random number generator (Mulberry32) so any failing
 * seed is reproducible: copy the failing `seed=N` from the test name and
 * pass it directly to `runFuzzIteration(N)` to debug.
 *
 * Verified invariants:
 *   1. ship.hits.size <= ship.cells.length  (no phantom hits)
 *   2. ship is sunk iff ALL cells are in hits  (consistent sink detection)
 *   3. turnCount is monotonically non-decreasing  (no time travel)
 *   4. a cell rejected by isValidTarget is never re-targeted  (no double shots)
 *   5. board.grid[r][c] === Hit iff coordKey({r,c}) ∈ ship.hits  (grid/hits in sync)
 *
 * Test timeouts are set explicitly because 1000+ game iterations exceed Vitest's
 * default 5-second timeout. Individual tests declare their own timeout as the
 * last argument to `it()`.
 */

import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { randomPlacement } from '../AI';
import {
  CellState,
  ShotResult,
  GamePhase,
  GRID_SIZE,
  coordKey,
  type Coordinate,
} from '../types';
import type { Board } from '../Board';

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32 algorithm)
// Deterministic, no external dependency, high quality output.
// ---------------------------------------------------------------------------
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using the provided RNG */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** All 100 board coordinates (row-major order) */
const ALL_COORDS: Coordinate[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
  row: Math.floor(i / GRID_SIZE),
  col: i % GRID_SIZE,
}));

/**
 * Create a started game with random ship placements driven by `rng`.
 * Temporarily replaces Math.random so randomPlacement() is deterministic.
 */
function makeGame(rng: () => number): GameEngine {
  const origRandom = Math.random;
  Math.random = rng;
  const playerPlacements = randomPlacement();
  const opponentPlacements = randomPlacement();
  Math.random = origRandom;

  const engine = new GameEngine();
  for (const p of playerPlacements) engine.placePlayerShip(p);
  for (const p of opponentPlacements) engine.placeOpponentShip(p);
  expect(engine.startGame(), 'game must start successfully').toBe(true);
  return engine;
}

// ---------------------------------------------------------------------------
// Board invariant checker (invariants 1, 2, 5)
// Throws via expect() on any violation.
// ---------------------------------------------------------------------------
function assertBoardInvariants(board: Board, label: string): void {
  for (const ship of board.ships) {
    // Invariant 1: no phantom hits
    expect(
      ship.hits.size,
      `${label} [${ship.type}]: hits.size ${ship.hits.size} <= cells.length ${ship.cells.length}`
    ).toBeLessThanOrEqual(ship.cells.length);

    // Invariant 2: sunk iff every cell is in hits
    const allCellsHit = ship.cells.every(c => ship.hits.has(coordKey(c)));
    expect(
      allCellsHit,
      `${label} [${ship.type}]: allCellsHit must equal (hits.size === cells.length)`
    ).toBe(ship.hits.size === ship.cells.length);

    // Invariant 5: grid[r][c] === Hit iff coordKey(c) ∈ ship.hits
    for (const c of ship.cells) {
      const key = coordKey(c);
      const inHits = ship.hits.has(key);
      const gridState = board.grid[c.row][c.col];
      if (inHits) {
        expect(
          gridState,
          `${label} [${ship.type}] (${c.row},${c.col}) in hits → grid must be Hit`
        ).toBe(CellState.Hit);
      } else {
        expect(
          gridState,
          `${label} [${ship.type}] (${c.row},${c.col}) not in hits → grid must be Ship`
        ).toBe(CellState.Ship);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lightweight game runner — drives a game to completion using randomized shots
// Returns true if the game finished normally.
// ---------------------------------------------------------------------------
function playGame(
  engine: GameEngine,
  rng: () => number,
  onAfterShot?: (engine: GameEngine, firedCoord: Coordinate, side: 'player' | 'opponent') => void
): boolean {
  const playerTargets = shuffle([...ALL_COORDS], rng);
  const opponentTargets = shuffle([...ALL_COORDS], rng);
  let pi = 0, oi = 0;

  while (engine.phase === GamePhase.Playing) {
    if (engine.currentTurn === 'player') {
      while (pi < playerTargets.length && !engine.opponentBoard.isValidTarget(playerTargets[pi])) pi++;
      if (pi >= playerTargets.length) return false;
      const coord = playerTargets[pi++];
      engine.playerShoot(coord);
      onAfterShot?.(engine, coord, 'player');
    } else {
      while (oi < opponentTargets.length && !engine.playerBoard.isValidTarget(opponentTargets[oi])) oi++;
      if (oi >= opponentTargets.length) return false;
      const coord = opponentTargets[oi++];
      engine.opponentShoot(coord);
      onAfterShot?.(engine, coord, 'opponent');
    }
  }
  return engine.phase === GamePhase.Finished;
}

// ---------------------------------------------------------------------------
// Core fuzz iteration used by the main 1000-game suite.
//
// Checks per-step: turnCount monotonicity, isValidTarget, shotHistory growth.
// Checks at game-end: full board invariants (1, 2, 5) on both boards.
// This split keeps the test fast enough to run 1000 games in CI.
// ---------------------------------------------------------------------------
function runFuzzIteration(seed: number): void {
  const rng = makePrng(seed);
  const engine = makeGame(rng);

  const playerTargets = shuffle([...ALL_COORDS], rng);
  const opponentTargets = shuffle([...ALL_COORDS], rng);
  let pi = 0, oi = 0;

  const playerFiredAt = new Set<string>();
  const opponentFiredAt = new Set<string>();
  let prevTurnCount = engine.turnCount; // starts at 1 after startGame()

  while (engine.phase === GamePhase.Playing) {
    if (engine.currentTurn === 'player') {
      while (pi < playerTargets.length && !engine.opponentBoard.isValidTarget(playerTargets[pi])) pi++;
      if (pi >= playerTargets.length) break;

      const coord = playerTargets[pi++];
      const key = coordKey(coord);

      // Invariant 4: must not re-fire a cell
      if (playerFiredAt.has(key)) {
        throw new Error(`seed=${seed}: player double-targeted cell ${key}`);
      }

      const prevLen = engine.shotHistory.length;
      engine.playerShoot(coord);
      playerFiredAt.add(key);

      // shotHistory grows by 1
      if (engine.shotHistory.length !== prevLen + 1) {
        throw new Error(`seed=${seed}: shotHistory did not grow after player shot`);
      }
      // Invariant 4: cell no longer valid after shot
      if (engine.opponentBoard.isValidTarget(coord)) {
        throw new Error(`seed=${seed}: player-targeted cell ${key} still valid after shot`);
      }
      // Invariant 3: turnCount stable during player's turn
      if (engine.turnCount !== prevTurnCount) {
        throw new Error(`seed=${seed}: turnCount changed during player turn`);
      }

    } else {
      while (oi < opponentTargets.length && !engine.playerBoard.isValidTarget(opponentTargets[oi])) oi++;
      if (oi >= opponentTargets.length) break;

      const coord = opponentTargets[oi++];
      const key = coordKey(coord);

      if (opponentFiredAt.has(key)) {
        throw new Error(`seed=${seed}: opponent double-targeted cell ${key}`);
      }

      const prevLen = engine.shotHistory.length;
      const outcome = engine.opponentShoot(coord);
      opponentFiredAt.add(key);

      if (engine.shotHistory.length !== prevLen + 1) {
        throw new Error(`seed=${seed}: shotHistory did not grow after opponent shot`);
      }
      if (engine.playerBoard.isValidTarget(coord)) {
        throw new Error(`seed=${seed}: opponent-targeted cell ${key} still valid after shot`);
      }

      // Invariant 3: turnCount increments only on opponent miss
      const expectedCount = outcome!.result === ShotResult.Miss ? prevTurnCount + 1 : prevTurnCount;
      if (engine.turnCount !== expectedCount) {
        throw new Error(
          `seed=${seed}: turnCount expected ${expectedCount}, got ${engine.turnCount} (result=${outcome!.result})`
        );
      }
      prevTurnCount = engine.turnCount;
    }
  }

  // Game must finish naturally
  if (engine.phase !== GamePhase.Finished) {
    throw new Error(`seed=${seed}: game did not reach Finished state`);
  }
  if (!engine.winner) {
    throw new Error(`seed=${seed}: game finished but winner is null`);
  }

  // Invariants 1, 2, 5: full board check at game end
  assertBoardInvariants(engine.opponentBoard, `seed=${seed} final opponentBoard`);
  assertBoardInvariants(engine.playerBoard, `seed=${seed} final playerBoard`);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('GameEngine property-based fuzz tests', () => {

  /**
   * Main suite: 1000 games, all 5 invariants verified.
   * Per-step checks use throw (not expect()) to avoid Vitest overhead on
   * millions of assertions. Board invariants (1/2/5) verified at game end.
   * Timeout: 300 s to accommodate CI runners slower than dev machines.
   */
  it(
    'all invariants hold across 1000 random games (seeds 0–999)',
    () => {
      for (let seed = 0; seed < 1000; seed++) {
        runFuzzIteration(seed);
      }
    },
    300_000 // 5 minutes — accommodates 1000 games with per-step checks
  );

  /**
   * Per-step board invariant checks on 50 games.
   * Calls assertBoardInvariants (using expect()) after every shot.
   * Smaller count keeps wall time under the 60-second timeout.
   */
  it(
    'board invariants hold after every shot in 50 games (seeds 1000–1049)',
    () => {
      for (let seed = 1000; seed < 1050; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);
        let stepCount = 0;

        playGame(engine, rng, (eng, _coord, side) => {
          stepCount++;
          assertBoardInvariants(
            side === 'player' ? eng.opponentBoard : eng.playerBoard,
            `seed=${seed} step=${stepCount} ${side === 'player' ? 'opponent' : 'player'}Board`
          );
        });

        expect(engine.phase, `seed=${seed}: game must finish`).toBe(GamePhase.Finished);
      }
    },
    60_000
  );

  describe('invariant 1 — ship.hits.size never exceeds ship cell count', () => {
    it('hits.size <= cells.length holds per-step in 100 games', () => {
      for (let seed = 2000; seed < 2100; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);

        playGame(engine, rng, (eng) => {
          for (const board of [eng.opponentBoard, eng.playerBoard]) {
            for (const ship of board.ships) {
              if (ship.hits.size > ship.cells.length) {
                throw new Error(
                  `seed=${seed}: ${ship.type} hits.size ${ship.hits.size} > cells.length ${ship.cells.length}`
                );
              }
            }
          }
        });
      }
    }, 30_000);
  });

  describe('invariant 2 — sunk iff all cells hit', () => {
    it('allShipsSunk() matches per-ship hit accounting in 100 games', () => {
      for (let seed = 3000; seed < 3100; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);

        playGame(engine, rng, (eng) => {
          for (const board of [eng.opponentBoard, eng.playerBoard]) {
            const manualAllSunk = board.ships.length > 0 &&
              board.ships.every(s => s.hits.size === s.cells.length);
            expect(board.allShipsSunk()).toBe(manualAllSunk);
          }
        });
      }
    }, 30_000);
  });

  describe('invariant 3 — turnCount monotonically non-decreasing', () => {
    it('turnCount never decreases across 100 games', () => {
      for (let seed = 4000; seed < 4100; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);
        let lastCount = engine.turnCount;

        playGame(engine, rng, (eng) => {
          if (eng.turnCount < lastCount) {
            throw new Error(`seed=${seed}: turnCount decreased from ${lastCount} to ${eng.turnCount}`);
          }
          lastCount = eng.turnCount;
        });

        // turnCount at end must be >= 1 (was 1 at game start)
        expect(engine.turnCount, `seed=${seed}: final turnCount must be >= 1`).toBeGreaterThanOrEqual(1);
      }
    }, 30_000);
  });

  describe('invariant 4 — cells cannot be targeted twice', () => {
    it('isValidTarget returns false for targeted cells in 50 games', () => {
      for (let seed = 5000; seed < 5050; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);
        const playerFired = new Set<string>();
        const opponentFired = new Set<string>();

        const playerTargets = shuffle([...ALL_COORDS], rng);
        const opponentTargets = shuffle([...ALL_COORDS], rng);
        let pi = 0, oi = 0;

        while (engine.phase === GamePhase.Playing) {
          if (engine.currentTurn === 'player') {
            while (pi < playerTargets.length && !engine.opponentBoard.isValidTarget(playerTargets[pi])) pi++;
            if (pi >= playerTargets.length) break;
            const coord = playerTargets[pi++];
            const key = coordKey(coord);

            // Must be valid before firing
            expect(engine.opponentBoard.isValidTarget(coord), `seed=${seed}: valid before player shot`).toBe(true);
            engine.playerShoot(coord);
            playerFired.add(key);
            // Must be invalid after firing
            expect(engine.opponentBoard.isValidTarget(coord), `seed=${seed}: invalid after player shot`).toBe(false);

          } else {
            while (oi < opponentTargets.length && !engine.playerBoard.isValidTarget(opponentTargets[oi])) oi++;
            if (oi >= opponentTargets.length) break;
            const coord = opponentTargets[oi++];
            const key = coordKey(coord);

            expect(engine.playerBoard.isValidTarget(coord), `seed=${seed}: valid before opponent shot`).toBe(true);
            engine.opponentShoot(coord);
            opponentFired.add(key);
            expect(engine.playerBoard.isValidTarget(coord), `seed=${seed}: invalid after opponent shot`).toBe(false);
          }
        }

        // Cross-check: every coord in the fired set must be invalid at game end
        for (const key of playerFired) {
          const [r, c] = key.split(',').map(Number);
          expect(
            engine.opponentBoard.isValidTarget({ row: r, col: c }),
            `seed=${seed}: fired cell ${key} must be invalid at game end`
          ).toBe(false);
        }
        for (const key of opponentFired) {
          const [r, c] = key.split(',').map(Number);
          expect(
            engine.playerBoard.isValidTarget({ row: r, col: c }),
            `seed=${seed}: fired cell ${key} must be invalid at game end`
          ).toBe(false);
        }
      }
    }, 30_000);
  });

  describe('invariant 5 — grid state consistent with ship.hits', () => {
    it('grid[r][c] === Hit iff coordKey ∈ ship.hits, per-step in 50 games', () => {
      for (let seed = 6000; seed < 6050; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);
        let stepCount = 0;

        playGame(engine, rng, (eng) => {
          stepCount++;
          for (const board of [eng.opponentBoard, eng.playerBoard]) {
            for (const ship of board.ships) {
              for (const c of ship.cells) {
                const key = coordKey(c);
                const inHits = ship.hits.has(key);
                const gridIsHit = board.grid[c.row][c.col] === CellState.Hit;
                if (inHits !== gridIsHit) {
                  throw new Error(
                    `seed=${seed} step=${stepCount}: ${ship.type} cell (${c.row},${c.col}) ` +
                    `inHits=${inHits} but gridIsHit=${gridIsHit}`
                  );
                }
              }
            }
          }
        });
      }
    }, 30_000);
  });

  describe('edge cases', () => {
    it('game with seed 0 terminates and winner is set', () => {
      const rng = makePrng(0);
      const engine = makeGame(rng);
      const finished = playGame(engine, rng);
      expect(finished).toBe(true);
      expect(engine.winner).not.toBeNull();
    });

    it('playerShotCount + opponentShotCount equals total shots recorded in shotHistory', () => {
      for (let seed = 7000; seed < 7020; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);
        playGame(engine, rng);
        expect(
          engine.playerShotCount + engine.opponentShotCount,
          `seed=${seed}: shot counts must sum to shotHistory length`
        ).toBe(engine.shotHistory.length);
      }
    });

    it('getPlayerShipsRemaining and getOpponentShipsRemaining are always 0–5', () => {
      for (let seed = 8000; seed < 8020; seed++) {
        const rng = makePrng(seed);
        const engine = makeGame(rng);

        playGame(engine, rng, (eng) => {
          const pr = eng.getPlayerShipsRemaining();
          const or = eng.getOpponentShipsRemaining();
          expect(pr).toBeGreaterThanOrEqual(0);
          expect(pr).toBeLessThanOrEqual(5);
          expect(or).toBeGreaterThanOrEqual(0);
          expect(or).toBeLessThanOrEqual(5);
        });

        // At game end, the losing side must have 0 ships remaining
        if (engine.winner === 'player') {
          expect(engine.getOpponentShipsRemaining()).toBe(0);
        } else {
          expect(engine.getPlayerShipsRemaining()).toBe(0);
        }
      }
    });
  });
});
