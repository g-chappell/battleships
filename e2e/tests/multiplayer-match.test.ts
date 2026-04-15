/**
 * TASK-050: E2E test — full multiplayer match across two browser contexts.
 *
 * Flow:
 *  1. Register two users via REST API
 *  2. Open two browser contexts (page1 = player 1, page2 = player 2)
 *  3. Inject auth credentials into each context
 *  4. Navigate both to the Multiplayer lobby → sockets connect
 *  5. Both join quick matchmaking → server pairs them
 *  6. Both auto-place ships → player 2's ship cells are read before submitting
 *  7. Both confirm placement → game transitions to Playing phase
 *  8. Player 1 fires at all 17 of player 2's ship cells (all hits → keeps turn)
 *  9. Assert both sides see correct outcome (Victory / Defeat) + accuracy + sunk count
 * 10. Rematch: both click Rematch → new Placement phase begins; player 2 resigns
 * 11. Assert player 1 wins the rematch
 *
 * The window.__ironclad bridge (injected by main.tsx in DEV mode) exposes
 * multiplayer-specific helpers: injectAuth, getOwnShipCells, fireViaSocket,
 * resignViaSocket, requestRematchViaSocket, getMultiplayerState.
 */

import { test, expect, type Page } from '../fixtures';
import { type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the test bridge to be available and ready. */
async function waitForBridge(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__ironclad !== 'undefined' && window.__ironclad!.isReady(),
    { timeout: 15_000 },
  );
}

/** Register a fresh user via the REST API and return credentials. */
async function registerUser(
  request: APIRequestContext,
): Promise<{ token: string; user: { id: string; email: string; username: string } }> {
  const suffix = randomUUID().slice(0, 8);
  const res = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: `e2e_mp_${suffix}@test.invalid`,
      username: `e2e_mp_${suffix}`,
      password: 'TestPass1!',
    },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`registerUser failed (${res.status()}): ${body}`);
  }
  return res.json() as Promise<{ token: string; user: { id: string; email: string; username: string } }>;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test(
  'two registered users play a full multiplayer match and rematch',
  async ({ browser, request }) => {
    test.setTimeout(120_000);
    // ── 1. Register two users ─────────────────────────────────────────────
    const [body1, body2] = await Promise.all([
      registerUser(request),
      registerUser(request),
    ]);

    // ── 2. Create two isolated browser contexts ───────────────────────────
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // ── 3. Navigate both to the app ─────────────────────────────────────
      await Promise.all([page1.goto('/'), page2.goto('/')]);

      // ── 4. Wait for bridge on both pages ─────────────────────────────────
      await Promise.all([waitForBridge(page1), waitForBridge(page2)]);

      // ── 5. Inject auth credentials ────────────────────────────────────────
      await page1.evaluate(
        ({ token, user }) => window.__ironclad!.injectAuth(token, JSON.stringify(user)),
        { token: body1.token, user: body1.user },
      );
      await page2.evaluate(
        ({ token, user }) => window.__ironclad!.injectAuth(token, JSON.stringify(user)),
        { token: body2.token, user: body2.user },
      );

      // ── 6. Wait for main menu, then navigate to lobby ─────────────────────
      await Promise.all([
        expect(page1.getByTestId('main-menu')).toBeVisible({ timeout: 10_000 }),
        expect(page2.getByTestId('main-menu')).toBeVisible({ timeout: 10_000 }),
      ]);

      // Clicking Multiplayer navigates to the lobby and triggers socket connect
      await page1.getByTestId('btn-multiplayer').click();
      await page2.getByTestId('btn-multiplayer').click();

      // ── 7. Wait for socket to connect on both pages ───────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getMultiplayerState()?.socketStatus === 'connected',
        { timeout: 15_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getMultiplayerState()?.socketStatus === 'connected',
        { timeout: 15_000 },
      );

      // ── 8. Both click "Find Opponent" to join matchmaking ─────────────────
      await page1.getByTestId('btn-find-opponent').click();
      await page2.getByTestId('btn-find-opponent').click();

      // ── 9. Wait for both to reach the Placement phase ─────────────────────
      // MultiplayerLobby's useEffect calls startMultiplayerGame() when matched,
      // which transitions screen → 'game' with engine.phase = 'placement'.
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'placement',
        { timeout: 30_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'placement',
        { timeout: 30_000 },
      );

      // ── 10. Auto-place ships on both boards ───────────────────────────────
      await page1.getByTestId('btn-auto-place').click();
      await page2.getByTestId('btn-auto-place').click();

      // ── 11. Read player 2's ship cells BEFORE confirming placement ─────────
      // engine.playerBoard.ships is populated by autoPlaceShips(). Read it now
      // while mpPlacementSubmitted is still false (syncFromMpState not yet run).
      const p2ShipCells = await page2.evaluate(() => window.__ironclad!.getOwnShipCells());
      expect(p2ShipCells.length).toBe(17); // 5+4+3+3+2 = 17 total ship cells

      // ── 12. Both confirm placement ────────────────────────────────────────
      await page1.getByTestId('btn-ready').click();
      await page2.getByTestId('btn-ready').click();

      // ── 13. Wait for Playing phase on both pages ──────────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'playing',
        { timeout: 30_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'playing',
        { timeout: 30_000 },
      );

      // ── 14. Read player 1's water cells for player 2's guaranteed-miss shots ──
      // 'empty' cells on player 1's ownBoard are water (not ship, not land).
      // Passing them to player 2's loop guarantees misses → turn switch to player 1.
      // This handles the case where the server assigns player 2 the first turn.
      const p1WaterCells = await page1.evaluate(() => {
        const gs = window.__ironclad?.getMultiplayerState()?.gameState;
        if (!gs) return [] as Array<{ row: number; col: number }>;
        const result: Array<{ row: number; col: number }> = [];
        for (let r = 0; r < gs.ownBoard.cells.length; r++) {
          for (let c = 0; c < gs.ownBoard.cells[r].length; c++) {
            if (gs.ownBoard.cells[r][c] === 'empty') result.push({ row: r, col: c });
          }
        }
        return result;
      });

      // ── 15. Fire concurrently: p1 hits ship cells; p2 fires misses on its turn ──
      // Strategy: target only ship cells → every player-1 shot is a hit → player 1
      // keeps consecutive turn (hits don't switch turns). If player 2 goes first,
      // the p2 loop fires a guaranteed miss at a water cell → turn switches to p1.
      await Promise.all([
        // Player 1: fire at all p2 ship cells, waiting for each hit to register
        page1.evaluate(async (cells: Array<{ row: number; col: number }>) => {
          for (const cell of cells) {
            // Wait for player 1's turn before firing
            await new Promise<void>((resolve, reject) => {
              const deadline = Date.now() + 30_000;
              const poll = () => {
                const gs = window.__ironclad?.getMultiplayerState()?.gameState;
                if (!gs || gs.phase === 'finished') { resolve(); return; }
                if (gs.currentTurn === 'self') { resolve(); return; }
                if (Date.now() > deadline) reject(new Error('timed out waiting for player 1 turn'));
                else setTimeout(poll, 100);
              };
              setTimeout(poll, 100);
            });

            const gs = window.__ironclad?.getMultiplayerState()?.gameState;
            if (!gs || gs.phase === 'finished') break;

            // Count hits before shot
            let before = 0;
            for (const row of gs.opponentBoard.cells) for (const c of row) if (c === 'hit') before++;

            window.__ironclad!.fireViaSocket(cell.row, cell.col);

            // Wait for hit to be reflected in game state (server round-trip)
            await new Promise<void>((resolve, reject) => {
              const deadline = Date.now() + 8_000;
              const poll = () => {
                const g = window.__ironclad?.getMultiplayerState()?.gameState;
                if (!g || g.phase === 'finished') { resolve(); return; }
                let n = 0;
                for (const row of g.opponentBoard.cells) for (const c of row) if (c === 'hit') n++;
                if (n > before) resolve();
                else if (Date.now() > deadline)
                  reject(new Error(`hit not registered for cell ${JSON.stringify(cell)}`));
                else setTimeout(poll, 50);
              };
              setTimeout(poll, 50);
            });

            if (window.__ironclad?.getPhase() === 'finished') break;
          }
        }, p2ShipCells),

        // Player 2: fire at player 1's water cells whenever it's player 2's turn.
        // These are guaranteed misses → turn switches back to player 1.
        page2.evaluate(async (waterCells: Array<{ row: number; col: number }>) => {
          let idx = 0;
          const deadline = Date.now() + 90_000;
          while (idx < waterCells.length && Date.now() < deadline) {
            const gs = window.__ironclad?.getMultiplayerState()?.gameState;
            if (!gs || gs.phase === 'finished') break;

            if (gs.currentTurn !== 'self') {
              await new Promise<void>((r) => setTimeout(r, 100));
              continue;
            }

            window.__ironclad!.fireViaSocket(waterCells[idx].row, waterCells[idx].col);
            idx++;

            // Wait for turn to switch back (miss → opponent's turn)
            await new Promise<void>((resolve) => {
              const turnDeadline = Date.now() + 5_000;
              const poll = () => {
                const g = window.__ironclad?.getMultiplayerState()?.gameState;
                if (!g || g.phase === 'finished') { resolve(); return; }
                if (g.currentTurn !== 'self') { resolve(); return; }
                if (Date.now() > turnDeadline) { resolve(); return; }
                setTimeout(poll, 50);
              };
              setTimeout(poll, 50);
            });
          }
        }, p1WaterCells),
      ]);

      // ── 15. Wait for Finished phase on both pages ─────────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'finished',
        { timeout: 15_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'finished',
        { timeout: 15_000 },
      );

      // ── 16. Assert GameOverScreen is visible on both pages ────────────────
      await expect(page1.getByTestId('game-over-screen')).toBeVisible({ timeout: 5_000 });
      await expect(page2.getByTestId('game-over-screen')).toBeVisible({ timeout: 5_000 });

      // ── 17. Assert outcome: player 1 wins, player 2 loses ─────────────────
      await expect(page1.getByTestId('game-over-result')).toContainText('Victory!');
      await expect(page2.getByTestId('game-over-result')).toContainText('Defeat');

      // ── 18. Assert stats on player 1's screen ─────────────────────────────
      // Player 1 fired only at ship cells (17 hits, 0 misses) → accuracy > 0
      await expect(page1.getByTestId('game-over-accuracy')).toBeVisible();
      // Player 1 sank all 5 of player 2's ships
      await expect(page1.getByTestId('game-over-ships-sunk')).toHaveText('5');

      // ── 19. Rematch flow: both click Rematch ──────────────────────────────
      await page1.getByTestId('btn-rematch').click();
      await page2.getByTestId('btn-rematch').click();

      // ── 20. Wait for new game to begin (Placement phase) ──────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'placement',
        { timeout: 30_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'placement',
        { timeout: 30_000 },
      );

      // ── 21. Both place ships in the rematch game ───────────────────────────
      await page1.getByTestId('btn-auto-place').click();
      await page2.getByTestId('btn-auto-place').click();
      await page1.getByTestId('btn-ready').click();
      await page2.getByTestId('btn-ready').click();

      // ── 22. Wait for playing phase ─────────────────────────────────────────
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'playing',
        { timeout: 30_000 },
      );

      // ── 23. Player 2 resigns — player 1 wins the rematch ──────────────────
      await page2.evaluate(() => window.__ironclad!.resignViaSocket());

      // ── 24. Assert player 1 wins the rematch ──────────────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'finished',
        { timeout: 15_000 },
      );
      await expect(page1.getByTestId('game-over-screen')).toBeVisible({ timeout: 5_000 });
      await expect(page1.getByTestId('game-over-result')).toContainText('Victory!');

    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  },
);
