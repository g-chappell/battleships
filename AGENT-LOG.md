# Agent Log — Ironclad Waters

> Autonomous development agent run log. Each entry is appended after a scheduled run.
> Tracks: tasks attempted, outcomes, lessons learned, self-improvements, test counts.

---

## Run History

<!-- Agent appends entries below this line -->

### Run [2026-04-13 19:35]
- **Task:** TASK-011 — Add spectatorStore unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/15
- **Test counts:** shared 231, server 37, client 121 (up from 104, added 17 tests)
- **Files changed:** `client/src/__tests__/spectatorStore.test.ts` (created, 17 tests)
- **Lessons learned:** `spectatorStore` imports `useSocketStore` from `./socketStore` and calls `useSocketStore.getState().socket` — mock the module with `vi.mock('../store/socketStore', ...)` exporting `useSocketStore: { getState: vi.fn() }`, then control `getState` return per test. For `joinAsSpectator`, the socket `emit` ack is the third argument (`emit(event, payload, ack)`) — mock it with `socket.emit.mockImplementation((_event, _payload, ack) => ack(...))`. Registered `on` listeners are stored internally in `makeSocket()` and triggered via `socket._trigger(event, ...args)` — this lets tests verify socket event handler behavior without real sockets. `leaveSpectating` resets state even when no socket is present (the set() call runs unconditionally after the socket null check).
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 19:04]
- **Task:** TASK-010 — Add campaignStore unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/14
- **Test counts:** shared 231, server 37, client 104 (up from 15)
- **Files changed:** `client/src/__tests__/campaignStore.test.ts` (created, 89 tests)
- **Lessons learned:** `completeMission` does a best-effort server POST via `.catch(() => {})` — the mock needs to return a resolved promise to avoid async noise, but since it's fire-and-forget, calling `expect(mockApiFetch).toHaveBeenCalledWith(...)` synchronously after `completeMission()` works fine (mock is registered before the async chain runs). `calculateStars` requires meeting 2-star threshold first before 3-star can be awarded (sequential gate). `highestUnlocked` is capped at `CAMPAIGN_MISSIONS.length` (15), so testing mission 15 completion doesn't exceed that. `getMission(999)` returns undefined so no state change occurs — store guards with `if (mission)`.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 18:03]
- **Task:** TASK-009 — Add cosmeticsStore unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/13
- **Test counts:** shared 231, server 37, client 65 (was 38, added 27)
- **Files changed:** `client/src/__tests__/cosmeticsStore.test.ts` (created)
- **Lessons learned:** `cosmeticsStore` imports `ApiError` from `apiClient` — the mock must re-export a real class (not just a vi.fn) so `instanceof ApiError` checks work inside the store's buy() method. `buy()` has three early-exit paths (owned, insufficient, server error) before the local fallback; test them in order. `equip()` fires a background `apiFetch` call that ignores errors — test it was called (for token) or not called (no token) with `expect(mockApiFetch).toHaveBeenCalledWith(...)`. Server fallback in `buy()` only triggers on non-ApiError exceptions — throw a plain `Error` to test it.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 16:03]
- **Task:** TASK-008 — Add settingsStore unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/11
- **Test counts:** shared 209, server 37, client 38
- **Files changed:** `client/src/__tests__/settingsStore.test.ts` (created)
- **Lessons learned:** `settingsStore` imports audio functions under aliased names (`setSfxVolume as setAudioSfxVolume`, `setMusicVolume as setAudioMusicVolume`) — the mock must export them under their original names (`setSfxVolume`, `setMusicVolume`) so Vitest resolves them correctly. `loadFromStorage` uses `?? defaultValue` for missing fields, so partial localStorage objects can be tested for fallback behavior. `toggleMusic` conditionally calls `startAmbientLoop` or `stopAmbientLoop` (not both) — tests should assert the non-called function was NOT called.
### Run [2026-04-13 15:03]
- **Task:** TASK-007 — Add captains definition tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/10
- **Test counts:** shared 231, server 37, client 15
- **Files changed:** `shared/src/__tests__/captains.test.ts` (created)
- **Lessons learned:** `captains.ts` exports `CAPTAIN_DEFS` (Record with 3 entries), `CAPTAIN_IDS` (array of keys), and `DEFAULT_CAPTAIN` (string literal 'ironbeard'). All three captains have exactly 3 abilities each. Testing that abilities exist in `ABILITY_DEFS` is straightforward via `new Set(Object.values(AbilityType))`. The `CaptainDef` interface has 6 required fields: id, name, title, description, abilities, color.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 14:03]
- **Task:** TASK-006 — Add clans type validation tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/9
- **Test counts:** shared 182, server 37, client 15
- **Files changed:** `shared/src/__tests__/clans.test.ts` (created)
- **Lessons learned:** `clans.ts` is purely type-based with no runtime values or constants — no enums, no exported objects. All four interfaces (`ClanSummary`, `ClanMember`, `ClanChatMessage`, `ClanDetail`) and the `ClanRole` union type are testable only by constructing conforming objects and asserting field values. `ClanDetail extends ClanSummary`, so tests check that all eight ClanSummary fields appear on ClanDetail instances. The `description` field on ClanSummary is `string | null` — always test both forms.
### Run [2026-04-13 13:55]
- **Task:** TASK-005 — Add cosmetics catalog validation tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/8
- **Test counts:** shared 187 (+48), server 37, client 15
- **Files changed:** `shared/src/__tests__/cosmetics.test.ts` (created)
- **Lessons learned:** `COSMETIC_CATALOG` has duplicate IDs globally ("default" appears once per kind), so "no duplicate IDs" must be tested per-kind rather than globally. `getCosmetic` uses `find` and returns the first match — calling `getCosmetic('default')` returns the first 'default' entry (ship_skin). Default items have price 0, all others have price > 0. `GOLD_REWARDS` is `as const` so values are exact literals — test relative ordering (ranked > casual, hard AI > medium AI > easy AI, tournament win > runner-up) as behavioral contracts.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 13:49]
- **Task:** TASK-004 — Add seasons helper unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/7
- **Test counts:** shared 139 (+16), server 37, client 15
- **Files changed:** `shared/src/__tests__/seasons.test.ts` (created)
- **Lessons learned:** `getSeasonTimeRemaining` uses `Date.now()` internally, so tests must use `vi.setSystemTime()` (fake timers) to get deterministic results. Use `afterEach(() => vi.useRealTimers())` to restore. The function accepts both `string` (ISO) and `Date` object — tests should cover both. `ended` is only `true` when `total_ms === 0` (i.e., past or exactly-now dates).
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 12:45]
- **Task:** TASK-002 — Add tournament bracket unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/5
- **Test counts:** shared 128 (+26), server 37, client 15
- **Files changed:** `shared/src/__tests__/tournaments.test.ts` (created)
- **Lessons learned:** `seedPairings` throws for non-power-of-2 sizes (including empty array and size 1). `nextBracketSlot` uses simple integer division and modulo — even indices → p1, odd → p2. `totalRounds` is exactly `Math.log2(size)`. All functions are pure with no external dependencies.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 13:40]
- **Task:** TASK-003 — Add replay schema unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/6
- **Test counts:** shared 123, server 37, client 15
- **Files changed:** `shared/src/__tests__/replay.test.ts` (created)
- **Lessons learned:** `replay.ts` is entirely type-based with one constant (`MAX_REPLAY_EVENTS = 500`). Since TypeScript types are erased at runtime, tests validate structural contracts by constructing objects conforming to interfaces and asserting field values. `ShotResult` enum and `ShipType` enum are imported from `types.ts` for use in `ShotOutcome` and `ShipPlacement` fixtures. TASK-002 tournaments.test.ts appears not to have been merged to main (PR #5 opened but unmerged) — shared test count was 123, not 128 as expected from AGENT-LOG.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 12:21]
- **Task:** TASK-001 — Add campaign module unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/4
- **Test counts:** shared 102 (+28), server 37, client 15
- **Files changed:** `shared/src/__tests__/campaign.test.ts` (created)
- **Lessons learned:** Campaign module exports `CAMPAIGN_MISSIONS`, `calculateStars`, `getMission` directly from `campaign.ts`. `calculateStars` requires passing 2-star threshold before awarding 3-star (sequential gate). All 15 missions have `fixedAbilities` of exactly 2 items when present. Existing test pattern: `import { describe, it, expect } from 'vitest'`, no mocking needed for pure data/logic modules in shared/.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 19:41]
- **Task:** TASK-012 — Add tournamentsStore unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/16
- **Test counts:** shared 231, server 37, client 144 (+29)
- **Files changed:** `client/src/__tests__/tournamentsStore.test.ts` (created)
- **Lessons learned:** `tournamentsStore` uses `apiFetchSafe` (returns null on failure) for `fetchList`/`fetchOne` and `apiFetch` (throws ApiError) for `create`/`join`. The `create` action calls `fetchList()` after success, and `join` calls `fetchOne(id)` — both require two mock calls in sequence (one for the mutating action, one for the refresh). The `error` message differs between actions: fetchList/fetchOne use different strings ('Tournaments unavailable offline' vs 'Tournament not found'), so tests must match exactly. Non-ApiError exceptions in `create`/`join` are caught and produce the offline message.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 19:45]
- **Task:** TASK-013 — Add replayStore unit tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/17
- **Test counts:** shared 231, server 37, client 184 (+40)
- **Files changed:** `client/src/__tests__/replayStore.test.ts` (created)
- **Lessons learned:** `replayStore` uses `apiFetchSafe` (returns null on failure) for API path. It also checks `localStorage` first via `localStorage.getItem('battleships_replay_${matchId}')` — tests must mock `localStorage` (using `localStorage.clear()` in beforeEach). The `seek` action rebuilds boards from scratch by replaying all events from index 0 to the target — so seeking backwards works correctly. Fire events apply to the OPPOSITE side's board (p1 fires → p2 board, p2 fires → p1 board). Placement events apply to the NAMED side's board. `play()` uses `setInterval` — must use `vi.useFakeTimers()` with `vi.advanceTimersByTime()` to test interval behavior, and `vi.useRealTimers()` in afterEach. The `playInterval` module-level variable is cleared when `load()` is called again, so testing that a new load stops the previous interval works by checking cursor stays 0.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 20:05]
- **Task:** TASK-015 — Add server tournament service tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/18
- **Test counts:** shared 231, server 69 (+32), client 184
- **Files changed:** `server/src/__tests__/tournaments.test.ts` (created, 32 tests)
- **Lessons learned:** Server services that use Prisma require `vi.hoisted()` to define mock objects before `vi.mock()` factory runs — the factory is hoisted to the top of the file by Vitest, so plain `const mockX = { fn: vi.fn() }` declarations are not yet initialized when the factory executes. Use `vi.hoisted(() => ({ ... }))` and destructure the result. Mocking `../services/db.ts` covers both `tournaments.ts` and `gold.ts` since both import `prisma` from that module — no need to separately mock gold.ts. The `safeDb` wrapper returns null on any thrown error, so DB-unavailable tests simply need `mockX.mockRejectedValue(new Error(...))`. `startTournamentInternal` (called when last player joins) requires chaining `mockTournament.findUnique.mockResolvedValueOnce(...)` for the second call — use `mockResolvedValueOnce` in sequence.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 21:04]
- **Task:** TASK-016 — Add server clans service tests
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/19
- **Test counts:** shared 231, server 102 (+33), client 184
- **Files changed:** `server/src/__tests__/clans.test.ts` (created, 33 tests)
- **Lessons learned:** `getClanDetail` uses `safeDb` wrapper but the inner async function returns `null` early (not throwing) when `clan` is not found — so the service returns `null` but not via the `safeDb` error-catch path. `memberCount` in ClanDetail is derived from `clan.members.length` (runtime array), not from `_count.members` (which is only used in list queries). The `chat` array from Prisma is queried in `desc` order and then `.reverse()`d to restore chronological order — tests must supply desc-ordered input to verify the reversal. `leaveClan` and `incrementClanStats` return `void` (not an error type) so DB errors are silently swallowed by `safeDb`. `addChatMessage` returns the result of `safeDb` directly (not wrapped in `?? fallback`), so it returns `null` on DB error rather than an error object.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 21:47]
- **Task:** TASK-014 — Add GitHub Actions CI workflow
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/20
- **Test counts:** shared 231, server 102, client 184
- **Files changed:** `.github/workflows/ci.yml` (created)
- **Lessons learned:** Simple workflow file — single job named `ci` with steps: checkout, setup-node@v4 (Node 20, npm cache), `npm ci`, tsc type-check, three test suites, client build. No special handling needed for the monorepo structure since npm workspaces work naturally with `npm run test --workspace=X`. Used `actions/checkout@v4` and `actions/setup-node@v4` (latest stable versions).
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 22:05]
- **Task:** TASK-017 — Mobile viewport improvements for GamePage
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/21
- **Test counts:** shared 231, server 102, client 184
- **Files changed:** `client/src/components/ui/GameHUD.tsx`, `client/src/components/ui/AbilityBar.tsx`, `client/src/components/ui/ShipTray.tsx`
- **Lessons learned:** At 1024x768, existing `sm:` and `md:` breakpoints were already active (1024 > 640/768). Main concern is vertical compactness — 768px height with HUD (72px) + AbilityBar (80px) leaves ~616px game area. ShipTray (~380px) fits fine. Added `lg:` (1024px width) breakpoints to reduce margins (mt-4→lg:mt-2, mb-4→lg:mb-2) and compact ShipTray padding (p-4→lg:p-3). Added `max-h-[calc(100%-24px)] overflow-y-auto` to ShipTray as safety net. Width-based `lg:` breakpoints are appropriate for tablet landscape since 1024px is exactly the target width.
- **Self-improvements:** none
- **New tasks discovered:** none

### Run [2026-04-13 22:16]
- **Task:** TASK-018 — Add post-game match summary enhancement
- **Outcome:** success
- **PR:** https://github.com/g-chappell/battleships/pull/22
- **Test counts:** shared 231, server 102, client 184
- **Files changed:** `client/src/store/gameStore.ts`, `client/src/components/ui/GameOverScreen.tsx`
- **Lessons learned:** GameOverScreen already showed opponent ships (multiplayer only) and abilities used (multiplayer only). The main gap was: (1) player's own board was never shown, (2) miss cells were not rendered on mini-boards, (3) single-player had no ability tracking. For the board reveal, `engine.playerBoard.ships` / `engine.opponentBoard.ships` are always populated (no fog-of-war locally), while `engine.playerBoard.grid` / `engine.opponentBoard.grid` contain CellState values including Miss for rendering shot misses. The `serializeShips` helper converts `Ship[]` (hits as Set<string>) to `SerializedShip[]` (hits as string[]) needed by MiniBoard. Ability tracking in `useAbility` must fire after `canUseAbility()` passes but before the switch — even if an individual execute function returns null, tracking at that point is safe since `canUseAbility` already validated it was executable.
- **Self-improvements:** none
- **New tasks discovered:** none
