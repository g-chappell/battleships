import { describe, it, expect } from 'vitest';
import { Board } from '../Board';
import {
  ShipType,
  Orientation,
  CellState,
  ShotResult,
  type ShipPlacement,
} from '../types';

describe('Board', () => {
  describe('ship placement', () => {
    it('places a ship horizontally', () => {
      const board = new Board();
      const placement: ShipPlacement = {
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      };
      expect(board.placeShip(placement)).toBe(true);
      expect(board.grid[0][0]).toBe(CellState.Ship);
      expect(board.grid[0][1]).toBe(CellState.Ship);
      expect(board.grid[0][2]).toBe(CellState.Empty);
    });

    it('places a ship vertically', () => {
      const board = new Board();
      const placement: ShipPlacement = {
        type: ShipType.Cruiser,
        start: { row: 0, col: 0 },
        orientation: Orientation.Vertical,
      };
      expect(board.placeShip(placement)).toBe(true);
      expect(board.grid[0][0]).toBe(CellState.Ship);
      expect(board.grid[1][0]).toBe(CellState.Ship);
      expect(board.grid[2][0]).toBe(CellState.Ship);
    });

    it('rejects placement out of bounds (horizontal)', () => {
      const board = new Board();
      const placement: ShipPlacement = {
        type: ShipType.Carrier,
        start: { row: 0, col: 7 },
        orientation: Orientation.Horizontal,
      };
      expect(board.canPlaceShip(placement)).toBe(false);
      expect(board.placeShip(placement)).toBe(false);
    });

    it('rejects placement out of bounds (vertical)', () => {
      const board = new Board();
      const placement: ShipPlacement = {
        type: ShipType.Carrier,
        start: { row: 8, col: 0 },
        orientation: Orientation.Vertical,
      };
      expect(board.canPlaceShip(placement)).toBe(false);
    });

    it('rejects overlapping ships', () => {
      const board = new Board();
      board.placeShip({
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      });
      const overlap: ShipPlacement = {
        type: ShipType.Cruiser,
        start: { row: 0, col: 1 },
        orientation: Orientation.Vertical,
      };
      expect(board.canPlaceShip(overlap)).toBe(false);
    });

    it('rejects duplicate ship type', () => {
      const board = new Board();
      board.placeShip({
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      });
      expect(
        board.canPlaceShip({
          type: ShipType.Destroyer,
          start: { row: 2, col: 0 },
          orientation: Orientation.Horizontal,
        })
      ).toBe(false);
    });

    it('detects all ships placed', () => {
      const board = new Board();
      expect(board.allShipsPlaced()).toBe(false);

      board.placeShip({ type: ShipType.Carrier, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
      board.placeShip({ type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal });
      board.placeShip({ type: ShipType.Cruiser, start: { row: 2, col: 0 }, orientation: Orientation.Horizontal });
      board.placeShip({ type: ShipType.Submarine, start: { row: 3, col: 0 }, orientation: Orientation.Horizontal });
      board.placeShip({ type: ShipType.Destroyer, start: { row: 4, col: 0 }, orientation: Orientation.Horizontal });

      expect(board.allShipsPlaced()).toBe(true);
    });
  });

  describe('receiving shots', () => {
    it('registers a miss on empty cell', () => {
      const board = new Board();
      const result = board.receiveShot({ row: 0, col: 0 });
      expect(result.result).toBe(ShotResult.Miss);
      expect(board.grid[0][0]).toBe(CellState.Miss);
    });

    it('registers a hit on ship cell', () => {
      const board = new Board();
      board.placeShip({
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      });
      const result = board.receiveShot({ row: 0, col: 0 });
      expect(result.result).toBe(ShotResult.Hit);
      expect(board.grid[0][0]).toBe(CellState.Hit);
    });

    it('registers a sink when all cells hit', () => {
      const board = new Board();
      board.placeShip({
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      });
      board.receiveShot({ row: 0, col: 0 });
      const result = board.receiveShot({ row: 0, col: 1 });
      expect(result.result).toBe(ShotResult.Sink);
      expect(result.sunkShip).toBe(ShipType.Destroyer);
    });

    it('throws on already-targeted cell', () => {
      const board = new Board();
      board.receiveShot({ row: 0, col: 0 });
      expect(() => board.receiveShot({ row: 0, col: 0 })).toThrow();
    });

    it('throws on out-of-bounds shot', () => {
      const board = new Board();
      expect(() => board.receiveShot({ row: -1, col: 0 })).toThrow();
      expect(() => board.receiveShot({ row: 10, col: 0 })).toThrow();
    });

    it('detects all ships sunk', () => {
      const board = new Board();
      board.placeShip({
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      });
      expect(board.allShipsSunk()).toBe(false);
      board.receiveShot({ row: 0, col: 0 });
      board.receiveShot({ row: 0, col: 1 });
      // Only one ship placed, but allShipsSunk checks all placed ships
      expect(board.allShipsSunk()).toBe(true);
    });
  });

  describe('utility', () => {
    it('isValidTarget returns false for already-shot cells', () => {
      const board = new Board();
      board.receiveShot({ row: 0, col: 0 });
      expect(board.isValidTarget({ row: 0, col: 0 })).toBe(false);
      expect(board.isValidTarget({ row: 1, col: 0 })).toBe(true);
    });

    it('clone creates an independent copy', () => {
      const board = new Board();
      board.placeShip({
        type: ShipType.Destroyer,
        start: { row: 0, col: 0 },
        orientation: Orientation.Horizontal,
      });
      const clone = board.clone();
      clone.receiveShot({ row: 0, col: 0 });
      expect(board.grid[0][0]).toBe(CellState.Ship);
      expect(clone.grid[0][0]).toBe(CellState.Hit);
    });
  });

  describe('land cells', () => {
    it('generates the requested number of land cells', () => {
      const board = new Board();
      const placed = board.generateLandCells(3);
      expect(placed.length).toBe(3);
      for (const p of placed) {
        expect(board.grid[p.row][p.col]).toBe(CellState.Land);
      }
    });

    it('blocks ship placement on land cells', () => {
      const board = new Board();
      board.grid[5][5] = CellState.Land;
      const ok = board.canPlaceShip({
        type: ShipType.Destroyer,
        start: { row: 5, col: 4 },
        orientation: Orientation.Horizontal,
      });
      expect(ok).toBe(false);
    });

    it('treats land as valid target (opponent cannot see land — firing at it is a miss)', () => {
      const board = new Board();
      board.grid[5][5] = CellState.Land;
      // Opponent can fire at land cells (they can't see them)
      expect(board.isValidTarget({ row: 5, col: 5 })).toBe(true);
      // Firing at land produces a miss
      const outcome = board.receiveShot({ row: 5, col: 5 });
      expect(outcome.result).toBe(ShotResult.Miss);
    });
  });
});
