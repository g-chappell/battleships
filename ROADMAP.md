# ROADMAP — Ironclad Waters

> This file is the task backlog for the autonomous development agent.
> **Human** controls: adding epics/stories/tasks, setting priorities, writing descriptions, removing tasks.
> **Agent** can: change task status (ready/in-progress/done/blocked), append discovered tasks, add pr/completed/blocked_reason/depends_on fields.

## Statuses
- **ready** — Available for the agent (subject to dependency and open-PR checks)
- **in-progress** — Currently being implemented on a feature branch
- **done** — PR merged into main
- **blocked** — Implementation attempted but failed

## Task selection rules
The agent always picks the lowest-priority-numbered `ready` task that satisfies ALL of:
1. No open PR exists for its branch (`auto/TASK-XXX-*`)
2. Every task listed in `depends_on` has `status: done`

## Schema
Each task entry uses these fields (agent-writable fields marked †):
- **title**, **priority**, **workspaces**, **complexity**, **description** — set by human, never changed by agent
- **depends_on** — optional list of TASK IDs that must be `done` first; set by human or appended by agent on discovery
- **status** † — ready / in-progress / done / blocked
- **pr** † — PR URL, added on completion
- **completed** † — ISO date, added on completion
- **blocked_reason** † — brief description, added on failure

---

## Epic: Test Coverage
> Comprehensive automated tests across all three workspaces before significant feature work begins. A green test suite is the safety net that lets the agent work autonomously with confidence.

### Story: Shared Module Tests
> Unit tests for every module in `shared/src/`. Provides a regression harness for the game engine, abilities, traits, campaign, and supporting utilities.

#### TASK-001
- **title:** Add campaign module unit tests
- **status:** done
- **priority:** 1
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `campaign.ts` — mission data integrity (all 15 missions have valid IDs, star requirements, difficulty settings), `calculateStars` logic with various turn/accuracy/ship inputs, `getMission` lookup, and comic panel definitions.
- **pr:** https://github.com/g-chappell/battleships/pull/4
- **completed:** 2026-04-13

#### TASK-002
- **title:** Add tournament bracket unit tests
- **status:** done
- **priority:** 2
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `tournaments.ts` — `seedPairings` produces correct matchups for sizes 4/8/16, `nextBracketSlot` advances correctly, `totalRounds` returns log2 of size, `isFinalRound` detects the last round. Validate `VALID_TOURNAMENT_SIZES` constant. Edge cases: invalid sizes, boundary conditions.
- **pr:** https://github.com/g-chappell/battleships/pull/5
- **completed:** 2026-04-13

#### TASK-003
- **title:** Add replay schema unit tests
- **status:** done
- **priority:** 3
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `replay.ts` — verify `MAX_REPLAY_EVENTS` is a sensible constant, validate `ReplayData` structure can be constructed and serialized, test that replay event types cover all game actions (shot, ability, trait trigger). Ensure type exports are usable.
- **pr:** https://github.com/g-chappell/battleships/pull/6
- **completed:** 2026-04-13

#### TASK-004
- **title:** Add seasons helper unit tests
- **status:** done
- **priority:** 4
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `seasons.ts` — `getSeasonTimeRemaining` with future end dates (returns positive days/hours), past end dates (returns zeros), edge cases (exactly now, 1 second remaining). Verify `SEASON_DEFAULT_DURATION_DAYS` and `SEASON_START_RATING` constants.
- **pr:** https://github.com/g-chappell/battleships/pull/7
- **completed:** 2026-04-13

#### TASK-005
- **title:** Add cosmetics catalog validation tests
- **status:** done
- **priority:** 5
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `cosmetics.ts` — verify all `COSMETIC_CATALOG` entries have valid IDs (no duplicates), prices > 0, valid rarity and kind fields. Test `getCosmetic` returns correct item or undefined. Test `getCosmeticsByKind` filters correctly. Verify `GOLD_REWARDS` has entries for all reward reasons.
- **pr:** https://github.com/g-chappell/battleships/pull/8
- **completed:** 2026-04-13

#### TASK-006
- **title:** Add clans type validation tests
- **status:** done
- **priority:** 6
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `clans.ts` — verify type structures are constructable, ClanRole values are correct (leader, officer, member), ClanDetail extends ClanSummary fields. Since this is mostly types, tests validate structural contracts.
- **pr:** https://github.com/g-chappell/battleships/pull/9
- **completed:** 2026-04-13

#### TASK-007
- **title:** Add captains definition tests
- **status:** done
- **priority:** 7
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `captains.ts` — verify `CAPTAIN_DEFS` has entries for all `CAPTAIN_IDS`, each captain has valid ability loadouts (abilities exist in `ABILITY_DEFS`), `DEFAULT_CAPTAIN` is a valid captain ID. Verify no duplicate IDs.
- **pr:** https://github.com/g-chappell/battleships/pull/10
- **completed:** 2026-04-13

### Story: Client Store Tests
> Unit tests for all Zustand stores in `client/src/store/`. Each store is tested in isolation with audio and API calls mocked.

#### TASK-008
- **title:** Add settingsStore unit tests
- **status:** done
- **priority:** 8
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client settingsStore — volume controls (set, get, bounds checking), mute toggle, music toggle. Mock the audio service. Follow existing client test patterns (see `gameStore.test.ts` and `authStore.test.ts` for setup).
- **pr:** https://github.com/g-chappell/battleships/pull/11
- **completed:** 2026-04-13

#### TASK-009
- **title:** Add cosmeticsStore unit tests
- **status:** done
- **priority:** 9
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client cosmeticsStore — equipping/unequipping items, purchasing cosmetics, gold balance deduction, catalog filtering by kind. Mock audio service and any API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/13
- **completed:** 2026-04-13

#### TASK-010
- **title:** Add campaignStore unit tests
- **status:** done
- **priority:** 10
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for the client campaignStore — mission progress tracking, star recording, mission unlock logic (sequential unlock based on previous completion), current mission state. Mock audio service and API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/14
- **completed:** 2026-04-13

#### TASK-011
- **title:** Add spectatorStore unit tests
- **status:** done
- **priority:** 11
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client spectatorStore — joining spectator mode, receiving board state updates, leaving spectator mode, handling invalid match IDs. Mock socket connections.
- **pr:** https://github.com/g-chappell/battleships/pull/15
- **completed:** 2026-04-13

#### TASK-012
- **title:** Add tournamentsStore unit tests
- **status:** done
- **priority:** 12
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client tournamentsStore — tournament listing, joining a tournament, bracket state management, status transitions. Mock API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/16
- **completed:** 2026-04-13

#### TASK-013
- **title:** Add replayStore unit tests
- **status:** done
- **priority:** 13
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for the client replayStore — replay loading from match data, playback state (playing/paused), event stepping forward/backward, speed controls, seek to specific event. Mock API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/17
- **completed:** 2026-04-13

### Story: Server Service Tests
> Unit tests for server-side services that have no coverage yet. Uses Prisma mocking pattern established in existing server tests.

#### TASK-015
- **title:** Add server tournament service tests
- **status:** in-progress
- **priority:** 15
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/tournaments.ts` — bracket generation via `seedPairings`, match advancement via `nextBracketSlot`, winner determination, gold rewards on tournament completion. Will need Prisma mocking pattern.

#### TASK-016
- **title:** Add server clans service tests
- **status:** ready
- **priority:** 16
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/clans.ts` — clan creation, joining, leaving, role management (promote/demote), chat message storage. Will need Prisma mocking pattern.

---

## Epic: CI/CD Pipeline
> Automated validation on every push and PR so regressions are caught before merge, not after.

### Story: Automated Test & Build Pipeline

#### TASK-014
- **title:** Add GitHub Actions CI workflow
- **status:** ready
- **priority:** 14
- **workspaces:** shared, client, server
- **complexity:** medium
- **depends_on:** [TASK-013, TASK-015, TASK-016]
- **description:** Create `.github/workflows/ci.yml` — on push and PR to main, run: TypeScript type-check (`cd client && npx tsc --noEmit`), all three test suites (`npm run test --workspace=shared|server|client`), and client production build (`npm run build --workspace=client`). Use Node 20. Cache node_modules. Depends on all test stories being complete so the CI baseline is meaningful from day one.

---

## Epic: Gameplay Enhancements
> Post-launch improvements to the core game loop. Ordered so that UI changes to shared screens (GameOverScreen) land before additive features build on top of them.

### Story: Post-Game Experience
> Improve what players see and can do after a match ends.

#### TASK-018
- **title:** Add post-game match summary enhancement
- **status:** ready
- **priority:** 18
- **workspaces:** client, shared
- **complexity:** medium
- **description:** After game ends, enhance GameOverScreen to show full board reveal with both sides visible, shot accuracy stats, abilities used, and total turns taken. Add the data to the existing game-over flow.

#### TASK-019
- **title:** Add rematch functionality
- **status:** ready
- **priority:** 19
- **workspaces:** shared, client, server
- **complexity:** large
- **depends_on:** [TASK-018]
- **description:** Add "Rematch" button to GameOverScreen that sends a rematch request via socket. Server creates a new room with the same players. Both players must accept. Add socket events to `sockets.ts`, handle in `gameSocket.ts`, add UI to `GameOverScreen`. Depends on TASK-018 because both tasks modify GameOverScreen — landing the summary enhancement first avoids a merge conflict on that component.

---

## Epic: Platform & UX
> Cross-cutting improvements to usability that are independent of the game feature roadmap.

### Story: Mobile & Responsive Layout

#### TASK-017
- **title:** Mobile viewport improvements for GamePage
- **status:** ready
- **priority:** 17
- **workspaces:** client
- **complexity:** medium
- **description:** Add responsive breakpoints to GamePage for tablet landscape (1024x768). Ensure HUD, ability bar, and board controls are usable at this size. Add media queries and flex adjustments — do not redesign the layout.
