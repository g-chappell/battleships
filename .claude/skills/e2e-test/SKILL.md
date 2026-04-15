---
name: e2e-test
description: Playwright E2E test playbook — bridge pattern, multiplayer gotchas, CI survival
user_invocable: true
---

# E2E Test Playbook

This codifies hard-won patterns from TASK-048 / TASK-049 / TASK-050. Read this before writing or debugging an `e2e/tests/*.test.ts` spec. Each rule has a reason — break them only if you understand the trade-off.

## Bridge pattern (canvas games)

The 3D R3F canvas cannot be targeted by Playwright clicks. Drive state via `window.__ironclad` in `client/src/main.tsx`, exposed only when `import.meta.env.DEV`.

- **Add one method per interaction**, not one per test. `fireAndAdvance`, `useAbilityAndAdvance`, `completeGameFast` — synchronous, return serializable results.
- **Use dynamic `Promise.all([import('./store/gameStore'), import('./store/socketStore'), ...])`** — never top-level imports, or stores ship in the production bundle.
- **Declare the `IroncladBridge` type once** in `e2e/fixtures/index.ts` with `declare global { interface Window { __ironclad?: IroncladBridge } }`. Any duplicate declaration with a different shape triggers **TS2717**. Per-file `declare global` blocks are forbidden — re-export `type Page` from fixtures too.
- **Batch bridge calls in a single `page.evaluate(() => { ... })`** when testing rapid-fire state transitions. Every `page.evaluate` is a round-trip (~100ms in CI); ability-rotation's 7-step test went from 30s timeout to 3s after batching.

## Imports and types

- `import { test, expect, type Page } from '../fixtures'` — never from `@playwright/test` directly. The fixtures file extends `test` with `registeredUser`, `guestUser`, `socketReady`.
- `import { type APIRequestContext } from '@playwright/test'` for typing the `request` parameter passed to `registerUser`-style helpers. Don't try to infer it from the test callback signature.
- `test.setTimeout(N)` **inside the test body** — Playwright v1.52/v1.59's `TestDetails` options object **does not** include `timeout`. Passing `{ timeout }` as the 2nd arg to `test()` is a TS2353 error. This is different from Vitest's `it(name, fn, timeout)` 3-arg form.

## Selectors

- Add `data-testid="..."` to components the test needs. Prefer test-ids over CSS/text — CSS selectors break on Tailwind churn, text changes with i18n.
- **Never use `page.locator('canvas')`** to click game cells. The canvas swallows clicks that don't hit a 3D intersection. Use the bridge.

## Waiting

- **`Promise.all` every paired wait across two pages.** Sequential `await page1.waitForFunction(...); await page2.waitForFunction(...)` calls compound: 7 paired 15s waits = 210s worst case, blowing the 120s test timeout. Parallel: ~15s total. This is the single biggest CI-fix lever.
- **`waitForFunction` over `waitForTimeout`** — arbitrary sleeps break on slow CI (SwiftShader). Always poll for a state predicate.
- **`getByTestId(...).click()` auto-waits** for visibility and receivability up to the action timeout (default 30s). Don't layer explicit `expect(...).toBeVisible()` checks before clicks unless you need a specific error message.

## Multiplayer phase detection

**Poll `socketStore.gameState.phase`, NOT `gameStore.engine.phase`.**

- `socketStore.gameState` is updated synchronously by the `game:state` socket handler.
- `gameStore.engine.phase` is updated via a React `useEffect` in `GameScene.tsx` that calls `syncFromMpState` — can lag behind the socket event under CI load.
- Through the bridge: `() => window.__ironclad?.getMultiplayerState()?.gameState?.phase === 'placement'`

**Use `matchSummary !== null` for game-end detection.** It is set exactly once when `game:end` arrives. `gameState.phase === 'finished'` also works but briefly coexists with the previous game's state during the finished→rematch transition.

## Multiplayer shoot mechanics — don't assert them

**Server-side traits (`Ironclad`, `Nimble`) make shot-by-shot assertions non-deterministic in multiplayer.** `rooms.ts::placeShips` calls `createTraitState() + initNimbleCells(board)` — these fire regardless of client settings.

- **Ironclad** (Battleship) silently resets the first Battleship hit cell to `CellState.Ship`, which `serializePublicBoard` maps to `'empty'`. Hit-count polling will never increment for that cell.
- **Nimble** (Destroyer) permanently marks cells adjacent to the Destroyer as `Miss` — those ship cells become permanently un-hittable from the opponent's view.
- Client-side `disableOpponentTraits()` has **no effect** on server processing.

**For MP tests that need a deterministic winner, use `resignViaSocket()`.** `resignPlayer()` is turn-independent, bypasses all trait processing, and triggers the full `game:end` flow. Shoot mechanics are already covered by singleplayer and ability-rotation E2E tests.

## Singleplayer determinism

For SP tests that need a guaranteed player win, use `completeGameFast` — targets only opponent ship cells. Every shot is a hit, hits grant consecutive turns, AI never fires. 17 shots, deterministic, no trait interference because the trait-processing path is in the `playerFire` Zustand action, not `engine.playerShoot` which the bridge calls directly.

If you need traits disabled (e.g. to target adjacent-to-Destroyer cells for Spyglass), call `disableOpponentTraits()` before firing — this nulls `opponentTraits` in gameStore so `playerFire` skips the trait branch. Only relevant in SP; in MP it is useless.

## Rematch flow

The rematch path is NOT symmetric to the initial match. `MultiplayerLobby` owns the `matchmakingState === 'matched' → startMultiplayerGame()` useEffect, but is unmounted during `GameOverScreen`. `GamePage` has a mirror `useEffect` keyed on `roomId` transitions (one non-null id to another) — that's the rematch signal. If you're adding rematch assertions, remember the client-side reset requires a new `roomId` from the server.

## Test timeout budget

- Default per-test timeout: 120s (config). Bump with `test.setTimeout(180_000)` for two-context MP tests where 7 paired waits + Playwright + SwiftShader overhead can stack.
- **Target headroom ≥ 30s.** If your test regularly runs at 150s+ with a 180s timeout, you're one CI hiccup away from flake.
- Individual `waitForFunction` timeouts: 15s for socket events, 30s for phase transitions, 10s for UI assertions (`toBeVisible`).

## Local pre-flight before pushing

Every CI round is 5–8 minutes (2–3m `ci` + 3–6m `e2e`). Before pushing any e2e change:

1. `cd e2e && npx tsc --noEmit` — catches bridge type mismatches, TS2717, TS2353.
2. `cd client && npx tsc -b` — stricter than `--noEmit`, catches project-reference issues.
3. `npm run test --workspace=client` — if you touched a store or component that tests cover, run the unit tests first.
4. **Trace the data flow mentally.** If you're fixing a test failure by adding a wait, ask: "What would break if the wait returned immediately?" If the answer is "nothing", the wait is hiding a real bug.

## Debugging a failing CI run

```bash
"/c/Program Files/GitHub CLI/gh.exe" run view <run-id> --log-failed 2>&1 | head -250
```

Look for:
- **`Test timeout exceeded`** → either sequential waits, or a legitimate hang. Check the last step the test reached in the error trace (`> line N`).
- **`locator.click: Test ended` while `waiting for getByTestId(...)`** → element never rendered. Usually a React state issue, not a test bug. Trace where the element is gated in the component tree.
- **`expect(locator).toBeVisible() failed`** with a 10s timeout → a render transition is slower than expected, OR a state bug is preventing the render entirely. Don't just bump the timeout; verify the state flows to the component.

## Patterns NOT to repeat

- ❌ Sequential paired waits — use `Promise.all`.
- ❌ Polling `getPhase()` in multiplayer — use `getMultiplayerState().gameState.phase`.
- ❌ Firing at opponent ship cells in multiplayer — use resign.
- ❌ Duplicate `IroncladBridge` type declarations — centralize in `e2e/fixtures/index.ts`.
- ❌ `{ timeout: N }` as 2nd arg to `test()` — use `test.setTimeout(N)`.
- ❌ Patching CI failures by bumping timeouts without tracing the root cause — see `feedback_trace_before_patch`.
