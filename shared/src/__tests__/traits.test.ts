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
  CellState,
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
