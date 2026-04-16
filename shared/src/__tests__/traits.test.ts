import { describe, it, expect } from 'vitest';
import { Board } from '../Board';
import {
  createTraitState,
  initNimbleCells,
  processIronclad,
  processSpotter,
  processNimble,
  processSwift,
} from '../traits';
import {
  ShipType,
  Orientation,
  ShotResult,
  coordKey,
} from '../types';

function placeShip(board: Board, type: ShipType, row: number, col: number, orientation: Orientation = Orientation.Horizontal) {
  board.placeShip({ type, start: { row, col }, orientation });
}

describe('Traits', () => {
  describe('Ironclad (Battleship)', () => {
    it('negates the first hit on the battleship', () => {
      const board = new Board();
      placeShip(board, ShipType.Battleship, 0, 0);
      const state = createTraitState();

      const negated = processIronclad(board, { row: 0, col: 0 }, state);
      expect(negated).toBe(true);
    });

    it('does not negate a second hit', () => {
      const board = new Board();
      placeShip(board, ShipType.Battleship, 0, 0);
      const state = createTraitState();

      processIronclad(board, { row: 0, col: 0 }, state);
      const negated2 = processIronclad(board, { row: 0, col: 1 }, state);
      expect(negated2).toBe(false);
    });

    it('does not trigger on non-battleship', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 0, 0);
      const state = createTraitState();

      const negated = processIronclad(board, { row: 0, col: 0 }, state);
      expect(negated).toBe(false);
    });
  });

  describe('Spotter (Carrier)', () => {
    it('reveals a cell when carrier is hit', () => {
      const defending = new Board();
      const attacking = new Board();
      placeShip(defending, ShipType.Carrier, 0, 0);
      placeShip(attacking, ShipType.Destroyer, 5, 5);

      const revealed = processSpotter(defending, attacking, { row: 0, col: 0 }, ShotResult.Hit);
      expect(revealed.length).toBe(1);
      expect(revealed[0].row).toBeGreaterThanOrEqual(0);
      expect(revealed[0].col).toBeGreaterThanOrEqual(0);
    });

    it('does not reveal on miss', () => {
      const defending = new Board();
      const attacking = new Board();
      placeShip(defending, ShipType.Carrier, 0, 0);

      const revealed = processSpotter(defending, attacking, { row: 5, col: 5 }, ShotResult.Miss);
      expect(revealed.length).toBe(0);
    });

    it('does not reveal when non-carrier is hit', () => {
      const defending = new Board();
      const attacking = new Board();
      placeShip(defending, ShipType.Destroyer, 0, 0);

      const revealed = processSpotter(defending, attacking, { row: 0, col: 0 }, ShotResult.Hit);
      expect(revealed.length).toBe(0);
    });
  });

  describe('Nimble (Destroyer)', () => {
    it('initializes adjacent cells', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 5, 5);

      const nimbleCells = initNimbleCells(board);
      // Destroyer at (5,5) and (5,6) - adjacent cells should include
      // (4,5), (6,5), (5,4), (4,6), (6,6), (5,7)
      expect(nimbleCells.has(coordKey({ row: 4, col: 5 }))).toBe(true);
      expect(nimbleCells.has(coordKey({ row: 6, col: 5 }))).toBe(true);
      expect(nimbleCells.has(coordKey({ row: 5, col: 4 }))).toBe(true);
      expect(nimbleCells.has(coordKey({ row: 5, col: 7 }))).toBe(true);
    });

    it('forces a miss on adjacent cell (once)', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 5, 5);

      const state = createTraitState();
      state.nimbleFirstShotAdjacent = initNimbleCells(board);

      const forced = processNimble({ row: 4, col: 5 }, state);
      expect(forced).toBe(true);

      // Second shot on same cell is not forced
      const forced2 = processNimble({ row: 4, col: 5 }, state);
      expect(forced2).toBe(false);
    });

    it('excludes cells belonging to OTHER ships adjacent to the Destroyer', () => {
      // Regression: Nimble used to include other ships' cells, which caused
      // them to be permanently locked as Miss when fired upon, making the
      // ship unsinkable. Ensure only empty-water neighbours are protected.
      const board = new Board();
      // Submarine occupies (3,5)-(3,7); Destroyer occupies (4,5)-(4,6).
      // Submarine cell (3,5) and (3,6) are orthogonally adjacent to the Destroyer.
      placeShip(board, ShipType.Submarine, 3, 5);
      placeShip(board, ShipType.Destroyer, 4, 5);

      const nimbleCells = initNimbleCells(board);

      // Ship cells must NOT be in the Nimble set — they are legitimate targets.
      expect(nimbleCells.has(coordKey({ row: 3, col: 5 }))).toBe(false);
      expect(nimbleCells.has(coordKey({ row: 3, col: 6 }))).toBe(false);
      // Empty-water cells still protected.
      expect(nimbleCells.has(coordKey({ row: 5, col: 5 }))).toBe(true);
      expect(nimbleCells.has(coordKey({ row: 5, col: 6 }))).toBe(true);
      expect(nimbleCells.has(coordKey({ row: 4, col: 4 }))).toBe(true);
      expect(nimbleCells.has(coordKey({ row: 4, col: 7 }))).toBe(true);
    });

    it('still includes empty-water cells adjacent to the Destroyer', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 5, 5);

      const nimbleCells = initNimbleCells(board);
      expect(nimbleCells.size).toBeGreaterThan(0);
      // All entries must be empty cells (no ships placed other than Destroyer)
      for (const key of nimbleCells) {
        expect(board.getShipAt({
          row: Number(key.split(',')[0]),
          col: Number(key.split(',')[1]),
        })).toBeUndefined();
      }
    });
  });

  describe('Swift (Cruiser)', () => {
    it('repositions cruiser by one cell', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 5, 5);
      const state = createTraitState();

      const success = processSwift(board, 'right', state);
      expect(success).toBe(true);
      expect(state.swiftUsed).toBe(true);

      const cruiser = board.ships.find((s) => s.type === ShipType.Cruiser)!;
      expect(cruiser.cells[0]).toEqual({ row: 5, col: 6 });
    });

    it('cannot reposition twice', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 5, 5);
      const state = createTraitState();

      processSwift(board, 'right', state);
      const success = processSwift(board, 'right', state);
      expect(success).toBe(false);
    });

    it('rejects out of bounds reposition', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 0, 0, Orientation.Vertical);
      const state = createTraitState();

      const success = processSwift(board, 'up', state);
      expect(success).toBe(false);
      expect(state.swiftUsed).toBe(false);
    });
  });
});
