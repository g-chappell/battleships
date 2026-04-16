import { describe, it, expect } from 'vitest';
import { Board } from '../Board';
import {
  createTraitState,
  processIronclad,
  processSpotter,
  processCoastalCover,
  processDepthCharge,
  resolveDepthChargeShots,
  applyDeflectionTrait,
  isCoastalShip,
  isSubmarineCell,
} from '../traits';
import {
  ShipType,
  Orientation,
  ShotResult,
  CellState,
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

  describe('Coastal Cover (land adjacency)', () => {
    function boardWithShipNextToLand(): Board {
      const board = new Board();
      // Manually place a land cell at (0,2) and a Cruiser at (0,3)-(0,5)
      board.grid[0][2] = CellState.Land;
      placeShip(board, ShipType.Cruiser, 0, 3);
      return board;
    }

    it('isCoastalShip returns true when any cell of the ship is adjacent to Land', () => {
      const board = boardWithShipNextToLand();
      expect(isCoastalShip(board, ShipType.Cruiser)).toBe(true);
    });

    it('isCoastalShip returns false when no ship cell is adjacent to Land', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 5, 5);
      expect(isCoastalShip(board, ShipType.Cruiser)).toBe(false);
    });

    it('deflects the first hit on a coastal ship; subsequent hits land normally', () => {
      const board = boardWithShipNextToLand();
      const state = createTraitState();

      const firstDeflect = processCoastalCover(board, { row: 0, col: 3 }, state);
      expect(firstDeflect).toBe(true);

      // Second hit (any cell of the same ship) no longer deflects — cover consumed
      const secondDeflect = processCoastalCover(board, { row: 0, col: 4 }, state);
      expect(secondDeflect).toBe(false);
    });

    it('does not trigger on a non-coastal ship', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 5, 5);
      const state = createTraitState();
      const deflect = processCoastalCover(board, { row: 5, col: 5 }, state);
      expect(deflect).toBe(false);
    });
  });

  describe('applyDeflectionTrait — Coastal + Ironclad exclusivity', () => {
    it('coastal Battleship triggers Coastal, NOT Ironclad', () => {
      const board = new Board();
      board.grid[0][0] = CellState.Land;
      placeShip(board, ShipType.Battleship, 1, 0);
      const state = createTraitState();

      const source = applyDeflectionTrait(board, { row: 1, col: 0 }, state);
      expect(source).toBe('coastal');
      expect(state.ironcladUsed.has(ShipType.Battleship)).toBe(false);
      expect(state.coastalCoverUsed.has(ShipType.Battleship)).toBe(true);
    });

    it('non-coastal Battleship triggers Ironclad', () => {
      const board = new Board();
      placeShip(board, ShipType.Battleship, 5, 5);
      const state = createTraitState();

      const source = applyDeflectionTrait(board, { row: 5, col: 5 }, state);
      expect(source).toBe('ironclad');
      expect(state.ironcladUsed.has(ShipType.Battleship)).toBe(true);
    });

    it('second hit on a coastal Battleship does NOT re-deflect via Ironclad', () => {
      const board = new Board();
      board.grid[0][0] = CellState.Land;
      placeShip(board, ShipType.Battleship, 1, 0);
      const state = createTraitState();

      applyDeflectionTrait(board, { row: 1, col: 0 }, state); // coastal consumed
      const second = applyDeflectionTrait(board, { row: 1, col: 1 }, state);
      expect(second).toBeNull();
    });

    it('non-battleship, non-coastal ship gets no deflect', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 5, 5);
      const state = createTraitState();
      const source = applyDeflectionTrait(board, { row: 5, col: 5 }, state);
      expect(source).toBeNull();
    });
  });

  describe('Depth Charge (Destroyer)', () => {
    it('triggers on the first hit on a Destroyer cell', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 5, 5);
      const state = createTraitState();
      const triggered = processDepthCharge(board, { row: 5, col: 5 }, state);
      expect(triggered).toBe(true);
      expect(state.depthChargeUsed).toBe(true);
    });

    it('does NOT re-trigger on a second hit', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 5, 5);
      const state = createTraitState();
      processDepthCharge(board, { row: 5, col: 5 }, state);
      const triggered2 = processDepthCharge(board, { row: 5, col: 6 }, state);
      expect(triggered2).toBe(false);
    });

    it('does NOT trigger on non-Destroyer ships', () => {
      const board = new Board();
      placeShip(board, ShipType.Cruiser, 0, 0);
      const state = createTraitState();
      const triggered = processDepthCharge(board, { row: 0, col: 0 }, state);
      expect(triggered).toBe(false);
      expect(state.depthChargeUsed).toBe(false);
    });

    it('resolveDepthChargeShots fires exactly N shots on unique unshot cells', () => {
      const board = new Board();
      placeShip(board, ShipType.Carrier, 0, 0);
      const shots = resolveDepthChargeShots(board, 6);
      expect(shots).toHaveLength(6);
      const coords = new Set(shots.map(s => coordKey(s.coordinate)));
      expect(coords.size).toBe(6);
    });

    it('resolveDepthChargeShots marks hits and sinks', () => {
      const board = new Board();
      placeShip(board, ShipType.Destroyer, 0, 0); // 2 cells at (0,0) and (0,1)
      const shots = resolveDepthChargeShots(board, 100); // enough to cover full board
      const hits = shots.filter(s => s.result === ShotResult.Hit || s.result === ShotResult.Sink);
      expect(hits.length).toBeGreaterThan(0);
    });
  });

  describe('Silent Running (Submarine)', () => {
    it('isSubmarineCell returns true only for Submarine cells', () => {
      const board = new Board();
      placeShip(board, ShipType.Submarine, 2, 2); // cells (2,2)(2,3)(2,4)
      placeShip(board, ShipType.Cruiser, 5, 5);   // cells (5,5)(5,6)(5,7)

      expect(isSubmarineCell(board, { row: 2, col: 2 })).toBe(true);
      expect(isSubmarineCell(board, { row: 2, col: 4 })).toBe(true);
      expect(isSubmarineCell(board, { row: 5, col: 5 })).toBe(false);
      expect(isSubmarineCell(board, { row: 0, col: 0 })).toBe(false);
    });
  });
});
