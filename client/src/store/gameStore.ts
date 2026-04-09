import { create } from 'zustand';
import { playAbilityActivate } from '../services/audio';
import {
  GameEngine,
  GamePhase,
  ShipType,
  Orientation,
  CellState,
  ShotResult,
  EasyAI,
  MediumAI,
  HardAI,
  randomPlacement,
  AbilityType,
  createAbilitySystemState,
  canUseAbility,
  tickCooldowns,
  executeCannonBarrage,
  executeSonarPing,
  executeSmokeScreen,
  executeRepairKit,
  executeChainShot,
  executeSpyglass,
  executeBoardingParty,
  fixStaleOutcomes,
  createTraitState,
  initNimbleCells,
  processIronclad,
  processSpotter,
  processNimble,
  coordKey,
} from '@shared/index';
import type {
  ShipPlacement,
  Coordinate,
  ShotOutcome,
  AIPlayer,
  AbilitySystemState,
  TraitState,
  SonarPingResult,
} from '@shared/index';

export type AppScreen = 'menu' | 'game' | 'dashboard' | 'lobby' | 'leaderboard' | 'campaign' | 'friends' | 'settings' | 'shop' | 'tournaments' | 'clans' | 'replay' | 'spectate' | 'multiplayer';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'ai' | 'multiplayer' | 'campaign';

export type CreatureType = 'kraken' | 'serpent' | 'mermaid';
export interface AmbientCreature {
  id: string;
  type: CreatureType;
  cell: Coordinate;
  board: 'player' | 'opponent';
  spawnedAt: number; // ms timestamp
  lifetime: number; // ms
}

interface GameStore {
  screen: AppScreen;
  gameMode: GameMode;
  difficulty: Difficulty;
  engine: GameEngine;
  ai: AIPlayer;
  tick: number;

  // Placement state
  placingShipType: ShipType | null;
  placingOrientation: Orientation;
  placedShips: ShipType[];

  // Firing state
  lastShotOutcome: ShotOutcome | null;
  isAnimating: boolean;
  viewingBoard: 'player' | 'opponent';

  // MP placement: true after the player has submitted their placements to the server
  mpPlacementSubmitted: boolean;

  // Abilities
  playerAbilities: AbilitySystemState | null;
  opponentAbilities: AbilitySystemState | null;
  selectedAbilityTypes: AbilityType[];
  activeAbility: AbilityType | null; // ability being targeted this turn
  sonarResult: SonarPingResult | null;
  sonarHistory: { center: Coordinate; shipDetected: boolean }[];
  spyglassResult: { row: number; shipCount: number } | null;
  boardingPartyResult: { shipType: string; hitsTaken: number; totalCells: number } | null;
  revealedCells: Set<string>; // cells revealed by Spotter trait
  commentary: string; // inline turn commentary text

  // Ambient creatures
  ambientCreatures: AmbientCreature[];
  spawnAmbientCreature: () => void;
  pruneCreatures: () => void;

  // Traits
  playerTraits: TraitState | null;
  opponentTraits: TraitState | null;

  // Actions
  setScreen: (screen: AppScreen) => void;
  setDifficulty: (d: Difficulty) => void;
  startNewGame: () => void;
  startMultiplayerGame: () => void;
  startCampaignMission: (mission: import('@shared/index').CampaignMission) => void;

  // Ability selection (pre-match)
  toggleAbilitySelection: (type: AbilityType) => void;

  // Placement actions
  selectShipToPlace: (type: ShipType) => void;
  rotateShip: () => void;
  placeShip: (start: Coordinate) => boolean;
  autoPlaceShips: () => void;
  confirmPlacement: () => boolean;

  // Firing actions
  playerFire: (coord: Coordinate) => ShotOutcome | null;
  useAbility: (type: AbilityType, coord: Coordinate) => void;
  setActiveAbility: (type: AbilityType | null) => void;
  processAITurn: () => Promise<ShotOutcome | null>;
  setAnimating: (v: boolean) => void;
  switchView: (board: 'player' | 'opponent') => void;

  // Multiplayer sync
  syncFromMpState: (state: import('@shared/index').PublicGameState) => void;

  // Reset
  resetGame: () => void;
}

function createAI(difficulty: Difficulty): AIPlayer {
  switch (difficulty) {
    case 'easy': return new EasyAI();
    case 'medium': return new MediumAI();
    case 'hard': return new HardAI();
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  gameMode: 'ai',
  difficulty: 'easy',
  engine: new GameEngine(),
  ai: new EasyAI(),
  tick: 0,
  mpPlacementSubmitted: false,

  placingShipType: ShipType.Carrier,
  placingOrientation: Orientation.Horizontal,
  placedShips: [],

  lastShotOutcome: null,
  isAnimating: false,
  viewingBoard: 'player',

  playerAbilities: null,
  opponentAbilities: null,
  selectedAbilityTypes: [AbilityType.CannonBarrage, AbilityType.SonarPing],
  activeAbility: null,
  sonarResult: null,
    sonarHistory: [],
    spyglassResult: null,
    boardingPartyResult: null,
    commentary: '',
  revealedCells: new Set(),

  playerTraits: null,
  opponentTraits: null,

  setScreen: (screen) => set({ screen }),
  setDifficulty: (difficulty) => set({ difficulty }),

  startCampaignMission: (mission) => {
    const ai = createAI(mission.difficulty);
    const engine = new GameEngine();
    const landCount = 2 + Math.floor(Math.random() * 3);
    engine.playerBoard.generateLandCells(landCount);
    engine.opponentBoard.generateLandCells(landCount);
    set({
      screen: 'game',
      gameMode: 'campaign',
      engine,
      ai,
      placingShipType: ShipType.Carrier,
      placingOrientation: Orientation.Horizontal,
      placedShips: [],
      lastShotOutcome: null,
      isAnimating: false,
      viewingBoard: 'player',
      mpPlacementSubmitted: false,
      playerAbilities: null,
      opponentAbilities: null,
      activeAbility: null,
      sonarResult: null,
      sonarHistory: [],
      spyglassResult: null,
      boardingPartyResult: null,
      commentary: '',
      ambientCreatures: [],
      revealedCells: new Set(),
      playerTraits: null,
      opponentTraits: null,
      selectedAbilityTypes: mission.modifiers.fixedAbilities && mission.modifiers.fixedAbilities.length === 2
        ? mission.modifiers.fixedAbilities
        : get().selectedAbilityTypes,
      tick: 0,
    });
  },

  startNewGame: () => {
    const { difficulty } = get();
    const engine = new GameEngine();
    // Generate islands BEFORE ship placement starts
    const landCount = 2 + Math.floor(Math.random() * 3); // 2-4 islands
    engine.playerBoard.generateLandCells(landCount);
    engine.opponentBoard.generateLandCells(landCount);
    set({
      screen: 'game',
      gameMode: 'ai',
      engine,
      ai: createAI(difficulty),
      placingShipType: ShipType.Carrier,
      placingOrientation: Orientation.Horizontal,
      placedShips: [],
      lastShotOutcome: null,
      isAnimating: false,
      viewingBoard: 'player',
      mpPlacementSubmitted: false,
      playerAbilities: null,
      opponentAbilities: null,
      activeAbility: null,
      sonarResult: null,
    sonarHistory: [],
    spyglassResult: null,
    boardingPartyResult: null,
    commentary: '',
      ambientCreatures: [],
      revealedCells: new Set(),
      playerTraits: null,
      opponentTraits: null,
      tick: 0,
    });
  },

  startMultiplayerGame: () => {
    const engine = new GameEngine();
    const landCount = 2 + Math.floor(Math.random() * 3);
    engine.playerBoard.generateLandCells(landCount);
    engine.opponentBoard.generateLandCells(landCount);
    set({
      screen: 'game',
      gameMode: 'multiplayer',
      engine,
      placingShipType: ShipType.Carrier,
      placingOrientation: Orientation.Horizontal,
      placedShips: [],
      lastShotOutcome: null,
      isAnimating: false,
      viewingBoard: 'player',
      mpPlacementSubmitted: false,
      playerAbilities: null,
      opponentAbilities: null,
      activeAbility: null,
      sonarResult: null,
      sonarHistory: [],
      commentary: '',
      ambientCreatures: [],
      revealedCells: new Set(),
      playerTraits: null,
      opponentTraits: null,
      tick: 0,
    });
  },

  toggleAbilitySelection: (type) => {
    set((s) => {
      const current = s.selectedAbilityTypes;
      if (current.includes(type)) {
        return { selectedAbilityTypes: current.filter((t) => t !== type) };
      }
      if (current.length >= 2) {
        return { selectedAbilityTypes: [current[1], type] };
      }
      return { selectedAbilityTypes: [...current, type] };
    });
  },

  selectShipToPlace: (type) => set({ placingShipType: type }),

  rotateShip: () =>
    set((s) => ({
      placingOrientation:
        s.placingOrientation === Orientation.Horizontal
          ? Orientation.Vertical
          : Orientation.Horizontal,
    })),

  placeShip: (start) => {
    const { engine, placingShipType, placingOrientation, placedShips } = get();
    if (!placingShipType) return false;

    const placement: ShipPlacement = {
      type: placingShipType,
      start,
      orientation: placingOrientation,
    };

    if (!engine.placePlayerShip(placement)) return false;

    const newPlaced = [...placedShips, placingShipType];
    const allTypes = Object.values(ShipType);
    const remaining = allTypes.filter((t) => !newPlaced.includes(t));

    set({
      placedShips: newPlaced,
      placingShipType: remaining.length > 0 ? remaining[0] : null,
    });
    return true;
  },

  autoPlaceShips: () => {
    const { engine } = get();
    // Reset player board keeping land cells, then re-place randomly
    for (let r = 0; r < engine.playerBoard.grid.length; r++) {
      for (let c = 0; c < engine.playerBoard.grid[r].length; c++) {
        if (engine.playerBoard.grid[r][c] === CellState.Ship) {
          engine.playerBoard.grid[r][c] = CellState.Empty;
        }
      }
    }
    engine.playerBoard.ships = [];
    const placements = randomPlacement(engine.playerBoard);
    for (const p of placements) {
      engine.placePlayerShip(p);
    }
    set((s) => ({
      placedShips: Object.values(ShipType),
      placingShipType: null,
      tick: s.tick + 1,
    }));
  },

  confirmPlacement: () => {
    const { engine, ai, selectedAbilityTypes, gameMode } = get();
    if (!engine.playerBoard.allShipsPlaced()) return false;

    if (gameMode === 'multiplayer') {
      // In MP, send placements to server. Server initializes traits/abilities.
      // Build ship placements from current player ships
      const placements = engine.playerBoard.ships.map((ship) => {
        const cells = ship.cells;
        const start = cells[0];
        const orientation = cells.length > 1 && cells[1].row !== cells[0].row
          ? Orientation.Vertical : Orientation.Horizontal;
        return { type: ship.type, start, orientation };
      });
      // Use dynamic import to avoid circular dep
      import('./socketStore').then(({ useSocketStore }) => {
        useSocketStore.getState().submitPlacement(placements);
      });
      // Mark as submitted so the UI hides the Ready button and shows
      // a "waiting for opponent" overlay until the server transitions to playing.
      set({ mpPlacementSubmitted: true });
      return true;
    }

    // AI mode — original logic
    const aiPlacements = ai.placeShips(engine.opponentBoard);
    for (const p of aiPlacements) {
      engine.placeOpponentShip(p);
    }

    const playerTraits = createTraitState();
    const opponentTraits = createTraitState();
    playerTraits.nimbleFirstShotAdjacent = initNimbleCells(engine.playerBoard);
    opponentTraits.nimbleFirstShotAdjacent = initNimbleCells(engine.opponentBoard);

    const playerAbilities = createAbilitySystemState(selectedAbilityTypes);
    const allAbilities = Object.values(AbilityType);
    const shuffled = allAbilities.sort(() => Math.random() - 0.5);
    const opponentAbilities = createAbilitySystemState(shuffled.slice(0, 2));

    const started = engine.startGame();
    if (started) {
      set((s) => ({
        viewingBoard: 'opponent',
        playerAbilities,
        opponentAbilities,
        playerTraits,
        opponentTraits,
        tick: s.tick + 1,
      }));
    }
    return started;
  },

  playerFire: (coord) => {
    const { engine, isAnimating, opponentTraits, playerAbilities } = get();
    if (isAnimating) return null;
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'player') return null;

    // Nimble: forced miss on cells adjacent to destroyer
    if (opponentTraits && processNimble(coord, opponentTraits)) {
      const forcedOutcome = engine.playerShoot(coord);
      if (forcedOutcome) {
        // Nimble forces it to miss — revert any hit
        if (forcedOutcome.result !== ShotResult.Miss) {
          const ship = engine.opponentBoard.getShipAt(coord);
          if (ship) ship.hits.delete(coordKey(coord));
          engine.opponentBoard.grid[coord.row][coord.col] = CellState.Miss;
          forcedOutcome.result = ShotResult.Miss;
          forcedOutcome.sunkShip = undefined;
          // Engine kept turn on player (hit doesn't switch). Force switch since it's actually a miss.
          engine.currentTurn = 'opponent';
        }
        set((s) => ({ lastShotOutcome: forcedOutcome, isAnimating: true, tick: s.tick + 1 }));
      }
      return forcedOutcome;
    }

    // Fire normally through the engine
    const outcome = engine.playerShoot(coord);
    if (!outcome) return null;

    // Ironclad: if hit was on Battleship and armor unused, deflect the shot.
    // Revert grid to Ship state so the cell remains targetable on a future turn.
    if (opponentTraits && outcome.result === ShotResult.Hit) {
      const negated = processIronclad(engine.opponentBoard, coord, opponentTraits);
      if (negated) {
        const ship = engine.opponentBoard.getShipAt(coord);
        if (ship) ship.hits.delete(coordKey(coord));
        engine.opponentBoard.grid[coord.row][coord.col] = CellState.Ship;
        outcome.result = ShotResult.Miss;
        outcome.sunkShip = undefined;
        engine.currentTurn = 'opponent';
      }
    }

    // Record action for accuracy tracking (after trait processing)
    engine.recordPlayerAction(outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink);

    if (playerAbilities) {
      tickCooldowns(playerAbilities);
    }

    set((s) => ({ lastShotOutcome: outcome, isAnimating: true, tick: s.tick + 1 }));
    return outcome;
  },

  useAbility: (type, coord) => {
    const { engine, isAnimating, playerAbilities, opponentTraits } = get();
    if (isAnimating || !playerAbilities) return;
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'player') return;
    if (!canUseAbility(playerAbilities, type)) return;
    playAbilityActivate();

    // Apply Ironclad/Nimble traits to ability-based shots (same as playerFire)
    const applyTraits = (outcomes: ShotOutcome[]) => {
      if (!opponentTraits) return;
      for (const outcome of outcomes) {
        const c = outcome.coordinate;
        // Nimble: forced miss adjacent to destroyer
        if (outcome.result === ShotResult.Hit && processNimble(c, opponentTraits)) {
          const ship = engine.opponentBoard.getShipAt(c);
          if (ship) ship.hits.delete(coordKey(c));
          engine.opponentBoard.grid[c.row][c.col] = CellState.Miss;
          outcome.result = ShotResult.Miss;
          outcome.sunkShip = undefined;
        }
        // Ironclad: absorb first hit on Battleship
        if (outcome.result === ShotResult.Hit) {
          const negated = processIronclad(engine.opponentBoard, c, opponentTraits);
          if (negated) {
            const ship = engine.opponentBoard.getShipAt(c);
            if (ship) ship.hits.delete(coordKey(c));
            engine.opponentBoard.grid[c.row][c.col] = CellState.Ship;
            outcome.result = ShotResult.Miss;
            outcome.sunkShip = undefined;
          }
        }
      }
    };

    switch (type) {
      case AbilityType.CannonBarrage: {
        const result = executeCannonBarrage(engine.opponentBoard, coord, playerAbilities);
        if (result && result.outcomes.length > 0) {
          applyTraits(result.outcomes);
          fixStaleOutcomes(result.outcomes, engine.opponentBoard);
          const didHit = result.outcomes.some(o => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
          engine.recordPlayerAction(didHit);
          const lastOutcome = result.outcomes[result.outcomes.length - 1];
          engine.currentTurn = 'opponent';
          if (engine.opponentBoard.allShipsSunk()) {
            engine.phase = GamePhase.Finished;
            engine.winner = 'player';
          }
          set((s) => ({ lastShotOutcome: lastOutcome, isAnimating: true, tick: s.tick + 1 }));
        }
        break;
      }
      case AbilityType.SonarPing: {
        const result = executeSonarPing(engine.opponentBoard, coord, playerAbilities);
        if (result) {
          engine.recordPlayerAction(result.shipDetected);
          engine.currentTurn = 'opponent';
          set((s) => ({
            sonarResult: result,
            sonarHistory: [...s.sonarHistory, { center: coord, shipDetected: result.shipDetected }],
            isAnimating: true,
            tick: s.tick + 1,
          }));
        }
        break;
      }
      case AbilityType.SmokeScreen: {
        if (playerAbilities) {
          executeSmokeScreen(coord, playerAbilities);
          engine.recordPlayerAction(false);
          engine.currentTurn = 'opponent';
          set((s) => ({ isAnimating: true, tick: s.tick + 1 }));
        }
        break;
      }
      case AbilityType.RepairKit: {
        const result = executeRepairKit(engine.playerBoard, coord, playerAbilities);
        if (result) {
          engine.recordPlayerAction(false);
          engine.currentTurn = 'opponent';
          set((s) => ({ isAnimating: true, tick: s.tick + 1 }));
        }
        break;
      }
      case AbilityType.ChainShot: {
        const result = executeChainShot(engine.opponentBoard, coord, playerAbilities);
        if (result && result.outcomes.length > 0) {
          applyTraits(result.outcomes);
          fixStaleOutcomes(result.outcomes, engine.opponentBoard);
          const didHit = result.outcomes.some(o => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
          engine.recordPlayerAction(didHit);
          const lastOutcome = result.outcomes[result.outcomes.length - 1];
          engine.currentTurn = 'opponent';
          if (engine.opponentBoard.allShipsSunk()) {
            engine.phase = GamePhase.Finished;
            engine.winner = 'player';
          }
          set((s) => ({ lastShotOutcome: lastOutcome, isAnimating: true, tick: s.tick + 1 }));
        }
        break;
      }
      case AbilityType.Spyglass: {
        const result = executeSpyglass(engine.opponentBoard, coord, playerAbilities);
        if (result) {
          applyTraits([result.shotOutcome]);
          fixStaleOutcomes([result.shotOutcome], engine.opponentBoard);
          const didHit = result.shotOutcome.result === ShotResult.Hit || result.shotOutcome.result === ShotResult.Sink;
          engine.recordPlayerAction(didHit);
          engine.currentTurn = 'opponent';
          if (engine.opponentBoard.allShipsSunk()) {
            engine.phase = GamePhase.Finished;
            engine.winner = 'player';
          }
          set((s) => ({
            lastShotOutcome: result.shotOutcome,
            spyglassResult: { row: coord.row, shipCount: result.rowShipCount },
            isAnimating: true,
            tick: s.tick + 1,
          }));
        }
        break;
      }
      case AbilityType.BoardingParty: {
        const result = executeBoardingParty(engine.opponentBoard, coord, playerAbilities);
        engine.recordPlayerAction(result !== null);
        engine.currentTurn = 'opponent';
        set((s) => ({
          boardingPartyResult: result,
          isAnimating: true,
          tick: s.tick + 1,
        }));
        break;
      }
    }
  },

  setActiveAbility: (type) => set({ activeAbility: type }),

  processAITurn: async () => {
    const { engine, ai, playerTraits, opponentAbilities } = get();
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'opponent') return null;

    // Tick opponent ability cooldowns once per AI turn sequence
    if (opponentAbilities) {
      tickCooldowns(opponentAbilities);
    }

    let lastOutcome: ShotOutcome | null = null;

    // AI keeps shooting while it's still their turn (hits give consecutive shots)
    while (engine.phase === GamePhase.Playing && engine.currentTurn === 'opponent') {
      await new Promise((r) => setTimeout(r, 1200));

      const target = ai.chooseTarget(engine.playerBoard);
      const nimbleForced = playerTraits ? processNimble(target, playerTraits) : false;

      const outcome = engine.opponentShoot(target);
      if (!outcome) break;

      // Nimble: revert hit to miss
      if (nimbleForced && outcome.result !== ShotResult.Miss) {
        const ship = engine.playerBoard.getShipAt(target);
        if (ship) ship.hits.delete(coordKey(target));
        engine.playerBoard.grid[target.row][target.col] = CellState.Miss;
        outcome.result = ShotResult.Miss;
        outcome.sunkShip = undefined;
        engine.currentTurn = 'player';
        engine.turnCount++;
      }

      // Ironclad: deflect hit on Battleship — revert cell to Ship so it stays targetable
      if (!nimbleForced && playerTraits && outcome.result === ShotResult.Hit) {
        const negated = processIronclad(engine.playerBoard, target, playerTraits);
        if (negated) {
          const ship = engine.playerBoard.getShipAt(target);
          if (ship) ship.hits.delete(coordKey(target));
          engine.playerBoard.grid[target.row][target.col] = CellState.Ship;
          outcome.result = ShotResult.Miss;
          outcome.sunkShip = undefined;
          engine.currentTurn = 'player';
          engine.turnCount++;
        }
      }

      ai.notifyResult(target, outcome.result);

      // Spotter trait
      const revealedCells = get().revealedCells;
      const spotterRevealed = processSpotter(
        engine.playerBoard, engine.opponentBoard, target, outcome.result
      );
      for (const c of spotterRevealed) {
        revealedCells.add(`${c.row},${c.col}`);
      }

      lastOutcome = outcome;
      set((s) => ({
        lastShotOutcome: outcome,
        isAnimating: true,
        revealedCells: new Set(revealedCells),
        tick: s.tick + 1,
      }));
    }

    return lastOutcome;
  },

  ambientCreatures: [],

  spawnAmbientCreature: () => {
    const { engine, ambientCreatures } = get();
    if (engine.phase !== GamePhase.Playing) return;
    if (ambientCreatures.length >= 2) return;

    // Pick a random board
    const board: 'player' | 'opponent' = Math.random() < 0.5 ? 'player' : 'opponent';
    const grid = (board === 'player' ? engine.playerBoard : engine.opponentBoard).grid;

    // Find empty cells
    const empty: Coordinate[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === CellState.Empty) {
          // Skip cells that already have a creature
          const already = ambientCreatures.some(
            (cr) => cr.board === board && cr.cell.row === r && cr.cell.col === c
          );
          if (!already) empty.push({ row: r, col: c });
        }
      }
    }
    if (empty.length === 0) return;

    const cell = empty[Math.floor(Math.random() * empty.length)];
    const types: CreatureType[] = ['kraken', 'serpent', 'mermaid'];
    const type = types[Math.floor(Math.random() * types.length)];
    const lifetime = type === 'kraken' ? 6000 : type === 'serpent' ? 8000 : 5000;

    set((s) => ({
      ambientCreatures: [
        ...s.ambientCreatures,
        {
          id: Math.random().toString(36).slice(2),
          type,
          cell,
          board,
          spawnedAt: Date.now(),
          lifetime,
        },
      ],
    }));
  },

  pruneCreatures: () => {
    const now = Date.now();
    set((s) => ({
      ambientCreatures: s.ambientCreatures.filter((c) => now - c.spawnedAt < c.lifetime),
    }));
  },

  setAnimating: (v) => set({ isAnimating: v }),
  switchView: (board) => set({ viewingBoard: board }),

  syncFromMpState: (state) => {
    // Reconstruct local engine from server snapshot.
    // The server is authoritative; we just mirror its state.
    const engine = new GameEngine();
    engine.phase = state.phase === 'placement' ? GamePhase.Placement
      : state.phase === 'playing' ? GamePhase.Playing
      : GamePhase.Finished;
    engine.currentTurn = state.currentTurn === 'self' ? 'player' : 'opponent';
    engine.turnCount = state.turnCount;
    engine.winner = state.winner === 'self' ? 'player' : state.winner === 'opponent' ? 'opponent' : null;

    // Reconstruct own board (full info)
    for (let r = 0; r < state.ownBoard.height; r++) {
      for (let c = 0; c < state.ownBoard.width; c++) {
        const cell = state.ownBoard.cells[r][c];
        engine.playerBoard.grid[r][c] =
          cell === 'hit' ? CellState.Hit :
          cell === 'miss' ? CellState.Miss :
          cell === 'ship' ? CellState.Ship :
          cell === 'land' ? CellState.Land :
          cell === 'land_revealed' ? CellState.LandRevealed :
          CellState.Empty;
      }
    }
    // Rebuild own ships from serialized ships
    engine.playerBoard.ships = state.ownBoard.ships.map((s) => ({
      type: s.type,
      cells: s.cells,
      hits: new Set(s.hits),
    }));

    // Opponent board: only hit/miss visible; sunk ships revealed
    for (let r = 0; r < state.opponentBoard.height; r++) {
      for (let c = 0; c < state.opponentBoard.width; c++) {
        const cell = state.opponentBoard.cells[r][c];
        engine.opponentBoard.grid[r][c] =
          cell === 'hit' ? CellState.Hit :
          cell === 'miss' ? CellState.Miss :
          cell === 'land_revealed' ? CellState.LandRevealed :
          CellState.Empty;
      }
    }
    engine.opponentBoard.ships = state.opponentBoard.sunkShips.map((s) => ({
      type: s.type,
      cells: s.cells,
      hits: new Set(s.hits),
    }));

    set((s) => ({ engine, tick: s.tick + 1 }));
  },

  resetGame: () => {
    set({
      screen: 'menu',
      engine: new GameEngine(),
      ai: new EasyAI(),
      placingShipType: ShipType.Carrier,
      placingOrientation: Orientation.Horizontal,
      placedShips: [],
      lastShotOutcome: null,
      isAnimating: false,
      viewingBoard: 'player',
      mpPlacementSubmitted: false,
      playerAbilities: null,
      opponentAbilities: null,
      activeAbility: null,
      sonarResult: null,
    sonarHistory: [],
    spyglassResult: null,
    boardingPartyResult: null,
    commentary: '',
      ambientCreatures: [],
      revealedCells: new Set(),
      playerTraits: null,
      opponentTraits: null,
      tick: 0,
    });
  },
}));
