/**
 * Smoke test — verifies the full stack starts and the app loads.
 * Kept intentionally minimal; detailed scenarios live in TASK-048/049/050.
 */

import { test, expect } from '../fixtures';

test('app loads and shows main menu', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Ironclad Waters');
  // Wait for the React root to hydrate — any visible heading will do
  await expect(page.locator('h1, h2, [data-testid="main-menu"]').first()).toBeVisible({
    timeout: 10_000,
  });
});
