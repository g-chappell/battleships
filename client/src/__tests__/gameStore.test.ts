import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the audio module before importing the store
vi.mock('../services/audio', () => ({
  playAbilityActivate: vi.fn(),
}));

import { useGameStore } from '../store/gameStore';
import { GamePhase, ShipType, Orientation } from '@shared/index';

function resetStore() {
  useGameStore.getState().resetGame();
}

describe('gameStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('has correct initial defaults', () => {
    const state = useGameStore.getState();
    expect(state.screen).toBe('menu');
    expect(state.engine).toBeDefined();
    expect(state.engine.phase).toBe(GamePhase.Placement);
    expect(state.difficulty).toBe('easy');
    expect(state.placedShips).toEqual([]);
    expect(state.isAnimating).toBe(false);
    expect(state.lastShotOutcome).toBeNull();
    expect(state.viewingBoard).toBe('player');
    expect(state.mpPlacementSubmitted).toBe(false);
  });

  it('setScreen() updates screen', () => {
    useGameStore.getState().setScreen('game');
    expect(useGameStore.getState().screen).toBe('game');

    useGameStore.getState().setScreen('dashboard');
    expect(useGameStore.getState().screen).toBe('dashboard');
  });

  it('setDifficulty() updates difficulty', () => {
    useGameStore.getState().setDifficulty('hard');
    expect(useGameStore.getState().difficulty).toBe('hard');
  });

  it('placeShip() adds ship to engine and updates placedShips', () => {
    const state = useGameStore.getState();
    // The default placingShipType is Carrier and orientation is Horizontal
    expect(state.placingShipType).toBe(ShipType.Carrier);

    const result = state.placeShip({ row: 0, col: 0 });
    expect(result).toBe(true);

    const updated = useGameStore.getState();
    expect(updated.placedShips).toContain(ShipType.Carrier);
    // After placing Carrier, next ship should be selected automatically
    expect(updated.placingShipType).not.toBe(ShipType.Carrier);
    expect(updated.placingShipType).not.toBeNull();
  });

  it('placeShip() returns false for invalid placement', () => {
    // Try placing at a position that would go out of bounds
    // Carrier is 5 cells, horizontal at col 8 would overflow a 10-wide board
    const result = useGameStore.getState().placeShip({ row: 0, col: 8 });
    expect(result).toBe(false);
    expect(useGameStore.getState().placedShips).toEqual([]);
  });

  it('startNewGame() resets engine and sets screen to game', () => {
    // First set some state
    useGameStore.getState().setScreen('dashboard');
    const oldEngine = useGameStore.getState().engine;

    useGameStore.getState().startNewGame();

    const state = useGameStore.getState();
    expect(state.screen).toBe('game');
    expect(state.engine).not.toBe(oldEngine);
    expect(state.engine.phase).toBe(GamePhase.Placement);
    expect(state.placedShips).toEqual([]);
    expect(state.gameMode).toBe('ai');
  });

  it('resetGame() goes back to menu with fresh state', () => {
    useGameStore.getState().startNewGame();
    useGameStore.getState().placeShip({ row: 0, col: 0 });

    useGameStore.getState().resetGame();

    const state = useGameStore.getState();
    expect(state.screen).toBe('menu');
    expect(state.placedShips).toEqual([]);
    expect(state.isAnimating).toBe(false);
    expect(state.lastShotOutcome).toBeNull();
    expect(state.tick).toBe(0);
  });

  it('rotateShip() toggles orientation', () => {
    expect(useGameStore.getState().placingOrientation).toBe(Orientation.Horizontal);

    useGameStore.getState().rotateShip();
    expect(useGameStore.getState().placingOrientation).toBe(Orientation.Vertical);

    useGameStore.getState().rotateShip();
    expect(useGameStore.getState().placingOrientation).toBe(Orientation.Horizontal);
  });
});
