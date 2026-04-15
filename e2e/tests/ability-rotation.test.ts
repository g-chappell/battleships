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

// IroncladBridge type and Window.__ironclad global are declared once in ../fixtures/index.ts
import { test, expect } from '../fixtures';

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

  // ── 5. Disable opponent traits to prevent Nimble interference ───────────
  // The opponent's Destroyer has the Nimble trait, which forces misses on
  // cells adjacent to it. Depending on random ship placement, some of those
  // adjacent cells may belong to other ships. Without disabling traits, ability
  // shots aimed at those ship cells (e.g. Spyglass) become forced misses and
  // the `hits++` assertion fails non-deterministically.
  await page.evaluate(() => window.__ironclad!.disableOpponentTraits());

  // ── 6. Run all 7 abilities in a single page.evaluate ────────────────────
  // All bridge methods are synchronous — batching eliminates ~42 Playwright
  // round trips that caused 30s timeouts in headless CI (SwiftShader renderer).
  type AbilityStats = { hits: number; actions: number; sunk: number };
  type AbilityResult = {
    before: AbilityStats;
    after: AbilityStats;
    skipped: boolean;
  };

  const results = await page.evaluate(() => {
    const b = window.__ironclad!;

    const getUnhit = () => b.getOpponentShipCells().filter((c) => !c.isHit);

    const runAbility = (
      type: string,
      getCoords: () => { row: number; col: number },
    ) => {
      if (b.getPhase() !== 'playing') return { before: b.getEngineStats(), after: b.getEngineStats(), skipped: true };
      b.resetAbilityCooldowns();
      const { row, col } = getCoords();
      const before = b.getEngineStats();
      b.useAbilityAndAdvance(type, row, col);
      const after = b.getEngineStats();
      return { before, after, skipped: false };
    };

    // CannonBarrage — 2×2 area
    const cannonBarrage = runAbility('cannon_barrage', () => getUnhit()[0]);

    // ChainShot — 1×3 horizontal (needs col ≤ 7 so range fits grid)
    const chainShot = runAbility('chain_shot', () => {
      const cells = getUnhit();
      return cells.find((c) => c.col <= 7) ?? cells[0];
    });

    // Spyglass — single shot + row reveal
    const spyglass = runAbility('spyglass', () => getUnhit()[0]);

    // SonarPing — 3×3 scan; center on known ship cell → shipDetected=true → hits++
    const sonarPing = runAbility('sonar_ping', () => getUnhit()[0]);

    // SmokeScreen — defensive, targets player's own board; no hits expected
    const smokeScreen = runAbility('smoke_screen', () => ({ row: 5, col: 5 }));

    // RepairKit — precondition: damage one player ship cell first
    let repairKit = { before: b.getEngineStats(), after: b.getEngineStats(), skipped: true };
    if (b.getPhase() === 'playing') {
      b.resetAbilityCooldowns();
      const hitCell = b.damagePlayerShip();
      if (hitCell !== null) {
        const before = b.getEngineStats();
        b.useAbilityAndAdvance('repair_kit', hitCell.row, hitCell.col);
        repairKit = { before, after: b.getEngineStats(), skipped: false };
      }
    }

    // BoardingParty — intel on ship cell → result !== null → hits++
    const boardingParty = runAbility('boarding_party', () => getUnhit()[0]);

    return { cannonBarrage, chainShot, spyglass, sonarPing, smokeScreen, repairKit, boardingParty };
  }) as {
    cannonBarrage: AbilityResult;
    chainShot: AbilityResult;
    spyglass: AbilityResult;
    sonarPing: AbilityResult;
    smokeScreen: AbilityResult;
    repairKit: AbilityResult;
    boardingParty: AbilityResult;
  };

  // ── 7. Assert per-ability deltas ─────────────────────────────────────────

  // CannonBarrage
  if (!results.cannonBarrage.skipped) {
    expect(results.cannonBarrage.after.actions, 'CannonBarrage: action recorded').toBeGreaterThan(results.cannonBarrage.before.actions);
    expect(results.cannonBarrage.after.hits, 'CannonBarrage: hit registered (not as miss)').toBeGreaterThan(results.cannonBarrage.before.hits);
  }

  // ChainShot
  if (!results.chainShot.skipped) {
    expect(results.chainShot.after.actions, 'ChainShot: action recorded').toBeGreaterThan(results.chainShot.before.actions);
    expect(results.chainShot.after.hits, 'ChainShot: hit registered (not as miss)').toBeGreaterThan(results.chainShot.before.hits);
  }

  // Spyglass
  if (!results.spyglass.skipped) {
    expect(results.spyglass.after.actions, 'Spyglass: action recorded').toBeGreaterThan(results.spyglass.before.actions);
    expect(results.spyglass.after.hits, 'Spyglass: hit registered (not as miss)').toBeGreaterThan(results.spyglass.before.hits);
  }

  // SonarPing — ship is in scan area → shipDetected=true → accuracy hit
  if (!results.sonarPing.skipped) {
    expect(results.sonarPing.after.actions, 'SonarPing: action recorded').toBeGreaterThan(results.sonarPing.before.actions);
    expect(results.sonarPing.after.hits, 'SonarPing: ship detected counts as accuracy hit').toBeGreaterThan(results.sonarPing.before.hits);
  }

  // SmokeScreen — no hits
  if (!results.smokeScreen.skipped) {
    expect(results.smokeScreen.after.actions, 'SmokeScreen: action recorded').toBeGreaterThan(results.smokeScreen.before.actions);
    expect(results.smokeScreen.after.hits, 'SmokeScreen: no damage — hit count unchanged').toBe(results.smokeScreen.before.hits);
  }

  // RepairKit — no hits
  if (!results.repairKit.skipped) {
    expect(results.repairKit.after.actions, 'RepairKit: action recorded').toBeGreaterThan(results.repairKit.before.actions);
    expect(results.repairKit.after.hits, 'RepairKit: no damage dealt — hit count unchanged').toBe(results.repairKit.before.hits);
  }

  // BoardingParty — intel on ship cell → hits++
  if (!results.boardingParty.skipped) {
    expect(results.boardingParty.after.actions, 'BoardingParty: action recorded').toBeGreaterThan(results.boardingParty.before.actions);
    expect(results.boardingParty.after.hits, 'BoardingParty on ship: intel success counts as accuracy hit').toBeGreaterThan(results.boardingParty.before.hits);
  }

  // ── 8. Cross-check HUD sunk count ───────────────────────────────────────
  // At this point 3 damaging abilities (CannonBarrage, ChainShot, Spyglass) have fired.
  // The HUD enemy-remaining count must match the engine's sunk count.
  const finalStats = await page.evaluate(() => window.__ironclad!.getEngineStats());
  const expectedRemaining = 5 - finalStats.sunk;
  await expect(page.getByTestId('hud-enemy-remaining')).toHaveText(`${expectedRemaining}/5`);
});
