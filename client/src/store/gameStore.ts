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
  executeSummonKraken,
  resolveKrakenStrike,
  fixStaleOutcomes,
  createTraitState,
  processSpotter,
  applyDeflectionTrait,
  processDepthCharge,
  resolveDepthChargeShots,
  coordKey,
  CAPTAIN_DEFS,
  DEFAULT_CAPTAIN,
} from '@shared/index';
import type {
  ShipPlacement,
  Coordinate,
  ShotOutcome,
  AIPlayer,
  AbilitySystemState,
  TraitState,
  SonarPingResult,
  KrakenStrikeResult,
  DepthChargeShot,
} from '@shared/index';

export type AppScreen = 'menu' | 'game' | 'setup_ai' | 'guide' | 'dashboard' | 'lobby' | 'leaderboard' | 'campaign' | 'friends' | 'settings' | 'shop' | 'tournaments' | 'clans' | 'replay' | 'spectate' | 'multiplayer';
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

  // Transient deflect markers. Cleared when the next shot fires on the same
  // board. Rendered by BoardGrid, keyed by source so Coastal and Ironclad
  // show visually distinct markers.
  opponentDeflectedCoord: Coordinate | null; // your shot deflected on enemy board
  playerDeflectedCoord: Coordinate | null;   // enemy shot deflected on your board
  opponentDeflectedSource: 'ironclad' | 'coastal' | null;
  playerDeflectedSource: 'ironclad' | 'coastal' | null;

  // Kraken ritual state. Each side tracks turns-remaining; a value > 0 means
  // the caster's turn is consumed by the ritual (no fire, no abilities).
  playerRitualTurnsRemaining: number | null;
  opponentRitualTurnsRemaining: number | null;
  krakenStrikeResult: KrakenStrikeResult | null;

  // Depth Charge UI payload: last Destroyer retaliation (attacker, shots).
  lastDepthCharge: { onBoard: 'player' | 'opponent'; shots: DepthChargeShot[] } | null;

  // MP placement: true after the player has submitted their placements to the server
  mpPlacementSubmitted: boolean;

  // Abilities
  playerAbilities: AbilitySystemState | null;
  opponentAbilities: AbilitySystemState | null;
  selectedCaptain: string;
  activeAbility: AbilityType | null; // ability being targeted this turn
  sonarResult: SonarPingResult | null;
  spAbilitiesUsed: Record<string, number>; // single-player ability usage count
  sonarHistory: { center: Coordinate; shipDetected: boolean; revealedShipCells: Coordinate[] }[];
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

  // Captain selection (pre-match)
  setSelectedCaptain: (id: string) => void;

  // Placement actions
  selectShipToPlace: (type: ShipType) => void;
  rotateShip: () => void;
  placeShip: (start: Coordinate) => boolean;
  autoPlaceShips: () => void;
  confirmPlacement: () => boolean;

  // Firing actions
  playerFire: (coord: Coordinate) => ShotOutcome | null;
  summonKraken: () => boolean;
  advancePlayerRitual: () => boolean;
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

  opponentDeflectedCoord: null,
  playerDeflectedCoord: null,
  opponentDeflectedSource: null,
  playerDeflectedSource: null,

  playerRitualTurnsRemaining: null,
  opponentRitualTurnsRemaining: null,
  krakenStrikeResult: null,
  lastDepthCharge: null,

  playerAbilities: null,
  opponentAbilities: null,
  selectedCaptain: DEFAULT_CAPTAIN,
  activeAbility: null,
  sonarResult: null,
    sonarHistory: [],
    spyglassResult: null,
    boardingPartyResult: null,
    commentary: '',
  revealedCells: new Set(),
  spAbilitiesUsed: {},

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
      opponentDeflectedCoord: null,
      opponentDeflectedSource: null,
      playerDeflectedCoord: null,
      playerDeflectedSource: null,
      playerRitualTurnsRemaining: null,
      opponentRitualTurnsRemaining: null,
      krakenStrikeResult: null,
      lastDepthCharge: null,
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
      spAbilitiesUsed: {},
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
      opponentDeflectedCoord: null,
      opponentDeflectedSource: null,
      playerDeflectedCoord: null,
      playerDeflectedSource: null,
      playerRitualTurnsRemaining: null,
      opponentRitualTurnsRemaining: null,
      krakenStrikeResult: null,
      lastDepthCharge: null,
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
      spAbilitiesUsed: {},
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
      opponentDeflectedCoord: null,
      opponentDeflectedSource: null,
      playerDeflectedCoord: null,
      playerDeflectedSource: null,
      playerRitualTurnsRemaining: null,
      opponentRitualTurnsRemaining: null,
      krakenStrikeResult: null,
      lastDepthCharge: null,
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
      spAbilitiesUsed: {},
      tick: 0,
    });
  },

  setSelectedCaptain: (id) => set({ selectedCaptain: id }),

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
    const { engine, ai, selectedCaptain, gameMode } = get();
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

    const captainAbilities = [...(CAPTAIN_DEFS[selectedCaptain]?.abilities ?? CAPTAIN_DEFS[DEFAULT_CAPTAIN].abilities)];
    const playerAbilities = createAbilitySystemState(captainAbilities);
    const allAbilities = Object.values(AbilityType);
    const shuffled = allAbilities.sort(() => Math.random() - 0.5);
    const opponentAbilities = createAbilitySystemState(shuffled.slice(0, 3));

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
    const { engine, isAnimating, opponentTraits, playerAbilities, playerRitualTurnsRemaining } = get();
    if (isAnimating) return null;
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'player') return null;
    // Ritual in progress — caster cannot fire. (UI should not allow this but
    // we guard anyway.)
    if (playerRitualTurnsRemaining && playerRitualTurnsRemaining > 0) return null;

    // Fire normally through the engine
    const outcome = engine.playerShoot(coord);
    if (!outcome) return null;

    // Unified deflection: Coastal Cover > Ironclad (see applyDeflectionTrait).
    // Revert the grid to Ship so the cell stays targetable on a future turn.
    let deflectedHere: Coordinate | null = null;
    let deflectedSource: 'ironclad' | 'coastal' | null = null;
    if (opponentTraits && outcome.result === ShotResult.Hit) {
      const source = applyDeflectionTrait(engine.opponentBoard, coord, opponentTraits);
      if (source) {
        const ship = engine.opponentBoard.getShipAt(coord);
        if (ship) ship.hits.delete(coordKey(coord));
        engine.opponentBoard.grid[coord.row][coord.col] = CellState.Ship;
        outcome.result = ShotResult.Miss;
        outcome.sunkShip = undefined;
        outcome.deflected = true;
        outcome.deflectionSource = source;
        deflectedHere = coord;
        deflectedSource = source;
        engine.currentTurn = 'opponent';
      }
    }

    // Depth Charge retaliation: if the shot hit the OPPONENT's Destroyer for
    // the first time, the Destroyer fires 6 retaliatory shots at the PLAYER's
    // board. (Undeflected hits only — a deflected cell is not a true hit.)
    let depthChargePayload: DepthChargeShot[] | null = null;
    const hitLanded = outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink;
    if (opponentTraits && hitLanded) {
      const triggered = processDepthCharge(engine.opponentBoard, coord, opponentTraits);
      if (triggered) {
        depthChargePayload = resolveDepthChargeShots(engine.playerBoard, 6);
        outcome.depthChargeShots = depthChargePayload;
      }
    }

    // Record action for accuracy tracking (after trait processing)
    engine.recordPlayerAction(outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink);

    if (playerAbilities) {
      tickCooldowns(playerAbilities);
    }

    set((s) => ({
      lastShotOutcome: outcome,
      isAnimating: true,
      opponentDeflectedCoord: deflectedHere,
      opponentDeflectedSource: deflectedSource,
      lastDepthCharge: depthChargePayload
        ? { onBoard: 'player', shots: depthChargePayload }
        : null,
      tick: s.tick + 1,
    }));
    return outcome;
  },

  useAbility: (type, coord) => {
    const { engine, isAnimating, playerAbilities, opponentTraits, playerRitualTurnsRemaining } = get();
    if (isAnimating || !playerAbilities) return;
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'player') return;
    if (playerRitualTurnsRemaining && playerRitualTurnsRemaining > 0) return;
    if (!canUseAbility(playerAbilities, type)) return;
    // SummonKraken has its own dedicated action (summonKraken) because it
    // doesn't take a coordinate and starts a multi-turn ritual.
    if (type === AbilityType.SummonKraken) return;
    playAbilityActivate();

    // Track ability usage for post-game summary (single-player only)
    set((s) => ({ spAbilitiesUsed: { ...s.spAbilitiesUsed, [type]: (s.spAbilitiesUsed[type] ?? 0) + 1 } }));

    // Apply Ironclad/Nimble traits to ability-based shots (same as playerFire).
    // Returns the last coord where Ironclad deflected a hit, if any — the
    // caller uses it to pin the ricochet marker on the enemy board.
    const applyTraits = (outcomes: ShotOutcome[]): { deflected: Coordinate | null; deflectedSource: 'ironclad' | 'coastal' | null; depthCharge: DepthChargeShot[] | null } => {
      if (!opponentTraits) return { deflected: null, deflectedSource: null, depthCharge: null };
      let deflected: Coordinate | null = null;
      let deflectedSource: 'ironclad' | 'coastal' | null = null;
      let depthCharge: DepthChargeShot[] | null = null;
      for (const outcome of outcomes) {
        const c = outcome.coordinate;
        if (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink) {
          // Unified Coastal/Ironclad deflection
          if (outcome.result === ShotResult.Hit) {
            const source = applyDeflectionTrait(engine.opponentBoard, c, opponentTraits);
            if (source) {
              const ship = engine.opponentBoard.getShipAt(c);
              if (ship) ship.hits.delete(coordKey(c));
              engine.opponentBoard.grid[c.row][c.col] = CellState.Ship;
              outcome.result = ShotResult.Miss;
              outcome.sunkShip = undefined;
              outcome.deflected = true;
              outcome.deflectionSource = source;
              deflected = c;
              deflectedSource = source;
              continue; // deflected shots do not trigger Depth Charge
            }
          }
          // Depth Charge retaliation (only the first Destroyer hit in this
          // batch fires, per processDepthCharge's one-shot guard).
          if (!depthCharge && processDepthCharge(engine.opponentBoard, c, opponentTraits)) {
            depthCharge = resolveDepthChargeShots(engine.playerBoard, 6);
            outcome.depthChargeShots = depthCharge;
          }
        }
      }
      return { deflected, deflectedSource, depthCharge };
    };

    switch (type) {
      case AbilityType.CannonBarrage: {
        const result = executeCannonBarrage(engine.opponentBoard, coord, playerAbilities);
        if (result && result.outcomes.length > 0) {
          const traitsResult = applyTraits(result.outcomes);
          fixStaleOutcomes(result.outcomes, engine.opponentBoard);
          const didHit = result.outcomes.some(o => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
          engine.recordPlayerAction(didHit);
          const lastOutcome = result.outcomes[result.outcomes.length - 1];
          engine.currentTurn = 'opponent';
          if (engine.opponentBoard.allShipsSunk()) {
            engine.phase = GamePhase.Finished;
            engine.winner = 'player';
          }
          set((s) => ({
            lastShotOutcome: lastOutcome,
            isAnimating: true,
            opponentDeflectedCoord: traitsResult.deflected,
            opponentDeflectedSource: traitsResult.deflectedSource,
            lastDepthCharge: traitsResult.depthCharge
              ? { onBoard: 'player', shots: traitsResult.depthCharge }
              : null,
            tick: s.tick + 1,
          }));
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
            sonarHistory: [
              ...s.sonarHistory,
              {
                center: coord,
                shipDetected: result.shipDetected,
                revealedShipCells: result.revealedShipCells,
              },
            ],
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
          const traitsResult = applyTraits(result.outcomes);
          fixStaleOutcomes(result.outcomes, engine.opponentBoard);
          const didHit = result.outcomes.some(o => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
          engine.recordPlayerAction(didHit);
          const lastOutcome = result.outcomes[result.outcomes.length - 1];
          engine.currentTurn = 'opponent';
          if (engine.opponentBoard.allShipsSunk()) {
            engine.phase = GamePhase.Finished;
            engine.winner = 'player';
          }
          set((s) => ({
            lastShotOutcome: lastOutcome,
            isAnimating: true,
            opponentDeflectedCoord: traitsResult.deflected,
            opponentDeflectedSource: traitsResult.deflectedSource,
            lastDepthCharge: traitsResult.depthCharge
              ? { onBoard: 'player', shots: traitsResult.depthCharge }
              : null,
            tick: s.tick + 1,
          }));
        }
        break;
      }
      case AbilityType.Spyglass: {
        const result = executeSpyglass(engine.opponentBoard, coord, playerAbilities);
        if (result) {
          const traitsResult = applyTraits([result.shotOutcome]);
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
            opponentDeflectedCoord: traitsResult.deflected,
            opponentDeflectedSource: traitsResult.deflectedSource,
            lastDepthCharge: traitsResult.depthCharge
              ? { onBoard: 'player', shots: traitsResult.depthCharge }
              : null,
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

  /**
   * Start the Kraken summoning ritual (Seawitch). Caster forfeits their next
   * 2 own-turns; on the 3rd own-turn the Kraken strikes.
   */
  summonKraken: () => {
    const { engine, playerAbilities, playerRitualTurnsRemaining } = get();
    if (!playerAbilities) return false;
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'player') return false;
    if (playerRitualTurnsRemaining && playerRitualTurnsRemaining > 0) return false;
    const ritual = executeSummonKraken(playerAbilities);
    if (!ritual) return false;
    playAbilityActivate();
    // Ritual start consumes this turn — switch to opponent immediately.
    // Do NOT set isAnimating here; the ritual-driving useEffect in GameScene
    // drives the full lifecycle based on turn + ritualTurns transitions and
    // uses isAnimating only during AI shot animation.
    engine.currentTurn = 'opponent';
    engine.turnCount++;
    set((s) => ({
      playerRitualTurnsRemaining: ritual.turnsRemaining,
      spAbilitiesUsed: { ...s.spAbilitiesUsed, [AbilityType.SummonKraken]: (s.spAbilitiesUsed[AbilityType.SummonKraken] ?? 0) + 1 },
      tick: s.tick + 1,
    }));
    return true;
  },

  /**
   * Advance the player's Kraken ritual by one turn. Called by the ritual-
   * driving useEffect in GameScene when it's the player's turn AND a ritual
   * is in progress — they cannot fire, so we consume the turn here. When
   * turns reach 0 the Kraken strikes.
   *
   * Returns true if a tick occurred (turn consumed).
   */
  advancePlayerRitual: () => {
    const { engine, playerRitualTurnsRemaining } = get();
    if (engine.phase !== GamePhase.Playing) return false;
    if (engine.currentTurn !== 'player') return false;
    if (!playerRitualTurnsRemaining || playerRitualTurnsRemaining <= 0) return false;

    const remaining = playerRitualTurnsRemaining - 1;
    if (remaining > 0) {
      engine.currentTurn = 'opponent';
      engine.turnCount++;
      set((s) => ({
        playerRitualTurnsRemaining: remaining,
        tick: s.tick + 1,
      }));
      return true;
    }
    // Ritual completes — resolve strike with Cruiser ward
    const strike = resolveKrakenStrike(engine.opponentBoard, new Set([ShipType.Cruiser]));
    engine.currentTurn = 'opponent';
    engine.turnCount++;
    if (engine.opponentBoard.allShipsSunk()) {
      engine.phase = GamePhase.Finished;
      engine.winner = 'player';
    }
    set((s) => ({
      playerRitualTurnsRemaining: null,
      krakenStrikeResult: strike,
      tick: s.tick + 1,
    }));
    return true;
  },

  processAITurn: async () => {
    const { engine, ai, playerTraits, opponentAbilities, opponentRitualTurnsRemaining } = get();
    if (engine.phase !== GamePhase.Playing || engine.currentTurn !== 'opponent') return null;

    // Tick opponent ability cooldowns once per AI turn sequence
    if (opponentAbilities) {
      tickCooldowns(opponentAbilities);
    }

    // Helper: execute an AI-picked ability. Mirrors the player-side
    // `useAbility` flow but with swapped sides (AI attacks playerBoard,
    // defends on opponentBoard). Returns true if the ability fired.
    const aiExecuteAbility = (choice: { type: AbilityType; coord: Coordinate }): boolean => {
      if (!opponentAbilities) return false;
      const targetBoard = engine.playerBoard;
      const ownBoard = engine.opponentBoard;

      const applyPlayerTraits = (outcomes: ShotOutcome[]) => {
        let deflected: Coordinate | null = null;
        let deflectedSource: 'ironclad' | 'coastal' | null = null;
        let depthCharge: DepthChargeShot[] | null = null;
        if (!playerTraits) return { deflected, deflectedSource, depthCharge };
        for (const outcome of outcomes) {
          const c = outcome.coordinate;
          if (outcome.result === ShotResult.Hit) {
            const source = applyDeflectionTrait(targetBoard, c, playerTraits);
            if (source) {
              const ship = targetBoard.getShipAt(c);
              if (ship) ship.hits.delete(coordKey(c));
              targetBoard.grid[c.row][c.col] = CellState.Ship;
              outcome.result = ShotResult.Miss;
              outcome.sunkShip = undefined;
              outcome.deflected = true;
              outcome.deflectionSource = source;
              deflected = c;
              deflectedSource = source;
              continue;
            }
          }
          if (
            !depthCharge &&
            (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink) &&
            processDepthCharge(targetBoard, c, playerTraits)
          ) {
            depthCharge = resolveDepthChargeShots(ownBoard, 6);
            outcome.depthChargeShots = depthCharge;
          }
        }
        return { deflected, deflectedSource, depthCharge };
      };

      const finishOffensive = (outcomes: ShotOutcome[], lastOutcome: ShotOutcome) => {
        const traitsResult = applyPlayerTraits(outcomes);
        fixStaleOutcomes(outcomes, targetBoard);
        const didHit = outcomes.some((o) => o.result === ShotResult.Hit || o.result === ShotResult.Sink);
        engine.recordOpponentAction(didHit);
        engine.currentTurn = 'player';
        engine.turnCount++;
        if (targetBoard.allShipsSunk()) {
          engine.phase = GamePhase.Finished;
          engine.winner = 'opponent';
        }
        set((s) => ({
          lastShotOutcome: lastOutcome,
          isAnimating: true,
          playerDeflectedCoord: traitsResult.deflected,
          playerDeflectedSource: traitsResult.deflectedSource,
          lastDepthCharge: traitsResult.depthCharge
            ? { onBoard: 'opponent', shots: traitsResult.depthCharge }
            : null,
          tick: s.tick + 1,
        }));
      };

      switch (choice.type) {
        case AbilityType.CannonBarrage: {
          const result = executeCannonBarrage(targetBoard, choice.coord, opponentAbilities);
          if (!result || result.outcomes.length === 0) return false;
          finishOffensive(result.outcomes, result.outcomes[result.outcomes.length - 1]);
          return true;
        }
        case AbilityType.ChainShot: {
          const result = executeChainShot(targetBoard, choice.coord, opponentAbilities);
          if (!result || result.outcomes.length === 0) return false;
          finishOffensive(result.outcomes, result.outcomes[result.outcomes.length - 1]);
          return true;
        }
        case AbilityType.Spyglass: {
          const result = executeSpyglass(targetBoard, choice.coord, opponentAbilities);
          if (!result) return false;
          finishOffensive([result.shotOutcome], result.shotOutcome);
          return true;
        }
        case AbilityType.SonarPing: {
          const result = executeSonarPing(targetBoard, choice.coord, opponentAbilities);
          if (!result) return false;
          engine.recordOpponentAction(result.shipDetected);
          engine.currentTurn = 'player';
          engine.turnCount++;
          set((s) => ({ isAnimating: true, tick: s.tick + 1 }));
          return true;
        }
        case AbilityType.SmokeScreen: {
          const ok = executeSmokeScreen(choice.coord, opponentAbilities);
          if (!ok) return false;
          engine.recordOpponentAction(false);
          engine.currentTurn = 'player';
          engine.turnCount++;
          set((s) => ({ isAnimating: true, tick: s.tick + 1 }));
          return true;
        }
        case AbilityType.RepairKit: {
          const result = executeRepairKit(ownBoard, choice.coord, opponentAbilities);
          if (!result) return false;
          engine.recordOpponentAction(false);
          engine.currentTurn = 'player';
          engine.turnCount++;
          set((s) => ({ isAnimating: true, tick: s.tick + 1 }));
          return true;
        }
        case AbilityType.BoardingParty: {
          const result = executeBoardingParty(targetBoard, choice.coord, opponentAbilities);
          engine.recordOpponentAction(result !== null);
          engine.currentTurn = 'player';
          engine.turnCount++;
          set((s) => ({ isAnimating: true, tick: s.tick + 1 }));
          return true;
        }
        case AbilityType.SummonKraken: {
          const ritual = executeSummonKraken(opponentAbilities);
          if (!ritual) return false;
          engine.currentTurn = 'player';
          engine.turnCount++;
          set((s) => ({
            opponentRitualTurnsRemaining: ritual.turnsRemaining,
            isAnimating: true,
            tick: s.tick + 1,
          }));
          return true;
        }
      }
      return false;
    };

    // If the AI is in the middle of a Kraken ritual, it forfeits this turn.
    // Decrement and either continue ritual or resolve the strike.
    if (opponentRitualTurnsRemaining && opponentRitualTurnsRemaining > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      const remaining = opponentRitualTurnsRemaining - 1;
      if (remaining > 0) {
        engine.currentTurn = 'player';
        engine.turnCount++;
        set((s) => ({ opponentRitualTurnsRemaining: remaining, isAnimating: true, tick: s.tick + 1 }));
        return null;
      }
      // Ritual complete — resolve the strike with Cruiser ward
      const strike = resolveKrakenStrike(engine.playerBoard, new Set([ShipType.Cruiser]));
      engine.currentTurn = 'player';
      engine.turnCount++;
      // Check for Finished phase in case the Kraken sinks the last non-Cruiser ship
      if (engine.playerBoard.allShipsSunk()) {
        engine.phase = GamePhase.Finished;
        engine.winner = 'opponent';
      }
      set((s) => ({
        opponentRitualTurnsRemaining: null,
        krakenStrikeResult: strike,
        isAnimating: true,
        tick: s.tick + 1,
      }));
      return null;
    }

    let lastOutcome: ShotOutcome | null = null;

    // AI keeps shooting while it's still their turn (hits give consecutive shots)
    while (engine.phase === GamePhase.Playing && engine.currentTurn === 'opponent') {
      await new Promise((r) => setTimeout(r, 1200));

      // ─── AI ability pick ─────────────────────────────────────────────────
      // Let the AI (Medium/Hard) decide whether to use an ability this turn
      // instead of firing a normal shot. Easy's pickAbility is undefined.
      if (ai.pickAbility && opponentAbilities) {
        const available = opponentAbilities.abilityStates
          .filter((a) => canUseAbility(opponentAbilities, a.type))
          .map((a) => a.type);
        const choice = ai.pickAbility(engine.opponentBoard, engine.playerBoard, available);
        if (choice && aiExecuteAbility(choice)) {
          // Ability ends the AI's current action. The ritual driver / next
          // loop iteration will take over from here.
          break;
        }
      }

      const target = ai.chooseTarget(engine.playerBoard);

      const outcome = engine.opponentShoot(target);
      if (!outcome) break;

      // Unified deflection: Coastal Cover > Ironclad (applyDeflectionTrait)
      let aiDeflectedCoord: Coordinate | null = null;
      let aiDeflectedSource: 'ironclad' | 'coastal' | null = null;
      if (playerTraits && outcome.result === ShotResult.Hit) {
        const source = applyDeflectionTrait(engine.playerBoard, target, playerTraits);
        if (source) {
          const ship = engine.playerBoard.getShipAt(target);
          if (ship) ship.hits.delete(coordKey(target));
          engine.playerBoard.grid[target.row][target.col] = CellState.Ship;
          outcome.result = ShotResult.Miss;
          outcome.sunkShip = undefined;
          outcome.deflected = true;
          outcome.deflectionSource = source;
          aiDeflectedCoord = target;
          aiDeflectedSource = source;
          engine.currentTurn = 'player';
          engine.turnCount++;
        }
      }

      // Depth Charge retaliation: AI hit player's Destroyer → retaliate on
      // the opponent's (AI) board. (The AI doesn't react in strategy, but
      // the damage is real.)
      let aiDepthCharge: DepthChargeShot[] | null = null;
      if (
        playerTraits &&
        !outcome.deflected &&
        (outcome.result === ShotResult.Hit || outcome.result === ShotResult.Sink)
      ) {
        const triggered = processDepthCharge(engine.playerBoard, target, playerTraits);
        if (triggered) {
          aiDepthCharge = resolveDepthChargeShots(engine.opponentBoard, 6);
          outcome.depthChargeShots = aiDepthCharge;
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
        playerDeflectedCoord: aiDeflectedCoord,
        playerDeflectedSource: aiDeflectedSource,
        lastDepthCharge: aiDepthCharge
          ? { onBoard: 'opponent', shots: aiDepthCharge }
          : null,
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

    // Rematch reset: when a fresh placement phase arrives with no server-side
    // ships for the player, the previous game's placement state (placedShips,
    // mpPlacementSubmitted) must be cleared — otherwise ShipTray keeps showing
    // "Awaiting opponent..." because mpPlacementSubmitted is still true from
    // the prior game and the "Ready for Battle" button never re-renders.
    if (state.phase === 'placement' && state.ownBoard.ships.length === 0) {
      set((s) => ({
        engine,
        placedShips: [],
        mpPlacementSubmitted: false,
        placingShipType: ShipType.Carrier,
        placingOrientation: Orientation.Horizontal,
        tick: s.tick + 1,
      }));
    } else {
      set((s) => ({ engine, tick: s.tick + 1 }));
    }
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
      spAbilitiesUsed: {},
      tick: 0,
    });
  },
}));
