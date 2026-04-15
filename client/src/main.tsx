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
    };

    (window as Window & { __ironclad?: IroncladBridge }).__ironclad = bridge;
  });
}
