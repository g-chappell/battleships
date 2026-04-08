import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import {
  ShipType,
  Orientation,
  GamePhase,
  ShotResult,
} from '../types';

function placeAllShips(engine: GameEngine) {
  const ships = [
    { type: ShipType.Carrier, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
    { type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal },
    { type: ShipType.Cruiser, start: { row: 2, col: 0 }, orientation: Orientation.Horizontal },
    { type: ShipType.Submarine, start: { row: 3, col: 0 }, orientation: Orientation.Horizontal },
    { type: ShipType.Destroyer, start: { row: 4, col: 0 }, orientation: Orientation.Horizontal },
  ];

  for (const ship of ships) {
    engine.placePlayerShip(ship);
    engine.placeOpponentShip(ship);
  }
}

describe('GameEngine', () => {
  it('starts in placement phase', () => {
    const engine = new GameEngine();
    expect(engine.phase).toBe(GamePhase.Placement);
  });

  it('cannot start game without all ships placed', () => {
    const engine = new GameEngine();
    expect(engine.startGame()).toBe(false);
  });

  it('transitions to playing phase when all ships placed', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    expect(engine.startGame()).toBe(true);
    expect(engine.phase).toBe(GamePhase.Playing);
    expect(engine.currentTurn).toBe('player');
  });

  it('alternates turns after shots', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    engine.playerShoot({ row: 9, col: 9 }); // miss (no ships there)
    expect(engine.currentTurn).toBe('opponent');

    engine.opponentShoot({ row: 9, col: 9 });
    expect(engine.currentTurn).toBe('player');
  });

  it('rejects shots on wrong turn', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    expect(engine.opponentShoot({ row: 0, col: 0 })).toBeNull();
  });

  it('detects player win', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    // All shots are hits — player gets consecutive turns (no turn switching)
    const targets = [
      ...Array.from({ length: 5 }, (_, i) => ({ row: 0, col: i })),  // Carrier
      ...Array.from({ length: 4 }, (_, i) => ({ row: 1, col: i })),  // Battleship
      ...Array.from({ length: 3 }, (_, i) => ({ row: 2, col: i })),  // Cruiser
      ...Array.from({ length: 3 }, (_, i) => ({ row: 3, col: i })),  // Submarine
      ...Array.from({ length: 2 }, (_, i) => ({ row: 4, col: i })),  // Destroyer
    ];

    for (let i = 0; i < targets.length; i++) {
      expect(engine.currentTurn).toBe('player'); // hits keep turn on player
      const result = engine.playerShoot(targets[i]);
      expect(result).not.toBeNull();
      if (i < targets.length - 1) {
        expect(engine.phase).toBe(GamePhase.Playing);
      }
    }

    expect(engine.phase).toBe(GamePhase.Finished);
    expect(engine.winner).toBe('player');
  });

  it('tracks shot history', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    engine.playerShoot({ row: 0, col: 0 }); // hit carrier — turn stays with player
    expect(engine.currentTurn).toBe('player'); // consecutive turn on hit
    engine.playerShoot({ row: 9, col: 9 }); // miss — turn switches to opponent
    expect(engine.currentTurn).toBe('opponent');
    engine.opponentShoot({ row: 9, col: 9 }); // miss — turn switches to player

    expect(engine.shotHistory).toHaveLength(3);
    expect(engine.shotHistory[0].result).toBe(ShotResult.Hit);
    expect(engine.shotHistory[1].result).toBe(ShotResult.Miss);
    expect(engine.shotHistory[2].result).toBe(ShotResult.Miss);
  });

  it('tracks ships remaining', () => {
    const engine = new GameEngine();
    placeAllShips(engine);
    engine.startGame();

    expect(engine.getOpponentShipsRemaining()).toBe(5);

    // Sink the destroyer — hits give consecutive turns
    engine.playerShoot({ row: 4, col: 0 }); // hit — still player's turn
    engine.playerShoot({ row: 4, col: 1 }); // sink — still player's turn

    expect(engine.getOpponentShipsRemaining()).toBe(4);
  });
});
