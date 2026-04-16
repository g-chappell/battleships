/**
 * E2E regression for the game-breaking trait bugs fixed in this branch:
 *
 *   - Bug 1 (Ironclad silent deflect): player fires at a Battleship cell,
 *     nothing visible happens, turn advances anyway. Firing again (after the
 *     AI turn) registers as a hit because armor is consumed.
 *   - Bug 2 (Nimble locks other-ship cells): cells adjacent to the Destroyer
 *     that belong to another ship were permanently marked Miss on first
 *     shot, making that ship unsinkable and the game unwinnable.
 *
 * This spec drives the single-player AI flow with traits ENABLED (no
 * disableOpponentTraits bypass) and verifies:
 *
 *   1. At least one shot on a Battleship cell is flagged `deflected=true`
 *      and the cell remains targetable afterwards.
 *   2. The game reaches `finished` with `winner === 'player'` — i.e. every
 *      ship is sinkable regardless of Nimble/Destroyer placement.
 */

import { test, expect } from '../fixtures';

test('single-player match with traits active sinks every ship and flags Ironclad deflection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('btn-vs-ai').click();
  await expect(page.getByTestId('pregame-setup')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('difficulty-easy').click();
  await page.getByTestId('btn-set-sail').click();
  await expect(page.getByTestId('btn-auto-place')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('btn-auto-place').click();
  await expect(page.getByTestId('btn-ready')).toBeVisible({ timeout: 3_000 });
  await page.getByTestId('btn-ready').click();

  await page.waitForFunction(
    () => typeof window.__ironclad !== 'undefined' && window.__ironclad!.isReady(),
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () => window.__ironclad!.getPhase() === 'playing',
    { timeout: 10_000 },
  );
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 5_000 });

  // ── Fire at every opponent ship cell with traits ACTIVE ──────────────────
  // Traits are initialised on confirmPlacement for single-player. We do NOT
  // call disableOpponentTraits — we want Nimble + Ironclad to run so the test
  // exercises the real game path.
  const result = await page.evaluate(async () => {
    const bridge = window.__ironclad!;
    const cells = bridge.getOpponentShipCells();

    let sawDeflection = false;
    let deflectedCell: { row: number; col: number } | null = null;
    const MAX_PASSES = 4; // generous upper bound; 2 passes suffice in practice
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      if (bridge.getPhase() !== 'playing') break;
      for (const c of cells) {
        if (bridge.getPhase() !== 'playing') break;

        // Spin a bounded number of no-ops if the AI got a turn; each
        // fireAndAdvance flushes AI turns synchronously so this rarely loops.
        let guard = 0;
        while (!bridge.isPlayerTurn() && bridge.getPhase() === 'playing' && guard < 5) {
          guard++;
        }

        const shot = bridge.fireAndAdvance(c.row, c.col);
        if (!shot) continue;
        if (shot.deflected) {
          sawDeflection = true;
          deflectedCell = { row: c.row, col: c.col };
        }
      }
    }

    return {
      phase: bridge.getPhase(),
      winner: bridge.getWinner(),
      shipsSunk: bridge.getOpponentShipsSunk(),
      sawDeflection,
      deflectedCell,
    };
  });

  // ── Assertions ───────────────────────────────────────────────────────────
  // (1) Ironclad deflection observed at least once when targeting the Battleship.
  expect(result.sawDeflection).toBe(true);
  expect(result.deflectedCell).not.toBeNull();

  // (2) Game reaches a clean Finished/Victory state — regression for Bug 2.
  expect(result.phase).toBe('finished');
  expect(result.winner).toBe('player');
  expect(result.shipsSunk).toBe(5);

  // UI reflects the end-of-game state.
  await expect(page.getByTestId('game-over-screen')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('game-over-result')).toContainText('Victory!');
});
