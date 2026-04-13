# Agent Log — Ironclad Waters

> Autonomous development agent run log. Each entry is appended after a scheduled run.
> Tracks: tasks attempted, outcomes, lessons learned, self-improvements, test counts.

---

## Run History

<!-- Agent appends entries below this line -->

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
