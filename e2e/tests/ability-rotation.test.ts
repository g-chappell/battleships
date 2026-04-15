/**
 * TASK-049: E2E test — ability rotation with hit/miss/sunk assertion per activation.
 *
 * Flow:
 *  1. Open app → navigate to VS AI → Easy difficulty → auto-place → start
 *  2. Inject all 7 abilities via the test bridge (bypasses captain selection)
 *  3. Discover opponent ship layout via bridge
 *  4. Activate each ability in turn, assert hit/action/sunk deltas are correct
 *
 * This is the primary regression guard for the "hit recorded as miss" bug:
 * abilities that deal damage (CannonBarrage, ChainShot, Spyglass) must
 * register positive hit counts; non-damaging abilities must not.
 *
 * The window.__ironclad bridge is exposed in DEV builds by main.tsx.
 */

import { test, expect } from '../fixtures';

// ---------------------------------------------------------------------------
// Bridge type — full set of methods exposed by main.tsx (all test files must
// declare the same shape to avoid TypeScript TS2717 on merged Window interface)
// ---------------------------------------------------------------------------
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
  // Ability testing helpers
  injectAllAbilities: () => void;
  resetAbilityCooldowns: () => void;
  useAbilityAndAdvance: (type: string, row: number, col: number) => { applied: boolean };
  getEngineStats: () => { hits: number; actions: number; sunk: number };
  getOpponentShipCells: () => Array<{ row: number; col: number; shipType: string; isHit: boolean }>;
  damagePlayerShip: () => { row: number; col: number } | null;
};

declare global {
  interface Window {
    __ironclad?: IroncladBridge;
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('ability rotation — each of 7 abilities produces correct hit/miss/sunk delta', async ({ page }) => {
  // ── 1. Navigate and start a VS AI game ───────────────────────────────────
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('btn-vs-ai').click();
  await expect(page.getByTestId('pregame-setup')).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('difficulty-easy').click();
  await page.getByTestId('btn-set-sail').click();

  // ── 2. Placement phase ───────────────────────────────────────────────────
  await expect(page.getByTestId('btn-auto-place')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('btn-auto-place').click();
  await expect(page.getByTestId('btn-ready')).toBeVisible({ timeout: 3_000 });
  await page.getByTestId('btn-ready').click();

  // ── 3. Wait for bridge and Playing phase ─────────────────────────────────
  await page.waitForFunction(
    () => typeof window.__ironclad !== 'undefined' && window.__ironclad!.isReady(),
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () => window.__ironclad!.getPhase() === 'playing',
    { timeout: 10_000 },
  );
  await expect(page.getByTestId('hud')).toBeVisible({ timeout: 5_000 });

  // ── 4. Inject all 7 abilities ────────────────────────────────────────────
  // Overrides the captain's 2-ability loadout so we can test all 7 in one match.
  await page.evaluate(() => window.__ironclad!.injectAllAbilities());

  // ── 5. Helpers ───────────────────────────────────────────────────────────

  /** Re-fetch unhit opponent cells (refreshed after each ability use). */
  const getUnhitCells = () =>
    page.evaluate(() =>
      window.__ironclad!.getOpponentShipCells().filter((c) => !c.isHit),
    );

  /** Wait for player's turn with no ongoing animation. */
  const waitForPlayerTurn = () =>
    page.waitForFunction(
      () =>
        window.__ironclad!.getPhase() === 'playing' &&
        window.__ironclad!.isPlayerTurn() &&
        !window.__ironclad!.isAnimating(),
      { timeout: 10_000 },
    );

  /** True while the game is still in progress. */
  const stillPlaying = () =>
    page.evaluate(() => window.__ironclad!.getPhase() === 'playing');

  /** Use an ability and wait for the game to settle. */
  const useAbility = async (type: string, row: number, col: number) => {
    await page.evaluate(
      ([t, r, c]) => window.__ironclad!.useAbilityAndAdvance(t, r, c),
      [type, row, col] as [string, number, number],
    );
    if (await stillPlaying()) {
      await waitForPlayerTurn();
    }
  };

  // ── 6. CannonBarrage — 2×2 area, must register ≥1 hit ───────────────────
  {
    const unhit = await getUnhitCells();
    const target = unhit[0]; // first ship cell is always the topLeft of the 2×2
    const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

    await useAbility('cannon_barrage', target.row, target.col);

    const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
    expect(after.actions, 'CannonBarrage: action recorded').toBeGreaterThan(before.actions);
    // Primary regression assertion: shot on ship cell must NOT be recorded as miss
    expect(after.hits, 'CannonBarrage: hit registered (not as miss)').toBeGreaterThan(before.hits);
  }

  if (!await stillPlaying()) return; // early win — all abilities that mattered fired correctly
  await page.evaluate(() => window.__ironclad!.resetAbilityCooldowns());
  await waitForPlayerTurn();

  // ── 7. ChainShot — 1×3 horizontal, must register ≥1 hit ─────────────────
  {
    const unhit = await getUnhitCells();
    // Need col ≤ 7 so the 3-col range fits in the grid; at least the target cell is a ship
    const target = unhit.find((c) => c.col <= 7) ?? unhit[0];
    const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

    await useAbility('chain_shot', target.row, target.col);

    const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
    expect(after.actions, 'ChainShot: action recorded').toBeGreaterThan(before.actions);
    expect(after.hits, 'ChainShot: hit registered (not as miss)').toBeGreaterThan(before.hits);
  }

  if (!await stillPlaying()) return;
  await page.evaluate(() => window.__ironclad!.resetAbilityCooldowns());
  await waitForPlayerTurn();

  // ── 8. Spyglass — single shot + row reveal, must register ≥1 hit ─────────
  {
    const unhit = await getUnhitCells();
    const target = unhit[0];
    const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

    await useAbility('spyglass', target.row, target.col);

    const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
    expect(after.actions, 'Spyglass: action recorded').toBeGreaterThan(before.actions);
    expect(after.hits, 'Spyglass: hit registered (not as miss)').toBeGreaterThan(before.hits);
  }

  if (!await stillPlaying()) return;
  await page.evaluate(() => window.__ironclad!.resetAbilityCooldowns());
  await waitForPlayerTurn();

  // ── 9. SonarPing — detects ships, counts as accuracy "hit" when detected ──
  // recordPlayerAction(shipDetected): targeting a known ship cell → shipDetected=true → hits++
  {
    const unhit = await getUnhitCells();
    const target = unhit[0]; // center the 3×3 scan on a known ship cell
    const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

    await useAbility('sonar_ping', target.row, target.col);

    const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
    expect(after.actions, 'SonarPing: action recorded').toBeGreaterThan(before.actions);
    // Ship is in the 3×3 area → shipDetected=true → accuracy hit counted
    expect(after.hits, 'SonarPing: ship detected counts as accuracy hit').toBeGreaterThan(before.hits);
  }

  if (!await stillPlaying()) return;
  await page.evaluate(() => window.__ironclad!.resetAbilityCooldowns());
  await waitForPlayerTurn();

  // ── 10. SmokeScreen — defensive only, no hits ─────────────────────────────
  // recordPlayerAction(false) — action counted but not a hit
  {
    const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

    // SmokeScreen targets player's own board — use center (5,5)
    await useAbility('smoke_screen', 5, 5);

    const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
    expect(after.actions, 'SmokeScreen: action recorded').toBeGreaterThan(before.actions);
    expect(after.hits, 'SmokeScreen: no damage — hit count unchanged').toBe(before.hits);
  }

  if (!await stillPlaying()) return;
  await page.evaluate(() => window.__ironclad!.resetAbilityCooldowns());
  await waitForPlayerTurn();

  // ── 11. RepairKit — heals player ship, no hits ────────────────────────────
  // Precondition: damage one player ship cell so RepairKit has something to repair.
  {
    const hitCell = await page.evaluate(() => window.__ironclad!.damagePlayerShip());
    if (hitCell !== null) {
      const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

      await useAbility('repair_kit', hitCell.row, hitCell.col);

      const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
      expect(after.actions, 'RepairKit: action recorded').toBeGreaterThan(before.actions);
      expect(after.hits, 'RepairKit: no damage dealt — hit count unchanged').toBe(before.hits);
    }
    // If damagePlayerShip returns null (all player ships somehow sunk), skip — game would be over.
  }

  if (!await stillPlaying()) return;
  await page.evaluate(() => window.__ironclad!.resetAbilityCooldowns());
  await waitForPlayerTurn();

  // ── 12. BoardingParty — stealth intel on ship cell, counts as accuracy hit ─
  // executeBoardingParty: returns { shipType, hitsTaken, totalCells } if ship present
  // recordPlayerAction(result !== null) → true when ship found → hits++
  {
    const unhit = await getUnhitCells();
    const target = unhit[0];
    const before = await page.evaluate(() => window.__ironclad!.getEngineStats());

    await useAbility('boarding_party', target.row, target.col);

    const after = await page.evaluate(() => window.__ironclad!.getEngineStats());
    expect(after.actions, 'BoardingParty: action recorded').toBeGreaterThan(before.actions);
    // Intel on a ship cell → result !== null → accuracy hit counted
    expect(after.hits, 'BoardingParty on ship: intel success counts as accuracy hit').toBeGreaterThan(before.hits);
  }

  // ── 13. Cross-check HUD sunk count ──────────────────────────────────────
  // At this point 3 damaging abilities (CannonBarrage, ChainShot, Spyglass) have fired.
  // The HUD enemy-remaining count must match the engine's sunk count.
  const finalStats = await page.evaluate(() => window.__ironclad!.getEngineStats());
  const expectedRemaining = 5 - finalStats.sunk;
  await expect(page.getByTestId('hud-enemy-remaining')).toHaveText(`${expectedRemaining}/5`);
});
