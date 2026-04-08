import { describe, it, expect } from 'vitest';
import { EasyAI, randomPlacement } from '../AI';
import { Board } from '../Board';
import { ShipType, ShotResult, GRID_SIZE, coordKey } from '../types';

describe('randomPlacement', () => {
  it('returns valid placements for all 5 ships', () => {
    const placements = randomPlacement();
    expect(placements).toHaveLength(5);

    const types = placements.map((p) => p.type);
    expect(types).toContain(ShipType.Carrier);
    expect(types).toContain(ShipType.Battleship);
    expect(types).toContain(ShipType.Cruiser);
    expect(types).toContain(ShipType.Submarine);
    expect(types).toContain(ShipType.Destroyer);
  });

  it('placements do not overlap', () => {
    for (let i = 0; i < 20; i++) {
      const placements = randomPlacement();
      const board = new Board();
      for (const p of placements) {
        expect(board.placeShip(p)).toBe(true);
      }
    }
  });
});

describe('EasyAI', () => {
  it('chooses valid targets', () => {
    const ai = new EasyAI();
    const board = new Board();
    const placements = randomPlacement();
    for (const p of placements) board.placeShip(p);

    for (let i = 0; i < 20; i++) {
      const target = ai.chooseTarget(board);
      expect(target.row).toBeGreaterThanOrEqual(0);
      expect(target.row).toBeLessThan(GRID_SIZE);
      expect(target.col).toBeGreaterThanOrEqual(0);
      expect(target.col).toBeLessThan(GRID_SIZE);
      // Simulate shot
      const result = board.receiveShot(target);
      ai.notifyResult(target, result.result);
    }
  });

  it('enters hunt mode after a hit', () => {
    const ai = new EasyAI();
    const board = new Board();

    // Place a destroyer at (5,5) horizontal
    board.placeShip({
      type: ShipType.Destroyer,
      start: { row: 5, col: 5 },
      orientation: 'horizontal' as any,
    });

    // Notify AI of a hit at (5,5)
    ai.notifyResult({ row: 5, col: 5 }, ShotResult.Hit);

    // Mark (5,5) as already targeted by adding to board
    board.receiveShot({ row: 5, col: 5 });

    // Next target should be adjacent to (5,5)
    const next = ai.chooseTarget(board);
    const adjacents = [
      coordKey({ row: 4, col: 5 }),
      coordKey({ row: 6, col: 5 }),
      coordKey({ row: 5, col: 4 }),
      coordKey({ row: 5, col: 6 }),
    ];
    expect(adjacents).toContain(coordKey(next));
  });
});
