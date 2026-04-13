# ROADMAP — Ironclad Waters

> This file is the task backlog for the autonomous development agent.
> **Human** controls: adding tasks, setting priorities, writing descriptions, removing tasks.
> **Agent** can: change status (ready/in-progress/done/blocked), append discovered tasks, add pr/completed/blocked_reason fields.

## Statuses
- **ready** — Available for the agent to pick up
- **in-progress** — Currently being implemented
- **done** — Completed with PR opened
- **blocked** — Implementation attempted but failed

## Priority
Lower number = higher priority. Agent picks the lowest-numbered `ready` task.

---

## Tasks

### TASK-001
- **title:** Add campaign module unit tests
- **status:** done
- **priority:** 1
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `campaign.ts` — mission data integrity (all 15 missions have valid IDs, star requirements, difficulty settings), `calculateStars` logic with various turn/accuracy/ship inputs, `getMission` lookup, and comic panel definitions. This is a documented coverage gap in CLAUDE.md.
- **pr:** https://github.com/g-chappell/battleships/pull/4
- **completed:** 2026-04-13

### TASK-002
- **title:** Add tournament bracket unit tests
- **status:** done
- **priority:** 2
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `tournaments.ts` — `seedPairings` produces correct matchups for sizes 4/8/16, `nextBracketSlot` advances correctly, `totalRounds` returns log2 of size, `isFinalRound` detects the last round. Validate `VALID_TOURNAMENT_SIZES` constant. Edge cases: invalid sizes, boundary conditions.
- **pr:** https://github.com/g-chappell/battleships/pull/5
- **completed:** 2026-04-13

### TASK-003
- **title:** Add replay schema unit tests
- **status:** in-progress
- **priority:** 3
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `replay.ts` — verify `MAX_REPLAY_EVENTS` is a sensible constant, validate `ReplayData` structure can be constructed and serialized, test that replay event types cover all game actions (shot, ability, trait trigger). Ensure type exports are usable.

### TASK-004
- **title:** Add seasons helper unit tests
- **status:** ready
- **priority:** 4
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `seasons.ts` — `getSeasonTimeRemaining` with future end dates (returns positive days/hours), past end dates (returns zeros), edge cases (exactly now, 1 second remaining). Verify `SEASON_DEFAULT_DURATION_DAYS` and `SEASON_START_RATING` constants.

### TASK-005
- **title:** Add cosmetics catalog validation tests
- **status:** ready
- **priority:** 5
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `cosmetics.ts` — verify all `COSMETIC_CATALOG` entries have valid IDs (no duplicates), prices > 0, valid rarity and kind fields. Test `getCosmetic` returns correct item or undefined. Test `getCosmeticsByKind` filters correctly. Verify `GOLD_REWARDS` has entries for all reward reasons.

### TASK-006
- **title:** Add clans type validation tests
- **status:** ready
- **priority:** 6
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `clans.ts` — verify type structures are constructable, ClanRole values are correct (leader, officer, member), ClanDetail extends ClanSummary fields. Since this is mostly types, tests validate structural contracts.

### TASK-007
- **title:** Add captains definition tests
- **status:** ready
- **priority:** 7
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `captains.ts` — verify `CAPTAIN_DEFS` has entries for all `CAPTAIN_IDS`, each captain has valid ability loadouts (abilities exist in `ABILITY_DEFS`), `DEFAULT_CAPTAIN` is a valid captain ID. Verify no duplicate IDs.

### TASK-008
- **title:** Add settingsStore unit tests
- **status:** ready
- **priority:** 8
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client settingsStore — volume controls (set, get, bounds checking), mute toggle, music toggle. Mock the audio service. Follow existing client test patterns (see `gameStore.test.ts` and `authStore.test.ts` for setup).

### TASK-009
- **title:** Add cosmeticsStore unit tests
- **status:** ready
- **priority:** 9
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client cosmeticsStore — equipping/unequipping items, purchasing cosmetics, gold balance deduction, catalog filtering by kind. Mock audio service and any API calls.

### TASK-010
- **title:** Add campaignStore unit tests
- **status:** ready
- **priority:** 10
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for the client campaignStore — mission progress tracking, star recording, mission unlock logic (sequential unlock based on previous completion), current mission state. Mock audio service and API calls.

### TASK-011
- **title:** Add spectatorStore unit tests
- **status:** ready
- **priority:** 11
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client spectatorStore — joining spectator mode, receiving board state updates, leaving spectator mode, handling invalid match IDs. Mock socket connections.

### TASK-012
- **title:** Add tournamentsStore unit tests
- **status:** ready
- **priority:** 12
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client tournamentsStore — tournament listing, joining a tournament, bracket state management, status transitions. Mock API calls.

### TASK-013
- **title:** Add replayStore unit tests
- **status:** ready
- **priority:** 13
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for the client replayStore — replay loading from match data, playback state (playing/paused), event stepping forward/backward, speed controls, seek to specific event. Mock API calls.

### TASK-014
- **title:** Add GitHub Actions CI workflow
- **status:** ready
- **priority:** 14
- **workspaces:** shared, client, server
- **complexity:** medium
- **description:** P2 item from PRD. Create `.github/workflows/ci.yml` — on push and PR to main, run: TypeScript type-check (`cd client && npx tsc --noEmit`), all three test suites (`npm run test --workspace=shared|server|client`), and client production build (`npm run build --workspace=client`). Use Node 20. Cache node_modules.

### TASK-015
- **title:** Add server tournament service tests
- **status:** ready
- **priority:** 15
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/tournaments.ts` — bracket generation via `seedPairings`, match advancement via `nextBracketSlot`, winner determination, gold rewards on tournament completion. Will need Prisma mocking pattern.

### TASK-016
- **title:** Add server clans service tests
- **status:** ready
- **priority:** 16
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/clans.ts` — clan creation, joining, leaving, role management (promote/demote), chat message storage. Will need Prisma mocking pattern.

### TASK-017
- **title:** Mobile viewport improvements for GamePage
- **status:** ready
- **priority:** 17
- **workspaces:** client
- **complexity:** medium
- **description:** P2-5 from PRD. Add responsive breakpoints to GamePage for tablet landscape (1024x768). Ensure HUD, ability bar, and board controls are usable at this size. Add media queries and flex adjustments — do not redesign the layout.

### TASK-018
- **title:** Add post-game match summary enhancement
- **status:** ready
- **priority:** 18
- **workspaces:** client, shared
- **complexity:** medium
- **description:** P1-5 from PRD. After game ends, enhance GameOverScreen to show full board reveal with both sides visible, shot accuracy stats, abilities used, and total turns taken. Add the data to the existing game-over flow.

### TASK-019
- **title:** Add rematch functionality
- **status:** ready
- **priority:** 19
- **workspaces:** shared, client, server
- **complexity:** large
- **description:** P1-5 from PRD. Add "Rematch" button to GameOverScreen that sends a rematch request via socket. Server creates a new room with the same players. Both players must accept. Add socket events to `sockets.ts`, handle in `gameSocket.ts`, add UI to `GameOverScreen`.
