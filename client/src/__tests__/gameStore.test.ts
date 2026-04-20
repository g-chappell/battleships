import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the audio module before importing the store
vi.mock('../services/audio', () => ({
  playAbilityActivate: vi.fn(),
}));

import { useGameStore } from '../store/gameStore';
import {
  GameEngine,
  GamePhase,
  ShipType,
  Orientation,
  CellState,
  ShotResult,
  AbilityType,
  createAbilitySystemState,
  createTraitState,
  getMission,
  type ShipPlacement,
} from '@shared/index';

const STANDARD_PLACEMENTS: ShipPlacement[] = [
  { type: ShipType.Carrier,    start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Battleship, start: { row: 1, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Cruiser,    start: { row: 2, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Submarine,  start: { row: 3, col: 0 }, orientation: Orientation.Horizontal },
  { type: ShipType.Destroyer,  start: { row: 4, col: 0 }, orientation: Orientation.Horizontal },
];

function installReadyGame() {
  const engine = new GameEngine();
  for (const p of STANDARD_PLACEMENTS) {
    engine.placePlayerShip(p);
    engine.placeOpponentShip(p);
  }
  engine.startGame();
  const playerTraits = createTraitState();
  const opponentTraits = createTraitState();
  useGameStore.setState({
    engine,
    playerTraits,
    opponentTraits,
    isAnimating: false,
    opponentDeflectedCoord: null,
    playerDeflectedCoord: null,
    lastShotOutcome: null,
  });
}

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

  it('has deflection-marker defaults (null) on initial state', () => {
    const state = useGameStore.getState();
    expect(state.opponentDeflectedCoord).toBeNull();
    expect(state.playerDeflectedCoord).toBeNull();
  });

  it('startNewGame() clears deflection markers', () => {
    useGameStore.setState({
      opponentDeflectedCoord: { row: 1, col: 0 },
      playerDeflectedCoord: { row: 2, col: 3 },
    });
    useGameStore.getState().startNewGame();
    const state = useGameStore.getState();
    expect(state.opponentDeflectedCoord).toBeNull();
    expect(state.playerDeflectedCoord).toBeNull();
  });

  it('playerFire() on Ironclad Battleship sets outcome.deflected and opponentDeflectedCoord', () => {
    installReadyGame();
    const { playerFire } = useGameStore.getState();
    const outcome = playerFire({ row: 1, col: 0 });

    expect(outcome).not.toBeNull();
    expect(outcome!.deflected).toBe(true);
    expect(outcome!.result).toBe(ShotResult.Miss);

    const state = useGameStore.getState();
    expect(state.opponentDeflectedCoord).toEqual({ row: 1, col: 0 });
    // Cell stays targetable so the player can fire again once Ironclad is consumed
    expect(state.engine.opponentBoard.grid[1][0]).toBe(CellState.Ship);
    // Turn switches to opponent since the shot was effectively a miss
    expect(state.engine.currentTurn).toBe('opponent');
  });

  it('next playerFire() on a normal cell clears opponentDeflectedCoord', () => {
    installReadyGame();
    const state = useGameStore.getState();
    state.playerFire({ row: 1, col: 0 }); // deflection sets coord
    expect(useGameStore.getState().opponentDeflectedCoord).toEqual({ row: 1, col: 0 });

    // Allow firing again
    useGameStore.setState({ isAnimating: false });
    const engine = useGameStore.getState().engine;
    engine.currentTurn = 'player';

    state.playerFire({ row: 9, col: 9 }); // empty water Miss
    expect(useGameStore.getState().opponentDeflectedCoord).toBeNull();
  });

  it('Submarine cells adjacent to Destroyer are fully sinkable via playerFire (regression for Nimble lock)', () => {
    installReadyGame();
    const { engine } = useGameStore.getState();
    const submarineCells: Array<{ row: number; col: number }> = [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
    ];
    for (const cell of submarineCells) {
      useGameStore.setState({ isAnimating: false });
      engine.currentTurn = 'player';
      const outcome = useGameStore.getState().playerFire(cell);
      expect(outcome).not.toBeNull();
      // All three cells are legitimate hits (Nimble must not revert them)
      expect([ShotResult.Hit, ShotResult.Sink]).toContain(outcome!.result);
    }
    const submarine = engine.opponentBoard.ships.find((s) => s.type === ShipType.Submarine)!;
    expect(submarine.hits.size).toBe(submarine.cells.length);
  });

  describe('activeForbiddenAbilities', () => {
    it('is empty by default', () => {
      expect(useGameStore.getState().activeForbiddenAbilities).toEqual([]);
    });

    it('startNewGame() clears activeForbiddenAbilities', () => {
      useGameStore.setState({ activeForbiddenAbilities: [AbilityType.SonarPing] });
      useGameStore.getState().startNewGame();
      expect(useGameStore.getState().activeForbiddenAbilities).toEqual([]);
    });

    it('resetGame() clears activeForbiddenAbilities', () => {
      useGameStore.setState({ activeForbiddenAbilities: [AbilityType.CannonBarrage] });
      useGameStore.getState().resetGame();
      expect(useGameStore.getState().activeForbiddenAbilities).toEqual([]);
    });

    it('startCampaignMission() sets activeForbiddenAbilities from mission modifiers', () => {
      // Mission 8 has forbiddenAbilities (ChainShot) per campaign definition
      // Use a synthetic mission object to avoid depending on specific campaign data
      const fakeMission = {
        ...getMission(1)!,
        modifiers: { forbiddenAbilities: [AbilityType.ChainShot, AbilityType.SonarPing] },
      };
      useGameStore.getState().startCampaignMission(fakeMission);
      expect(useGameStore.getState().activeForbiddenAbilities).toEqual([
        AbilityType.ChainShot,
        AbilityType.SonarPing,
      ]);
    });

    it('startCampaignMission() sets activeForbiddenAbilities to [] when mission has none', () => {
      const fakeMission = { ...getMission(1)!, modifiers: {} };
      useGameStore.getState().startCampaignMission(fakeMission);
      expect(useGameStore.getState().activeForbiddenAbilities).toEqual([]);
    });

    it('useAbility() rejects a forbidden ability without applying any effect', () => {
      installReadyGame();
      useGameStore.setState({
        playerAbilities: createAbilitySystemState([AbilityType.SonarPing]),
        activeForbiddenAbilities: [AbilityType.SonarPing],
        isAnimating: false,
      });
      useGameStore.getState().engine.currentTurn = 'player';

      const beforeTick = useGameStore.getState().tick;
      useGameStore.getState().useAbility(AbilityType.SonarPing, { row: 5, col: 5 });

      // Tick should not advance — ability was rejected
      expect(useGameStore.getState().tick).toBe(beforeTick);
      // sonarResult stays null — SonarPing never ran
      expect(useGameStore.getState().sonarResult).toBeNull();
    });

    it('useAbility() allows a non-forbidden ability normally', () => {
      installReadyGame();
      useGameStore.setState({
        playerAbilities: createAbilitySystemState([AbilityType.SonarPing]),
        activeForbiddenAbilities: [AbilityType.CannonBarrage],
        isAnimating: false,
      });
      useGameStore.getState().engine.currentTurn = 'player';

      const beforeTick = useGameStore.getState().tick;
      useGameStore.getState().useAbility(AbilityType.SonarPing, { row: 5, col: 5 });

      // Tick advances — SonarPing was allowed
      expect(useGameStore.getState().tick).toBeGreaterThan(beforeTick);
    });
  });
});
