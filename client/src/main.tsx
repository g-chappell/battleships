import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ---------------------------------------------------------------------------
// E2E test bridge — only in DEV builds (tree-shaken from production).
// Exposes window.__ironclad so Playwright tests can drive game state without
// needing to click WebGL canvas cells.
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  import('./store/gameStore').then(({ useGameStore }) => {
    type IroncladBridge = {
      isReady: () => boolean;
      getPhase: () => string;
      getTurnCount: () => number;
      getOpponentShipsRemaining: () => number;
      getPlayerShipsRemaining: () => number;
      getWinner: () => string | null;
      getAccuracy: () => number;
      getOpponentShipsSunk: () => number;
      isAnimating: () => boolean;
      isPlayerTurn: () => boolean;
      fireAndAdvance: (row: number, col: number) => { result: string; sunkShip: string | null } | null;
      // ── Ability testing helpers (TASK-049) ────────────────────────────────
      /** Replace playerAbilities with all 7 ability types, zero cooldown, unlimited uses. */
      injectAllAbilities: () => void;
      /** Reset all ability cooldowns to 0 and restore exhausted uses to unlimited. */
      resetAbilityCooldowns: () => void;
      /**
       * Use an ability at (row, col) and synchronously advance through AI turns.
       * `type` is the AbilityType string value (e.g. 'cannon_barrage').
       */
      useAbilityAndAdvance: (type: string, row: number, col: number) => { applied: boolean };
      /** Return hit/action/sunk counts from the engine for assertion. */
      getEngineStats: () => { hits: number; actions: number; sunk: number };
      /** Return all opponent ship cells with hit status (serializable for page.evaluate). */
      getOpponentShipCells: () => Array<{ row: number; col: number; shipType: string; isHit: boolean }>;
      /**
       * Directly damage one cell of a player ship (for RepairKit precondition).
       * Returns the damaged cell coords, or null if no undamaged ship cell found.
       */
      damagePlayerShip: () => { row: number; col: number } | null;
    };

    const bridge: IroncladBridge = {
      isReady: () => true,

      getPhase: () => useGameStore.getState().engine.phase,

      getTurnCount: () => useGameStore.getState().engine.turnCount,

      getOpponentShipsRemaining: () =>
        useGameStore.getState().engine.getOpponentShipsRemaining(),

      getPlayerShipsRemaining: () =>
        useGameStore.getState().engine.getPlayerShipsRemaining(),

      getWinner: () => useGameStore.getState().engine.winner,

      getAccuracy: () => useGameStore.getState().engine.getPlayerShotAccuracy(),

      getOpponentShipsSunk: () => {
        const { engine } = useGameStore.getState();
        return engine.getSunkShipTypes(engine.opponentBoard).length;
      },

      isAnimating: () => useGameStore.getState().isAnimating,

      isPlayerTurn: () => useGameStore.getState().engine.currentTurn === 'player',

      /**
       * Fire at an opponent cell and synchronously advance through the AI turn
       * (no animation delays). Returns the shot outcome or null if the shot
       * couldn't be taken (wrong phase, already shot, etc.).
       */
      fireAndAdvance: (row: number, col: number) => {
        const state = useGameStore.getState();

        if (
          state.engine.phase !== 'playing' ||
          state.engine.currentTurn !== 'player' ||
          state.isAnimating
        ) {
          return null;
        }

        // Player fires — this sets isAnimating: true and updates engine state
        const outcome = state.playerFire({ row, col });
        if (!outcome) {
          // Cell was invalid (land, already shot) — clear any stale animating flag
          useGameStore.setState((s) => ({ isAnimating: false, tick: s.tick + 1 }));
          return null;
        }

        // Immediately clear animation lock so AI turn + next player shot can proceed
        useGameStore.setState((s) => ({ isAnimating: false, tick: s.tick + 1 }));

        // Run AI turns synchronously (skip animation delays)
        const { engine, ai } = useGameStore.getState();
        while (engine.phase === 'playing' && engine.currentTurn === 'opponent') {
          const target = ai.chooseTarget(engine.playerBoard);
          const aiOutcome = engine.opponentShoot(target);
          if (!aiOutcome) break;
          ai.notifyResult(target, aiOutcome.result);
          useGameStore.setState((s) => ({
            lastShotOutcome: aiOutcome,
            isAnimating: false,
            tick: s.tick + 1,
          }));
        }

        // Final tick to ensure React re-renders with the latest engine state
        useGameStore.setState((s) => ({ isAnimating: false, tick: s.tick + 1 }));

        return { result: outcome.result, sunkShip: outcome.sunkShip ?? null };
      },

      // ── Ability testing helpers ─────────────────────────────────────────

      injectAllAbilities: () => {
        // String values matching AbilityType enum
        const allAbilityTypes = [
          'cannon_barrage',
          'sonar_ping',
          'smoke_screen',
          'repair_kit',
          'chain_shot',
          'spyglass',
          'boarding_party',
        ] as const;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const abilities: any = {
          selectedAbilities: [...allAbilityTypes],
          abilityStates: allAbilityTypes.map((type) => ({
            type,
            cooldownRemaining: 0,
            usesRemaining: -1, // -1 = unlimited
          })),
          smokeZones: [],
        };
        useGameStore.setState((s) => ({ playerAbilities: abilities, tick: s.tick + 1 }));
      },

      resetAbilityCooldowns: () => {
        const { playerAbilities } = useGameStore.getState();
        if (!playerAbilities) return;
        for (const a of playerAbilities.abilityStates) {
          a.cooldownRemaining = 0;
          // Restore exhausted one-use abilities (usesRemaining === 0)
          if (a.usesRemaining === 0) {
            a.usesRemaining = -1;
          }
        }
        useGameStore.setState((s) => ({ tick: s.tick + 1 }));
      },

      useAbilityAndAdvance: (type: string, row: number, col: number): { applied: boolean } => {
        const state = useGameStore.getState();
        if (
          state.engine.phase !== 'playing' ||
          state.engine.currentTurn !== 'player' ||
          state.isAnimating
        ) {
          return { applied: false };
        }

        // Call the store action (type cast: AbilityType is a string enum, values match)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state.useAbility(type as any, { row, col });

        // Clear animation lock immediately
        useGameStore.setState((s) => ({ isAnimating: false, tick: s.tick + 1 }));

        // Run AI turns synchronously (skip animation delays)
        const { engine, ai } = useGameStore.getState();
        while (engine.phase === 'playing' && engine.currentTurn === 'opponent') {
          const target = ai.chooseTarget(engine.playerBoard);
          const aiOutcome = engine.opponentShoot(target);
          if (!aiOutcome) break;
          ai.notifyResult(target, aiOutcome.result);
          useGameStore.setState((s) => ({
            lastShotOutcome: aiOutcome,
            isAnimating: false,
            tick: s.tick + 1,
          }));
        }

        useGameStore.setState((s) => ({ isAnimating: false, tick: s.tick + 1 }));
        return { applied: true };
      },

      getEngineStats: () => {
        const { engine } = useGameStore.getState();
        return {
          hits: engine.totalPlayerHits,
          actions: engine.totalPlayerActions,
          sunk: engine.getSunkShipTypes(engine.opponentBoard).length,
        };
      },

      getOpponentShipCells: () => {
        const { engine } = useGameStore.getState();
        const cells: Array<{ row: number; col: number; shipType: string; isHit: boolean }> = [];
        for (const ship of engine.opponentBoard.ships) {
          for (const cell of ship.cells) {
            const key = `${cell.row},${cell.col}`;
            cells.push({
              row: cell.row,
              col: cell.col,
              shipType: ship.type,
              isHit: ship.hits.has(key),
            });
          }
        }
        return cells;
      },

      damagePlayerShip: (): { row: number; col: number } | null => {
        const { engine } = useGameStore.getState();
        for (const ship of engine.playerBoard.ships) {
          for (const cell of ship.cells) {
            const key = `${cell.row},${cell.col}`;
            if (!ship.hits.has(key) && engine.playerBoard.isValidTarget(cell)) {
              // receiveShot marks the cell as Hit and adds to ship.hits
              engine.playerBoard.receiveShot(cell);
              useGameStore.setState((s) => ({ tick: s.tick + 1 }));
              return { row: cell.row, col: cell.col };
            }
          }
        }
        return null;
      },
    };

    (window as Window & { __ironclad?: IroncladBridge }).__ironclad = bridge;
  });
}
