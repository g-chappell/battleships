import { describe, it, expect } from 'vitest';
import { EasyAI, MediumAI, HardAI, randomPlacement } from '../AI';
import { Board } from '../Board';
import { ShipType, Orientation, ShotResult, GRID_SIZE, coordKey } from '../types';
import { AbilityType } from '../abilities';

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

  it('EasyAI does not implement pickAbility', () => {
    const ai: import('../AI').AIPlayer = new EasyAI();
    expect(ai.pickAbility).toBeUndefined();
  });
});

// ─── MediumAI ────────────────────────────────────────────────────────────────

describe('MediumAI', () => {
  it('enters hunt mode after a hit (shared logic with Easy)', () => {
    const ai = new MediumAI();
    const board = new Board();
    board.placeShip({ type: ShipType.Destroyer, start: { row: 5, col: 5 }, orientation: Orientation.Horizontal });

    ai.notifyResult({ row: 5, col: 5 }, ShotResult.Hit);
    board.receiveShot({ row: 5, col: 5 });

    const next = ai.chooseTarget(board);
    const adjacents = [
      coordKey({ row: 4, col: 5 }),
      coordKey({ row: 6, col: 5 }),
      coordKey({ row: 5, col: 4 }),
      coordKey({ row: 5, col: 6 }),
    ];
    expect(adjacents).toContain(coordKey(next));
  });

  it('extends along a detected axis after 2+ collinear hits', () => {
    const ai = new MediumAI();
    const board = new Board();
    board.placeShip({ type: ShipType.Cruiser, start: { row: 5, col: 5 }, orientation: Orientation.Horizontal });

    // Two horizontal hits at (5,5) and (5,6)
    ai.notifyResult({ row: 5, col: 5 }, ShotResult.Hit);
    board.receiveShot({ row: 5, col: 5 });
    ai.notifyResult({ row: 5, col: 6 }, ShotResult.Hit);
    board.receiveShot({ row: 5, col: 6 });

    // Next target must extend the row — either (5,4) or (5,7). Not (4,x) or (6,x).
    const next = ai.chooseTarget(board);
    expect(next.row).toBe(5);
    expect([4, 7]).toContain(next.col);
  });

  it('pickAbility prioritises Summon Kraken when available', () => {
    const ai = new MediumAI();
    const ownBoard = new Board();
    const oppBoard = new Board();
    oppBoard.placeShip({ type: ShipType.Carrier, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
    const choice = ai.pickAbility!(ownBoard, oppBoard, [AbilityType.SummonKraken, AbilityType.SonarPing]);
    expect(choice).not.toBeNull();
    expect(choice!.type).toBe(AbilityType.SummonKraken);
  });

  it('pickAbility returns null when no abilities available', () => {
    const ai = new MediumAI();
    const choice = ai.pickAbility!(new Board(), new Board(), []);
    expect(choice).toBeNull();
  });
});

// ─── HardAI ──────────────────────────────────────────────────────────────────

describe('HardAI', () => {
  it('enters hunt mode after a hit (shared logic)', () => {
    const ai = new HardAI();
    const board = new Board();
    board.placeShip({ type: ShipType.Destroyer, start: { row: 5, col: 5 }, orientation: Orientation.Horizontal });

    ai.notifyResult({ row: 5, col: 5 }, ShotResult.Hit);
    board.receiveShot({ row: 5, col: 5 });

    const next = ai.chooseTarget(board);
    const adjacents = [
      coordKey({ row: 4, col: 5 }),
      coordKey({ row: 6, col: 5 }),
      coordKey({ row: 5, col: 4 }),
      coordKey({ row: 5, col: 6 }),
    ];
    expect(adjacents).toContain(coordKey(next));
  });

  it('chooses valid targets via density search', () => {
    const ai = new HardAI();
    const board = new Board();
    const placements = randomPlacement();
    for (const p of placements) board.placeShip(p);

    for (let i = 0; i < 20; i++) {
      const target = ai.chooseTarget(board);
      expect(target.row).toBeGreaterThanOrEqual(0);
      expect(target.row).toBeLessThan(GRID_SIZE);
      expect(target.col).toBeGreaterThanOrEqual(0);
      expect(target.col).toBeLessThan(GRID_SIZE);
      const result = board.receiveShot(target);
      ai.notifyResult(target, result.result);
    }
  });

  it('pickAbility prioritises Summon Kraken when available', () => {
    const ai = new HardAI();
    const ownBoard = new Board();
    const oppBoard = new Board();
    oppBoard.placeShip({ type: ShipType.Carrier, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal });
    const choice = ai.pickAbility!(ownBoard, oppBoard, [AbilityType.SummonKraken, AbilityType.CannonBarrage]);
    expect(choice).not.toBeNull();
    expect(choice!.type).toBe(AbilityType.SummonKraken);
  });
});
