/**
 * TASK-050: E2E test — full multiplayer match across two browser contexts.
 *
 * Flow:
 *  1. Register two users via REST API
 *  2. Open two browser contexts (page1 = player 1, page2 = player 2)
 *  3. Inject auth credentials into each context
 *  4. Navigate both to the Multiplayer lobby → sockets connect
 *  5. Both join quick matchmaking → server pairs them
 *  6. Both auto-place ships → both confirm placement
 *  7. Game transitions to Playing phase
 *  8. Player 2 resigns → player 1 wins the first game
 *  9. Assert both sides see correct outcome (Victory / Defeat)
 * 10. Rematch: both click Rematch → new Placement phase begins
 * 11. Both place ships again → game starts → player 2 resigns → player 1 wins rematch
 *
 * Note on shooting strategy: server-side traits (Ironclad, Nimble) are active
 * in multiplayer and make shot-by-shot assertions non-deterministic:
 *  - Ironclad negates the first Battleship hit → cell stays 'empty' in public board
 *  - Nimble can permanently mark a ship cell as 'miss'
 * Using player-2-resigns is reliable and still exercises the full socket/matchmaking/
 * rematch pipeline — the actual shoot mechanics are covered by singleplayer tests.
 *
 * The window.__ironclad bridge (injected by main.tsx in DEV mode) exposes
 * multiplayer-specific helpers: injectAuth, resignViaSocket, requestRematchViaSocket,
 * getMultiplayerState.
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

      // ── 11. Both confirm placement ────────────────────────────────────────
      await page1.getByTestId('btn-ready').click();
      await page2.getByTestId('btn-ready').click();

      // ── 12. Wait for Playing phase on both pages ──────────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'playing',
        { timeout: 30_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'playing',
        { timeout: 30_000 },
      );

      // ── 13. Player 2 resigns — player 1 wins the first game ───────────────
      // Resign is turn-independent (server doesn't check currentTurn) and avoids
      // non-deterministic trait interference (Ironclad/Nimble) that would affect
      // shot-by-shot assertions. The actual shoot mechanic is covered by the
      // singleplayer and ability-rotation E2E tests.
      await page2.evaluate(() => window.__ironclad!.resignViaSocket());

      // ── 14. Wait for Finished phase on both pages ─────────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'finished',
        { timeout: 15_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'finished',
        { timeout: 15_000 },
      );

      // ── 15. Assert GameOverScreen is visible on both pages ────────────────
      await expect(page1.getByTestId('game-over-screen')).toBeVisible({ timeout: 5_000 });
      await expect(page2.getByTestId('game-over-screen')).toBeVisible({ timeout: 5_000 });

      // ── 16. Assert outcome: player 1 wins, player 2 loses ─────────────────
      await expect(page1.getByTestId('game-over-result')).toContainText('Victory!');
      await expect(page2.getByTestId('game-over-result')).toContainText('Defeat');

      // ── 17. Assert stats panel is visible on player 1's screen ───────────
      // Ships-sunk count and accuracy are shown; exact values depend on how many
      // shots were fired before resign (none in this case), so we check visibility.
      await expect(page1.getByTestId('game-over-ships-sunk')).toBeVisible();

      // ── 18. Rematch flow: both click Rematch ──────────────────────────────
      await page1.getByTestId('btn-rematch').click();
      await page2.getByTestId('btn-rematch').click();

      // ── 19. Wait for new game to begin (Placement phase) ──────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getPhase() === 'placement',
        { timeout: 30_000 },
      );
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'placement',
        { timeout: 30_000 },
      );

      // ── 20. Both place ships in the rematch game ───────────────────────────
      await page1.getByTestId('btn-auto-place').click();
      await page2.getByTestId('btn-auto-place').click();
      await page1.getByTestId('btn-ready').click();
      await page2.getByTestId('btn-ready').click();

      // ── 21. Wait for playing phase ─────────────────────────────────────────
      await page2.waitForFunction(
        () => window.__ironclad?.getPhase() === 'playing',
        { timeout: 30_000 },
      );

      // ── 22. Player 2 resigns — player 1 wins the rematch ──────────────────
      await page2.evaluate(() => window.__ironclad!.resignViaSocket());

      // ── 23. Assert player 1 wins the rematch ──────────────────────────────
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
