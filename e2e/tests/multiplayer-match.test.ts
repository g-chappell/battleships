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
 * Implementation notes:
 *  - All paired `waitForFunction` calls run in `Promise.all` — sequential waits
 *    previously compounded past the 120s test timeout on headless CI.
 *  - Phase polling reads `getMultiplayerState()?.gameState?.phase` directly from
 *    socketStore. `getPhase()` (gameStore) depends on React useEffect to call
 *    syncFromMpState, which can lag behind the socket event in CI (SwiftShader
 *    WebGL overhead delays GameScene mount/re-render).
 *  - Game end uses `matchSummary !== null` — set exactly once on `game:end`.
 *  - Resign (not shooting) is used because server-side Ironclad/Nimble traits
 *    make per-shot assertions non-deterministic in multiplayer. resignGame()
 *    bypasses all trait processing and is turn-independent. The shoot mechanic
 *    is already covered by singleplayer and ability-rotation E2E tests.
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
    test.setTimeout(180_000);

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
      await Promise.all([
        page1.evaluate(
          ({ token, user }) => window.__ironclad!.injectAuth(token, JSON.stringify(user)),
          { token: body1.token, user: body1.user },
        ),
        page2.evaluate(
          ({ token, user }) => window.__ironclad!.injectAuth(token, JSON.stringify(user)),
          { token: body2.token, user: body2.user },
        ),
      ]);

      // ── 6. Wait for main menu, then navigate to lobby ─────────────────────
      await Promise.all([
        expect(page1.getByTestId('main-menu')).toBeVisible({ timeout: 10_000 }),
        expect(page2.getByTestId('main-menu')).toBeVisible({ timeout: 10_000 }),
      ]);

      // Clicking Multiplayer navigates to the lobby and triggers socket connect
      await Promise.all([
        page1.getByTestId('btn-multiplayer').click(),
        page2.getByTestId('btn-multiplayer').click(),
      ]);

      // ── 7. Wait for socket to connect on both pages ───────────────────────
      await Promise.all([
        page1.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.socketStatus === 'connected',
          { timeout: 20_000 },
        ),
        page2.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.socketStatus === 'connected',
          { timeout: 20_000 },
        ),
      ]);

      // ── 8. Both click "Find Opponent" to join matchmaking ─────────────────
      await Promise.all([
        page1.getByTestId('btn-find-opponent').click(),
        page2.getByTestId('btn-find-opponent').click(),
      ]);

      // ── 9. Wait for both to reach the Placement phase (socketStore) ───────
      await Promise.all([
        page1.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'placement',
          { timeout: 30_000 },
        ),
        page2.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'placement',
          { timeout: 30_000 },
        ),
      ]);

      // ── 10. Auto-place ships on both boards ───────────────────────────────
      await Promise.all([
        page1.getByTestId('btn-auto-place').click(),
        page2.getByTestId('btn-auto-place').click(),
      ]);

      // ── 11. Both confirm placement ────────────────────────────────────────
      await Promise.all([
        page1.getByTestId('btn-ready').click(),
        page2.getByTestId('btn-ready').click(),
      ]);

      // ── 12. Wait for Playing phase on both pages ──────────────────────────
      await Promise.all([
        page1.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'playing',
          { timeout: 30_000 },
        ),
        page2.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'playing',
          { timeout: 30_000 },
        ),
      ]);

      // ── 13. Player 2 resigns — player 1 wins the first game ───────────────
      // Resign is turn-independent (server doesn't check currentTurn) and avoids
      // non-deterministic trait interference (Ironclad/Nimble) that would affect
      // shot-by-shot assertions. The actual shoot mechanic is covered by the
      // singleplayer and ability-rotation E2E tests.
      await page2.evaluate(() => window.__ironclad!.resignViaSocket());

      // ── 14. Wait for game:end on both pages (matchSummary set) ────────────
      await Promise.all([
        page1.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.matchSummary !== null,
          { timeout: 15_000 },
        ),
        page2.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.matchSummary !== null,
          { timeout: 15_000 },
        ),
      ]);

      // ── 15. Assert GameOverScreen is visible on both pages ────────────────
      await Promise.all([
        expect(page1.getByTestId('game-over-screen')).toBeVisible({ timeout: 10_000 }),
        expect(page2.getByTestId('game-over-screen')).toBeVisible({ timeout: 10_000 }),
      ]);

      // ── 16. Assert outcome: player 1 wins, player 2 loses ─────────────────
      await Promise.all([
        expect(page1.getByTestId('game-over-result')).toContainText('Victory!'),
        expect(page2.getByTestId('game-over-result')).toContainText('Defeat'),
      ]);

      // ── 17. Assert stats panel is visible on player 1's screen ───────────
      // Ships-sunk count and accuracy are shown; exact values depend on how many
      // shots were fired before resign (none in this case), so we check visibility.
      await expect(page1.getByTestId('game-over-ships-sunk')).toBeVisible();

      // ── 18. Rematch flow: both click Rematch ──────────────────────────────
      await Promise.all([
        page1.getByTestId('btn-rematch').click(),
        page2.getByTestId('btn-rematch').click(),
      ]);

      // ── 19. Wait for new game to begin (Placement phase in new gameState) ─
      // Rematch emits mm:matched which resets gameState/matchSummary to null,
      // then game:state arrives with phase='placement' when new match starts.
      await Promise.all([
        page1.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'placement',
          { timeout: 30_000 },
        ),
        page2.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'placement',
          { timeout: 30_000 },
        ),
      ]);

      // ── 20. Both place ships in the rematch game ───────────────────────────
      await Promise.all([
        page1.getByTestId('btn-auto-place').click(),
        page2.getByTestId('btn-auto-place').click(),
      ]);
      await Promise.all([
        page1.getByTestId('btn-ready').click(),
        page2.getByTestId('btn-ready').click(),
      ]);

      // ── 21. Wait for playing phase on both pages ───────────────────────────
      await Promise.all([
        page1.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'playing',
          { timeout: 30_000 },
        ),
        page2.waitForFunction(
          () => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'playing',
          { timeout: 30_000 },
        ),
      ]);

      // ── 22. Player 2 resigns — player 1 wins the rematch ──────────────────
      await page2.evaluate(() => window.__ironclad!.resignViaSocket());

      // ── 23. Assert player 1 wins the rematch ──────────────────────────────
      await page1.waitForFunction(
        () => window.__ironclad?.getMultiplayerState()?.matchSummary !== null,
        { timeout: 15_000 },
      );
      await expect(page1.getByTestId('game-over-screen')).toBeVisible({ timeout: 10_000 });
      await expect(page1.getByTestId('game-over-result')).toContainText('Victory!');

    } finally {
      // Swallow close errors — if the test timed out, Playwright may have
      // already torn down the browser, making ctx.close() throw a protocol
      // error that masks the real failure.
      await ctx1.close().catch(() => {});
      await ctx2.close().catch(() => {});
    }
  },
);
