# ROADMAP — Ironclad Waters

> This file is the task backlog for the autonomous development agent.
> **Human** controls: adding epics/stories/tasks, setting priorities, writing descriptions, removing tasks.
> **Agent** can: change task status (ready/in-progress/done/blocked), append discovered tasks, add pr/completed/blocked_reason/depends_on fields.

## Statuses
- **ready** — Available for the agent (subject to dependency and open-PR checks)
- **in-progress** — Currently being implemented on a feature branch
- **done** — PR merged into main
- **blocked** — Implementation attempted but failed

## Priority Levels
- **high** — Do first. Core functionality, user-facing quality, or correctness issues.
- **med** — Do after all high-priority ready tasks are complete. Important but not urgent.
- **low** — Do last. Nice-to-have improvements, minor cleanup.

## Task selection rules
The agent picks the next `ready` task using these criteria in order:
1. **Priority level** — high before med before low
2. **Task sequence** — within the same priority level, pick the lowest TASK number
3. **Dependencies** — every task listed in `depends_on` must have `status: done`
4. **No open PR** — no open PR exists for its branch (`auto/TASK-XXX-*`)

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
- **priority:** high
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `campaign.ts` — mission data integrity (all 15 missions have valid IDs, star requirements, difficulty settings), `calculateStars` logic with various turn/accuracy/ship inputs, `getMission` lookup, and comic panel definitions.
- **pr:** https://github.com/g-chappell/battleships/pull/4
- **completed:** 2026-04-13

#### TASK-002
- **title:** Add tournament bracket unit tests
- **status:** done
- **priority:** high
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `tournaments.ts` — `seedPairings` produces correct matchups for sizes 4/8/16, `nextBracketSlot` advances correctly, `totalRounds` returns log2 of size, `isFinalRound` detects the last round. Validate `VALID_TOURNAMENT_SIZES` constant. Edge cases: invalid sizes, boundary conditions.
- **pr:** https://github.com/g-chappell/battleships/pull/5
- **completed:** 2026-04-13

#### TASK-003
- **title:** Add replay schema unit tests
- **status:** done
- **priority:** high
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `replay.ts` — verify `MAX_REPLAY_EVENTS` is a sensible constant, validate `ReplayData` structure can be constructed and serialized, test that replay event types cover all game actions (shot, ability, trait trigger). Ensure type exports are usable.
- **pr:** https://github.com/g-chappell/battleships/pull/6
- **completed:** 2026-04-13

#### TASK-004
- **title:** Add seasons helper unit tests
- **status:** done
- **priority:** high
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `seasons.ts` — `getSeasonTimeRemaining` with future end dates (returns positive days/hours), past end dates (returns zeros), edge cases (exactly now, 1 second remaining). Verify `SEASON_DEFAULT_DURATION_DAYS` and `SEASON_START_RATING` constants.
- **pr:** https://github.com/g-chappell/battleships/pull/7
- **completed:** 2026-04-13

#### TASK-005
- **title:** Add cosmetics catalog validation tests
- **status:** done
- **priority:** high
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `cosmetics.ts` — verify all `COSMETIC_CATALOG` entries have valid IDs (no duplicates), prices > 0, valid rarity and kind fields. Test `getCosmetic` returns correct item or undefined. Test `getCosmeticsByKind` filters correctly. Verify `GOLD_REWARDS` has entries for all reward reasons.
- **pr:** https://github.com/g-chappell/battleships/pull/8
- **completed:** 2026-04-13

#### TASK-006
- **title:** Add clans type validation tests
- **status:** done
- **priority:** high
- **workspaces:** shared
- **complexity:** small
- **description:** Add tests for `clans.ts` — verify type structures are constructable, ClanRole values are correct (leader, officer, member), ClanDetail extends ClanSummary fields. Since this is mostly types, tests validate structural contracts.
- **pr:** https://github.com/g-chappell/battleships/pull/9
- **completed:** 2026-04-13

#### TASK-007
- **title:** Add captains definition tests
- **status:** done
- **priority:** high
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
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client settingsStore — volume controls (set, get, bounds checking), mute toggle, music toggle. Mock the audio service. Follow existing client test patterns (see `gameStore.test.ts` and `authStore.test.ts` for setup).
- **pr:** https://github.com/g-chappell/battleships/pull/11
- **completed:** 2026-04-13

#### TASK-009
- **title:** Add cosmeticsStore unit tests
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client cosmeticsStore — equipping/unequipping items, purchasing cosmetics, gold balance deduction, catalog filtering by kind. Mock audio service and any API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/13
- **completed:** 2026-04-13

#### TASK-010
- **title:** Add campaignStore unit tests
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for the client campaignStore — mission progress tracking, star recording, mission unlock logic (sequential unlock based on previous completion), current mission state. Mock audio service and API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/14
- **completed:** 2026-04-13

#### TASK-011
- **title:** Add spectatorStore unit tests
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client spectatorStore — joining spectator mode, receiving board state updates, leaving spectator mode, handling invalid match IDs. Mock socket connections.
- **pr:** https://github.com/g-chappell/battleships/pull/15
- **completed:** 2026-04-13

#### TASK-012
- **title:** Add tournamentsStore unit tests
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for the client tournamentsStore — tournament listing, joining a tournament, bracket state management, status transitions. Mock API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/16
- **completed:** 2026-04-13

#### TASK-013
- **title:** Add replayStore unit tests
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for the client replayStore — replay loading from match data, playback state (playing/paused), event stepping forward/backward, speed controls, seek to specific event. Mock API calls.
- **pr:** https://github.com/g-chappell/battleships/pull/17
- **completed:** 2026-04-13

### Story: Server Service Tests
> Unit tests for server-side services that have no coverage yet. Uses Prisma mocking pattern established in existing server tests.

#### TASK-015
- **title:** Add server tournament service tests
- **status:** done
- **priority:** high
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/tournaments.ts` — bracket generation via `seedPairings`, match advancement via `nextBracketSlot`, winner determination, gold rewards on tournament completion. Will need Prisma mocking pattern.
- **pr:** https://github.com/g-chappell/battleships/pull/18
- **completed:** 2026-04-13

#### TASK-016
- **title:** Add server clans service tests
- **status:** done
- **priority:** high
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/clans.ts` — clan creation, joining, leaving, role management (promote/demote), chat message storage. Will need Prisma mocking pattern.
- **pr:** https://github.com/g-chappell/battleships/pull/19
- **completed:** 2026-04-13

---

## Epic: CI/CD Pipeline
> Automated validation on every push and PR so regressions are caught before merge, not after.

### Story: Automated Test & Build Pipeline

#### TASK-014
- **title:** Add GitHub Actions CI workflow
- **status:** done
- **priority:** high
- **workspaces:** shared, client, server
- **complexity:** medium
- **depends_on:** [TASK-013, TASK-015, TASK-016]
- **description:** Create `.github/workflows/ci.yml` — on push and PR to main, run: TypeScript type-check (`cd client && npx tsc --noEmit`), all three test suites (`npm run test --workspace=shared|server|client`), and client production build (`npm run build --workspace=client`). Use Node 20. Cache node_modules. Depends on all test stories being complete so the CI baseline is meaningful from day one.
- **pr:** https://github.com/g-chappell/battleships/pull/20
- **completed:** 2026-04-13

---

## Epic: Gameplay Enhancements
> Post-launch improvements to the core game loop. Ordered so that UI changes to shared screens (GameOverScreen) land before additive features build on top of them.

### Story: Post-Game Experience
> Improve what players see and can do after a match ends.

#### TASK-018
- **title:** Add post-game match summary enhancement
- **status:** done
- **priority:** high
- **workspaces:** client, shared
- **complexity:** medium
- **description:** After game ends, enhance GameOverScreen to show full board reveal with both sides visible, shot accuracy stats, abilities used, and total turns taken. Add the data to the existing game-over flow.
- **pr:** https://github.com/g-chappell/battleships/pull/22
- **completed:** 2026-04-13

#### TASK-019
- **title:** Add rematch functionality
- **status:** done
- **priority:** high
- **workspaces:** shared, client, server
- **complexity:** large
- **depends_on:** [TASK-018]
- **description:** Add "Rematch" button to GameOverScreen that sends a rematch request via socket. Server creates a new room with the same players. Both players must accept. Add socket events to `sockets.ts`, handle in `gameSocket.ts`, add UI to `GameOverScreen`. Depends on TASK-018 because both tasks modify GameOverScreen — landing the summary enhancement first avoids a merge conflict on that component.
- **pr:** https://github.com/g-chappell/battleships/pull/23
- **completed:** 2026-04-13

---

## Epic: Platform & UX
> Cross-cutting improvements to usability that are independent of the game feature roadmap.

### Story: Mobile & Responsive Layout

#### TASK-017
- **title:** Mobile viewport improvements for GamePage
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **description:** Add responsive breakpoints to GamePage for tablet landscape (1024x768). Ensure HUD, ability bar, and board controls are usable at this size. Add media queries and flex adjustments — do not redesign the layout.
- **pr:** https://github.com/g-chappell/battleships/pull/21
- **completed:** 2026-04-13

---

## Epic: UI Revamp — shadcn + Brand Consistency
> Replace hand-built UI primitives with themed shadcn components and audit all pages for brand guideline adherence. Uses the shadcn MCP server for component discovery/installation and the `brand-guidelines` skill for design tokens. Every task in this epic must visually verify the result via the `verify-ui` skill before marking complete.

### Story: Core UI Primitives
> Replace hand-rolled modals, form controls, and overlays with shadcn equivalents themed to the pirate palette. This establishes the component foundation that later pages build on.

#### TASK-038
- **title:** Replace SettingsModal with shadcn Dialog + Switch + Slider
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **description:** The current `SettingsModal` (`client/src/components/ui/SettingsModal.tsx`) is a hand-built modal overlay with custom toggle buttons and range inputs for volume/mute/music. Replace with shadcn `Dialog` for the modal shell, `Switch` for toggles, and `Slider` for volume controls. Install components via shadcn MCP (`npx shadcn add dialog switch slider`). Theme all components using the pirate palette CSS variables already in `index.css`. Preserve all existing functionality and keyboard accessibility. Follow brand-guidelines skill.
- **pr:** https://github.com/g-chappell/battleships/pull/31
- **completed:** 2026-04-14

#### TASK-039
- **title:** Replace hand-built form inputs with shadcn Input and Label
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-038]
- **description:** The current `FormField` component (`client/src/components/ui/FormField.tsx`) wraps raw `<input>` and `<textarea>` with ad-hoc styling. Install shadcn `Input`, `Label`, and `Textarea` components. Refactor `FormField` to compose these shadcn primitives. Update all consumers: `AuthPage` (login/register forms), `Clans` (create clan, chat input), `Friends` (search input). Ensure error states use `destructive` color token. Follow brand-guidelines skill.
- **pr:** https://github.com/g-chappell/battleships/pull/32
- **completed:** 2026-04-14

#### TASK-040
- **title:** Add shadcn Tooltip to replace custom CSS tooltips
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **depends_on:** [TASK-038]
- **description:** `IconButton` (`client/src/components/ui/IconButton.tsx`) uses custom CSS tooltips via `title` attribute or pseudo-elements. Install shadcn `Tooltip` and wrap all `IconButton` instances. Also apply to ability bar icons in `AbilityBar.tsx` that have hover descriptions. Use `coal` background with `bone` text and `gold` border for the tooltip style. Follow brand-guidelines skill.
- **pr:** https://github.com/g-chappell/battleships/pull/33
- **completed:** 2026-04-14

#### TASK-041
- **title:** Replace ad-hoc modal overlays with shadcn Dialog
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-038]
- **description:** Several pages use `absolute inset-0 bg-black/85` overlays as hand-built modals: `AuthGate` confirmation, `OpponentDisconnect` notice, `MissionBriefing` popup, and any confirmation prompts. Refactor each to use the shadcn `Dialog` component (already installed in TASK-038). This centralizes modal behavior (backdrop click, escape key, focus trap) and ensures consistent pirate theming. Follow brand-guidelines skill.
- **pr:** https://github.com/g-chappell/battleships/pull/34
- **completed:** 2026-04-14

#### TASK-042
- **title:** Add shadcn Toast for notifications and achievement popups
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-038]
- **description:** `AchievementToast` (`client/src/components/ui/AchievementToast.tsx`) is a custom notification component with CSS animations. Install shadcn `Sonner` (toast library). Replace `AchievementToast` with a themed Sonner toast. Also use for system messages (connection lost, matchmaking found, gold earned). Style toasts with `coal` background, `gold` accent border, `bone` text, and the existing `slideInRight` animation. Follow brand-guidelines skill.
- **pr:** https://github.com/g-chappell/battleships/pull/35
- **completed:** 2026-04-14

### Story: Page-Level Brand Audit
> Systematically audit each page for brand guideline adherence — correct fonts, colors, spacing, and component usage. Fix inconsistencies.

#### TASK-043
- **title:** Audit and fix MainMenu + AuthPage brand consistency
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-039, TASK-041]
- **description:** Review `MainMenu.tsx` and `AuthPage.tsx` against the brand-guidelines skill. Check: all text uses pirate font stack (no system fonts leaking), backgrounds are pitch/coal (no stray whites or grays), buttons use the `Button` component consistently, form inputs use the new shadcn-based `FormField`, spacing follows a consistent rhythm, gold accents are used for highlights. Fix any deviations. Run `verify-ui` skill to screenshot before and after.
- **pr:** https://github.com/g-chappell/battleships/pull/36
- **completed:** 2026-04-14

#### TASK-044
- **title:** Audit and fix Dashboard + Leaderboard + Profile brand consistency
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-043]
- **description:** Review `Dashboard.tsx`, `Leaderboard.tsx`, and `Profile.tsx` against the brand-guidelines skill. These stats-heavy pages often have inconsistent table styling, stray colors, and mixed font usage. Ensure all data tables, stat cards, and ranking lists use `Card` component with `panel-glow`, text is `bone`/`parchment`, numbers use `font-label`, and headings use `font-pirate`. Fix any deviations. Run `verify-ui` skill.
- **pr:** https://github.com/g-chappell/battleships/pull/37
- **completed:** 2026-04-14

#### TASK-045
- **title:** Audit and fix Shop + Campaign + Tournaments brand consistency
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-043]
- **description:** Review `Shop.tsx`, `CampaignMap.tsx`, and `Tournaments.tsx` against the brand-guidelines skill. These content-rich pages need consistent card grids, pricing displays, and progress indicators. Ensure cosmetic cards use `Card` with `panel-border`, gold prices use `text-gold` with `font-label`, star ratings use `text-gold`/`text-parchment`, and tournament brackets use `mahogany` backgrounds with `blood` active-state borders. Fix any deviations. Run `verify-ui` skill.
- **pr:** https://github.com/g-chappell/battleships/pull/38
- **completed:** 2026-04-14

#### TASK-046
- **title:** Audit and fix Clans + Friends + Guide pages brand consistency
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-043]
- **description:** Review `Clans.tsx`, `Friends.tsx`, and `GuidePage.tsx` against the brand-guidelines skill. Check chat panels use consistent styling, friend list items use `Card` with hover states, guide sections use proper heading hierarchy with `font-pirate`. Ensure all interactive elements (join/leave/invite buttons) use the `Button` component with appropriate variants. Fix any deviations. Run `verify-ui` skill.
- **pr:** https://github.com/g-chappell/battleships/pull/39
- **completed:** 2026-04-14

---

## Epic: Bug Fixes & Security
> Targeted fixes for known correctness issues discovered during codebase review.

### Story: Server Correctness

#### TASK-022
- **title:** Fix cosmetics purchase race condition
- **status:** done
- **priority:** high
- **workspaces:** server
- **complexity:** small
- **description:** The `POST /cosmetics/buy` handler reads gold balance then deducts in two separate queries — two concurrent requests can both pass the balance check. Wrap the check-and-deduct in a Prisma `$transaction` with a conditional update (`WHERE gold >= price`) that returns the updated row or null. Return 400 if the transaction returns null (insufficient gold after atomic check).
- **pr:** https://github.com/g-chappell/battleships/pull/27
- **completed:** 2026-04-14

### Story: Input Validation

#### TASK-033
- **title:** Add email format validation on register
- **status:** done
- **priority:** med
- **workspaces:** client, server
- **complexity:** small
- **description:** The register flow currently accepts any string as an email. Add a simple regex check (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) server-side in `auth.ts` (return 400 on invalid format) and a matching inline validation message client-side on the register form before submission.
- **pr:** https://github.com/g-chappell/battleships/pull/51
- **completed:** 2026-04-15

#### TASK-034
- **title:** Add rate limiting to clan chat messages
- **status:** done
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Game chat already enforces a 5-message/10-second rate limit in `gameSocket.ts`. Apply the same pattern to the clan chat endpoint in `server/src/services/clans.ts` or the socket handler — track per-user message timestamps and reject if the limit is exceeded.
- **pr:** https://github.com/g-chappell/battleships/pull/52
- **completed:** 2026-04-15

---

## Epic: Client Resilience
> Defensive improvements to prevent silent failures and improve recovery from transient errors.

### Story: Error Handling & Recovery

#### TASK-035
- **title:** Add React error boundaries to GamePage and Three.js canvas
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **description:** Unhandled errors in the Three.js R3F canvas or GamePage currently crash the entire app. Wrap `GamePage` and the `<Canvas>` component in an `ErrorBoundary` class component that renders a "Something went wrong — return to menu" fallback. Do not add error boundaries to every component — only the two highest-risk render trees.
- **pr:** https://github.com/g-chappell/battleships/pull/29
- **completed:** 2026-04-14

#### TASK-036
- **title:** Add AudioContext cleanup on page unload
- **status:** done
- **priority:** low
- **workspaces:** client
- **complexity:** small
- **description:** The Web Audio API `AudioContext` and any live oscillators/buffers are never closed when the user leaves the page. Add a `beforeunload` event listener in `client/src/services/audio.ts` that calls `audioContext.close()` to release resources and prevent oscillator leaks in browser profiles.
- **pr:** https://github.com/g-chappell/battleships/pull/53
- **completed:** 2026-04-15

#### TASK-037
- **title:** Add socket reconnection with exponential backoff
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **description:** `socketStore.ts` currently has no retry logic — a single disconnect ends the multiplayer session. Add exponential backoff reconnection (initial 1s, double each attempt, cap at 30s, max 5 attempts) with a visible "Reconnecting…" status in the UI. On max-attempts exceeded, show a "Connection lost — return to menu" message. Do not add reconnection for intentional disconnects (logout, navigate away).
- **pr:** https://github.com/g-chappell/battleships/pull/30
- **completed:** 2026-04-14

---

## Epic: Extended Test Coverage
> Fill remaining gaps in server services, server routes, and client stores that were out of scope for the initial test coverage epic.

### Story: Additional Server Service Tests
> Tests for server services that were skipped in the first pass — gold rewards (financial logic), match persistence (ELO integrity), and season state.

#### TASK-020
- **title:** Add gold service unit tests
- **status:** done
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Add tests for `server/src/services/gold.ts` — reward amounts for all game modes (ranked win/loss, AI easy/medium/hard win, tournament placement). Verify gold is not awarded to guests. Use Prisma mocking pattern from existing server tests.
- **pr:** https://github.com/g-chappell/battleships/pull/24
- **completed:** 2026-04-14

#### TASK-021
- **title:** Add persistence service unit tests
- **status:** done
- **priority:** med
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/services/persistence.ts` — match recording (all fields persisted), ELO update applied to both players after ranked match, guest players skipped gracefully, replay storage and retrieval. Mock Prisma with `vi.hoisted()` pattern.
- **pr:** https://github.com/g-chappell/battleships/pull/25
- **completed:** 2026-04-14

#### TASK-026
- **title:** Add seasons service unit tests
- **status:** done
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Add tests for `server/src/services/seasons.ts` — `getActiveSeason` returns current season or null, `getOrCreateSeasonStats` creates entry on first call and returns existing on subsequent calls, season transition logic. Mock Prisma with `vi.hoisted()` pattern.
- **pr:** https://github.com/g-chappell/battleships/pull/42
- **completed:** 2026-04-14

### Story: Server Route Tests
> Integration-style unit tests for Express route handlers. Mock Prisma and JWT — test the HTTP layer (status codes, response bodies, error cases).

#### TASK-023
- **title:** Add auth route unit tests
- **status:** done
- **priority:** med
- **workspaces:** server
- **complexity:** medium
- **description:** Add tests for `server/src/routes/auth.ts` — register (success, duplicate username, missing fields, short password), login (correct password issues JWT, wrong password returns 401, unknown user returns 401), guest token endpoint. Mock bcrypt and Prisma.
- **pr:** https://github.com/g-chappell/battleships/pull/28
- **completed:** 2026-04-14

#### TASK-024
- **title:** Add leaderboard route unit tests
- **status:** done
- **priority:** med
- **pr:** https://github.com/g-chappell/battleships/pull/40
- **completed:** 2026-04-14
- **workspaces:** server
- **complexity:** small
- **description:** Add tests for `server/src/routes/leaderboard.ts` — lifetime rankings (correct sort order, limit), seasonal rankings (filters by active season), empty-DB returns empty array rather than 500. Mock Prisma with `vi.hoisted()` pattern.

#### TASK-025
- **title:** Add cosmetics route unit tests
- **status:** done
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Add tests for `server/src/routes/cosmetics.ts` — buy (success deducts gold, insufficient gold returns 400, already owned returns 400), equip (success, not owned returns 403), list owned cosmetics. Mock Prisma with `vi.hoisted()` pattern.
- **pr:** https://github.com/g-chappell/battleships/pull/41
- **completed:** 2026-04-14

### Story: Remaining Client Store Tests
> Unit tests for the five client Zustand stores that had no coverage after the initial client store testing epic, plus the `apiClient` service.

#### TASK-027
- **title:** Add achievementsStore unit tests
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/store/achievementsStore.ts` — `checkAchievements` unlocks the correct achievement when conditions are met, does not double-unlock, stores unlocked IDs. Mock audio service. Follow existing client test patterns.
- **pr:** https://github.com/g-chappell/battleships/pull/43
- **completed:** 2026-04-14

#### TASK-028
- **title:** Add clanStore unit tests
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for `client/src/store/clanStore.ts` — create clan (success sets current clan, error sets error state), join clan, leave clan, fetch chat messages, send chat message. Mock `apiFetch`/`apiFetchSafe` and audio service.
- **pr:** https://github.com/g-chappell/battleships/pull/44
- **completed:** 2026-04-14

#### TASK-029
- **title:** Add friendsStore unit tests
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/store/friendsStore.ts` — send friend request, accept/reject incoming request, remove friend, localStorage fallback when API unavailable. Mock `apiFetch`/`apiFetchSafe` and audio service.
- **pr:** https://github.com/g-chappell/battleships/pull/45
- **completed:** 2026-04-14

#### TASK-030
- **title:** Add seasonsStore unit tests
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/store/seasonsStore.ts` — fetch active season (populates state), fetch player season stats, null handling when no active season. Mock `apiFetchSafe` and audio service.
- **pr:** https://github.com/g-chappell/battleships/pull/47
- **completed:** 2026-04-14

#### TASK-031
- **title:** Add socketStore unit tests
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for `client/src/store/socketStore.ts` — connect attaches auth token, disconnect clears socket state, socket events are routed to the correct store actions, reconnect re-attaches. Use a mock socket with `_trigger` helper (same pattern as spectatorStore tests).
- **pr:** https://github.com/g-chappell/battleships/pull/48
- **completed:** 2026-04-14

#### TASK-032
- **title:** Add apiClient service unit tests
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/services/apiClient.ts` — `ApiError` construction (status, message, data fields), `apiFetch` attaches auth header when token present, throws `ApiError` on non-2xx responses, `apiFetchSafe` returns null on any error without throwing.
- **pr:** https://github.com/g-chappell/battleships/pull/49
- **completed:** 2026-04-14

---

## Epic: Gameplay Correctness & E2E Harness
> The engine code reads clean, but users have observed hit-recording and ability-conflict bugs in live matches. There is no end-to-end test harness today — unit tests cover shared/server/client in isolation but nothing exercises the full UI↔socket↔engine loop. This epic adds a Playwright-based E2E workspace, property-based engine fuzzing, and scripted server/engine tests that protect the ability→trait→stale-fix pipeline. Bugs surfaced by the new harness are fixed as they're found. Highest-priority epic — gameplay correctness gates everything else.

### Story: End-to-end test workspace

#### TASK-047
- **title:** Scaffold e2e workspace with Playwright + CI integration
- **status:** done
- **priority:** high
- **workspaces:** e2e
- **complexity:** large
- **description:** Create a new top-level `e2e/` workspace using Playwright. Add to root `package.json` workspaces. Configure Playwright to start client + server (via `npm run dev` with `wait-on` or docker-compose) before the suite, tear down after. Provide fixtures: `registeredUser` (seeds DB + logs in), `guestUser`, `socketReady` helper that waits for game-state events. Extend `.github/workflows/ci.yml` with an `e2e` job that depends on unit tests passing and must pass before merge. Document running locally in `e2e/README.md`.
- **pr:** https://github.com/g-chappell/battleships/pull/56
- **completed:** 2026-04-15

#### TASK-048
- **title:** E2E test — complete a full singleplayer match against Easy AI
- **status:** done
- **priority:** high
- **workspaces:** e2e
- **complexity:** medium
- **depends_on:** [TASK-047]
- **description:** Playwright scenario: launch campaign or singleplayer mode, place all 5 ships via the UI, fire at every enemy cell sequentially (derive targets from a deterministic AI opponent seed), assert each of the 5 ships is reported sunk on the HUD, assert GameOverScreen renders with a win, assert accuracy stats render with correct numerator/denominator. Use `data-testid` selectors on board cells and ship status indicators — add them where missing.
- **pr:** https://github.com/g-chappell/battleships/pull/57
- **completed:** 2026-04-15

#### TASK-049
- **title:** E2E test — ability rotation with hit/miss/sunk assertion per activation
- **status:** done
- **priority:** high
- **workspaces:** e2e
- **complexity:** medium
- **depends_on:** [TASK-047]
- **description:** Playwright scenario: configure a match where each of the 7 abilities (CannonBarrage, SonarPing, SmokeScreen, RepairKit, ChainShot, Spyglass, BoardingParty) is activated in sequence against a known AI ship layout (seeded opponent). After each ability activation, read the HUD's hit count, miss count, and sunk ship count; assert they match the expected values for that ability against the known layout. This is the primary regression test for the user's reported "hit recorded as miss" bug.
- **pr:** https://github.com/g-chappell/battleships/pull/58
- **completed:** 2026-04-15

#### TASK-050
- **title:** E2E test — full multiplayer match across two browser contexts
- **status:** done
- **priority:** high
- **workspaces:** e2e
- **complexity:** large
- **depends_on:** [TASK-048]
- **description:** Playwright scenario using two browser contexts (two registered users). Both join matchmaking, get paired, both place ships, play a scripted match to completion. Assert both sides see consistent outcome state (winner, final board reveal, accuracy stats). Assert the rematch flow still works: both accept → new game begins with same players. Covers socket sync regressions.

### Story: Engine invariants

#### TASK-051
- **title:** Add property-based fuzz tests on GameEngine
- **status:** done
- **priority:** high
- **workspaces:** shared
- **complexity:** medium
- **description:** Add `fast-check` (or equivalent) to shared tests. Generate random sequences of shots and ability activations against a seeded board. Assert invariants after every step: `ship.hits.size <= ship.size`, sunk iff all cells hit, `turnCount` monotonic, no cell registers twice, grid state consistent with ship.hits. Run 1000+ iterations in CI.
- **pr:** https://github.com/g-chappell/battleships/pull/50
- **completed:** 2026-04-14

#### TASK-052
- **title:** Add scripted play-to-completion tests covering trait + ability interactions
- **status:** done
- **priority:** high
- **workspaces:** shared, server
- **complexity:** medium
- **description:** Add tests that drive `GameEngine` directly in shared, and `rooms.ts` directly in server, playing matches to completion with combinations of traits (Ironclad/Spotter/Nimble/Swift) and abilities (all 7). Assert final stats, ability cooldowns, trait one-shots, and sunk counts are correct. Protects the server-side ability→trait→stale-fix pipeline (`rooms.ts:applyTraits` + `abilities.ts` stale-outcome fix).
- **pr:** https://github.com/g-chappell/battleships/pull/54
- **completed:** 2026-04-15

### Story: Bug fixes from the harness

#### TASK-053
- **title:** Reproduce and fix hit-recording / ability-conflict bugs found by the harness
- **status:** done
- **priority:** high
- **workspaces:** shared, server, client
- **complexity:** medium
- **depends_on:** [TASK-049, TASK-051]
- **description:** Any hit-recording or ability-conflict bugs surfaced by TASK-049 (UI-level) or TASK-051 (engine-level) are root-caused and fixed here. Scope limited to bugs the harness actually reproduces — do not guess. The tests that exposed each bug become the regression guard. If no bugs reproduce, close this task with a note and keep the harness as the ongoing safety net.
- **pr:** https://github.com/g-chappell/battleships/pull/66
- **completed:** 2026-04-16

---

## Epic: Top-Right Controls & Settings Modal Rebuild
> Users report the existing floating settings and mute buttons overlap the in-game narrative panel, and the SettingsModal layout feels cramped. Also missing: quick access to Profile and Logout. This epic introduces a single top-right control cluster (Profile / Settings / Sound / Logout) rendered at app root, and rebuilds the SettingsModal with proper section spacing.

### Story: Top-right HUD

#### TASK-054
- **title:** Build TopRightControls cluster (Profile / Settings / Sound / Logout)
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **description:** Create `client/src/components/ui/TopRightControls.tsx` — fixed top-right icon cluster containing Profile, Settings, Sound (mute toggle), and Logout buttons. Mount at app root, above page content, z-indexed above game HUD and narrative panel. Replaces the existing ad-hoc floating settings + mute buttons (remove the old ones). Profile button is hidden for guests; Logout is hidden for guests. Use shadcn `Tooltip` on each icon. Follow `brand-guidelines` skill.
- **pr:** https://github.com/g-chappell/battleships/pull/55
- **completed:** 2026-04-15

#### TASK-055
- **title:** Fix in-game narrative / HUD collisions with new top-right cluster
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** small
- **depends_on:** [TASK-054]
- **description:** Audit GamePage narrative panel, AbilityBar, and HUD for any visual overlap with the new top-right cluster. Adjust narrative panel position/sizing so controls remain visible and clickable during missions. Verify via `verify-ui` skill at desktop and tablet widths.
- **pr:** https://github.com/g-chappell/battleships/pull/67
- **completed:** 2026-04-16

### Story: Settings modal rebuild

#### TASK-056
- **title:** Rebuild SettingsModal layout with proper spacing and sections
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **pr:** https://github.com/g-chappell/battleships/pull/75
- **completed:** 2026-04-17
- **description:** Rework `SettingsModal.tsx` — organize controls into labeled sections (Audio, Display) using shadcn `Dialog` + `Separator`. Increase vertical spacing between controls. Ensure the Dialog has explicit max-width and the Close action does not overlap the last control. Preserve all existing functionality (master volume, sfx volume, music volume, mute toggle, music toggle). Verify via `verify-ui` skill.

---

## Epic: Auth — Username Login & Password Recovery
> The `User` model already has a unique `username` field but login is email-only. Password recovery has zero scaffolding. This epic adds username-or-email login, a registration username field, and in-app security-question-based password recovery (no SMTP dependency).

### Story: Username-or-email login

#### TASK-057
- **title:** Login accepts username OR email
- **status:** done
- **priority:** high
- **workspaces:** server, client
- **complexity:** small
- **pr:** https://github.com/g-chappell/battleships/pull/76
- **completed:** 2026-04-17
- **description:** Replace the email field on login with a single "Username or email" field. Server: look up `User.username` first, fall back to `email`. Update `POST /auth/login` in `server/src/routes/auth.ts`, `authStore.login` in client, and the login form in `AuthPage.tsx`. Error messaging stays generic ("Invalid credentials") to avoid username enumeration.

#### TASK-058
- **title:** Register form requires a username
- **status:** done
- **priority:** high
- **workspaces:** server, client
- **complexity:** small
- **depends_on:** [TASK-057]
- **description:** Add a username input to the register form. Validate client-side (length 3–20, alphanumeric + underscore). Server-side: enforce uniqueness (username is already unique in the schema); return 400 on conflict with a distinct error code from email conflict.
- **pr:** https://github.com/g-chappell/battleships/pull/77
- **completed:** 2026-04-17

### Story: Password recovery via security questions

#### TASK-059
- **title:** Add SecurityQuestion model + predefined question bank
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/78
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** server, shared
- **complexity:** medium
- **description:** Add `SecurityQuestion` Prisma model (`id`, `userId`, `questionKey`, `answerHash`, `createdAt`) with unique (userId, questionKey). Create a predefined question bank in `shared/src/securityQuestions.ts` (~10 questions like "First pet's name", etc.). At register, require the user to pick two distinct questions and answer each; answers hashed with bcrypt before storage. Add migration. Update register endpoint + form.

#### TASK-060
- **title:** Password recovery flow (identify → answer questions → reset)
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/80
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** server, client
- **complexity:** medium
- **depends_on:** [TASK-059]
- **description:** Add "Forgot password?" link on login. Three-step flow: (1) identify account by username or email, (2) answer both security questions, (3) set a new password. Server endpoints: `POST /auth/recover/identify`, `POST /auth/recover/verify`, `POST /auth/recover/reset`. Rate-limit attempts per account (5 per hour). Generic error messages to avoid enumeration. No SMTP required — fully in-app.

---

## Epic: Admin Section
> No admin concept exists today — no role field, no routes, no UI. This epic adds the foundation (role column, middleware, gated page) and four feature areas: user management, season management, tournament management, and live telemetry. Prerequisite for admin-driven tournaments and seasons.

### Story: Admin foundations

#### TASK-061
- **title:** Add role column to User + ADMIN_EMAILS env auto-promotion
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/79
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** server
- **complexity:** small
- **description:** Add `role` field to the `User` Prisma model with values `user` | `admin` (default `user`). Migration required. Add `ADMIN_EMAILS` env var (comma-separated). On login, if the user's email is in `ADMIN_EMAILS` and their role is `user`, promote them to `admin` in DB. Include `role` in the `/auth/me` response and JWT claims.

#### TASK-062
- **title:** Add requireAdmin middleware and admin route namespace
- **status:** done
- **priority:** high
- **workspaces:** server
- **complexity:** small
- **depends_on:** [TASK-061]
- **pr:** https://github.com/g-chappell/battleships/pull/82
- **completed:** 2026-04-17
- **description:** Create `server/src/middleware/requireAdmin.ts` — checks JWT claim `role === 'admin'`, returns 403 otherwise. Create `server/src/routes/admin.ts` mounted at `/admin/*`, all routes guarded by `requireAuth` + `requireAdmin`. Add health-check endpoint `GET /admin/ping` as a placeholder for the first task to wire it up.

#### TASK-063
- **title:** Admin page scaffold (gated route with sidebar)
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/83
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-061]
- **description:** Add `client/src/pages/AdminPage.tsx`, route `/admin`, gated on `authStore.user.role === 'admin'` (non-admins redirected to Dashboard). Left sidebar with sections: Users, Seasons, Tournaments, Telemetry. Each section is a stub that will be filled by TASK-064/065/066/067. Follow `brand-guidelines` skill.

### Story: Admin features

#### TASK-064
- **title:** Admin — user management (search, reset password, reset stats, adjust gold, ban)
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/87
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** server, client
- **complexity:** large
- **depends_on:** [TASK-063]
- **description:** Server endpoints under `/admin/users`: list (paginated + search by username/email), get detail (stats card), reset password (generate temp password, return to admin, flag `mustChangePassword`), reset stats (zero wins/losses/rating), adjust gold (delta or absolute), ban/unban (`bannedAt` column). Client UI: searchable user list, detail panel with action buttons each behind a confirmation dialog. Every destructive action logs an `AdminAuditLog` row (new model).

#### TASK-065
- **title:** Admin — season management (create, end, view standings)
- **status:** done
- **priority:** high
- **workspaces:** server, client
- **complexity:** medium
- **depends_on:** [TASK-063]
- **pr:** https://github.com/g-chappell/battleships/pull/88
- **completed:** 2026-04-17
- **description:** Server endpoints under `/admin/seasons`: create (name, start, end), end (early-close active season), list with standings. Replace the automatic season rollover watchdog in `seasons.ts` with an admin-trigger model (keep the 60s watchdog as a no-op or remove if confirmed unused). Client UI: season list, create form, end-season confirmation, standings table per season.

#### TASK-066
- **title:** Admin — tournament management (create, start round, advance round)
- **status:** done
- **priority:** high
- **workspaces:** server, client
- **complexity:** medium
- **depends_on:** [TASK-063]
- **pr:** https://github.com/g-chappell/battleships/pull/89
- **completed:** 2026-04-17
- **description:** Server endpoints under `/admin/tournaments`: create (name, size 4/8/16, description), open lobby, start round 1 (seeds bracket). Replace automatic progression with admin-triggered round advancement. Client UI in admin page: create form, list of active tournaments, "Start Round" / "Advance Round" buttons. Round-advance button is disabled until all matches in the current round are complete (server returns current round completion %).

#### TASK-067
- **title:** Admin — live telemetry dashboard
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/91
- **completed:** 2026-04-18
- **priority:** med
- **workspaces:** server, client
- **complexity:** medium
- **depends_on:** [TASK-063]
- **description:** Admin telemetry widget: active users (from `io.engine.clientsCount`), games in progress (from `rooms` service map size), recent match outcomes (last 50 rows with player names, mode, winner, duration). Simple card layout, polling every 10s — no charts yet. Endpoint: `GET /admin/telemetry`.

---

## Epic: Tournament Revamp
> Tournaments today auto-seed by rating and auto-advance when matches finish. The user wants: an admin-created lobby with persistent chat, player slot selection, a visual bracket, and admin-gated round-barrier progression. Depends on the Admin epic being in place.

### Story: Lobby + chat + slot selection

#### TASK-068
- **title:** Tournament lobby + DB-persisted chat
- **status:** done
- **priority:** med
- **workspaces:** server, shared
- **complexity:** medium
- **depends_on:** [TASK-066]
- **description:** Add `TournamentChatMessage` Prisma model (tournamentId, userId, message, createdAt). Apply the 5-msgs / 10-seconds rate-limit pattern from game chat. Socket events `tournament:chat:send` and `tournament:chat:new` plus `GET /tournaments/:id/chat` for history (last 100). Add socket events `tournament:lobby:joined` / `tournament:lobby:left` for live roster updates.
- **pr:** https://github.com/g-chappell/battleships/pull/92
- **completed:** 2026-04-18

#### TASK-069
- **title:** Tournament lobby UI with joinable bracket slots and chat panel
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/94
- **completed:** 2026-04-19
- **priority:** med
- **workspaces:** client
- **complexity:** large
- **depends_on:** [TASK-068]
- **description:** Tournament detail page gains a pre-start lobby: joinable slot cards (players click an empty slot to commit), live roster of committed entrants, chat panel. Once the admin starts round 1, the lobby view swaps to the bracket view. Use shadcn `Card` for slots, existing chat styling from clan chat for the panel.

#### TASK-070
- **title:** Visual bracket component (responsive single-elimination tree)
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/95
- **completed:** 2026-04-20
- **priority:** med
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-069]
- **description:** Build a responsive single-elimination bracket view for sizes 4/8/16. Shows match status (pending / in-progress / done), round badges, winner highlighting, click-through to spectator mode for in-progress matches. CSS-grid or SVG-based — no third-party bracket library. Follow `brand-guidelines` skill.

#### TASK-071
- **title:** Round-barrier tournament progression (admin-gated)
- **status:** done
- **priority:** med
- **workspaces:** server, client
- **complexity:** medium
- **depends_on:** [TASK-066, TASK-070]
- **description:** Replace the current auto-advance in `tournaments.ts:onTournamentMatchComplete`. Server only marks round as "ready to advance" when all matches in the current round are complete; admin must POST `/admin/tournaments/:id/advance` to start the next round. Client: "Advance Round" button in admin panel, disabled until complete. Spectators and entrants see a waiting state between rounds.
- **pr:** https://github.com/g-chappell/battleships/pull/96
- **completed:** 2026-04-20

---

## Epic: Campaign Rework
> The existing 15 missions use turns/accuracy/ships-lost objectives with fixed ability sets. The user wants a full rework around captains and captain-specific mastery, with a coherent narrative arc, per-objective tiered stars (bronze/silver/gold), and progressive difficulty displayed before entering each mission.

### Story: Narrative + mission data

#### TASK-072
- **title:** Author new 15-mission campaign (narrative + mission data)
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/84
- **completed:** 2026-04-17
- **priority:** med
- **workspaces:** shared
- **complexity:** large
- **description:** Replace the existing 15 missions in `shared/src/campaign.ts`. Each mission defines: required captain, forbidden abilities (optional), turn limit, ship-loss cap, progressive difficulty label (Easy / Rough Seas / Kraken / etc.), per-objective tier thresholds (bronze/silver/gold), narrative beat text, comic panel beats between acts. Overarching narrative arc (three acts, captain-driven). Draft the narrative in the PR description for human sign-off before merging.

#### TASK-073
- **title:** Extend MissionModifiers + tiered star logic
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/85
- **completed:** 2026-04-17
- **priority:** med
- **workspaces:** shared
- **complexity:** medium
- **depends_on:** [TASK-072]
- **description:** Add `requiredCaptain?: CaptainId`, `forbiddenAbilities?: AbilityType[]`, and `starTiers: { bronze: ObjectiveThresholds, silver: ..., gold: ... }` to `MissionModifiers`. Refactor `calculateStars` to aggregate per-objective tier hits into a total star score. Maintain backward-compat types for any consumers. Unit tests for all tier permutations.

### Story: Mission UI + enforcement

#### TASK-074
- **title:** Pre-mission screen rework (narrative + tiers + captain lock)
- **status:** done
- **priority:** med
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-073]
- **description:** Replace or extend `MissionBriefing`. Show: narrative beat text, objectives list with bronze/silver/gold thresholds, progressive difficulty badge, required captain (captain picker disabled with explanation), forbidden abilities (greyed in picker with tooltip "Forbidden in this mission"). Verify via `verify-ui` skill.
- **pr:** https://github.com/g-chappell/battleships/pull/97
- **completed:** 2026-04-20

#### TASK-075
- **title:** Enforce captain lock + forbidden abilities at runtime
- **status:** done
- **priority:** med
- **workspaces:** client, shared
- **complexity:** medium
- **depends_on:** [TASK-073]
- **description:** Update `campaignStore` to carry the active mission's constraints. `CaptainPicker` locks to `requiredCaptain`. `AbilityBar` filters out `forbiddenAbilities`. Engine-level safety check: if a forbidden ability somehow reaches activation, reject with an error. Cover with unit tests.
- **pr:** https://github.com/g-chappell/battleships/pull/98
- **completed:** 2026-04-20

### Story: Campaign map polish

#### TASK-076
- **title:** CampaignMap shows per-objective stars, story beats, difficulty
- **status:** in-progress
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **depends_on:** [TASK-074]
- **description:** Update `CampaignMap.tsx` to surface per-objective star breakdown on mission hover (bronze/silver/gold achieved for each objective), display the act-break comic beats between mission clusters, and show the difficulty badge on each mission node. Verify via `verify-ui` skill.

---

## Epic: Achievements — Full Rebuild
> `achievements.ts` is defined but `checkAchievements` has zero callers — achievements are effectively dead today. The store is localStorage-only and not gated on auth. This epic adds server persistence, event-site wiring, and registered-user-only gating.

### Story: Server persistence

#### TASK-077
- **title:** Add UserAchievement model + server endpoints
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/81
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** server, shared
- **complexity:** medium
- **description:** Add `UserAchievement` Prisma model (userId, achievementId, unlockedAt) with unique (userId, achievementId). Migration required. Endpoints: `GET /achievements` (returns current user's unlocks + full catalog), `POST /achievements/unlock` (idempotent, body `{ achievementId }`; guests get 401). Unit tests for both.

#### TASK-078
- **title:** Migrate achievementsStore to server-backed + registered-only
- **status:** done
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-077]
- **pr:** https://github.com/g-chappell/battleships/pull/86
- **completed:** 2026-04-17
- **description:** Refactor `achievementsStore` to fetch unlocks from the new server endpoint on login. `checkAchievements(context)` becomes a no-op for guests. Remove the localStorage path entirely. Update existing store tests and add tests for guest skip behavior.

### Story: Event wiring

#### TASK-079
- **title:** Wire checkAchievements at real event sites
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/90
- **completed:** 2026-04-17
- **priority:** high
- **workspaces:** client, shared, server
- **complexity:** large
- **depends_on:** [TASK-078]
- **description:** Add `checkAchievements` call-sites for every achievement in `achievements.ts`: match end (win/loss/accuracy/flawless/perfect), ability used (first use per type), campaign star earned (bronze/silver/gold/perfect), tournament placement (winner, finalist), seasonal milestones. Every achievement in the catalog must have at least one call-site. Regression-tested by TASK-048 + TASK-049 (assert at least one achievement unlocks during the scripted matches).

### Story: Profile visibility

#### TASK-080
- **title:** Profile achievements gallery + deep-link from top-right
- **status:** done
- **pr:** https://github.com/g-chappell/battleships/pull/93
- **completed:** 2026-04-18
- **priority:** high
- **workspaces:** client
- **complexity:** medium
- **depends_on:** [TASK-078]
- **description:** Add an Achievements section to `Profile.tsx`, showing all catalog achievements grouped by category (locked greyed out, unlocked with unlock date). Profile icon in the top-right cluster (TASK-054) deep-links to this section. Verify via `verify-ui` skill.

---

## Epic: Stats Integrity Audit
> Confirm that every stat-writing and stat-displaying path correctly distinguishes registered users from guests. Guests must not accrue stats; UI must not show misleading zeros to guests.

### Story: Server-side audit

#### TASK-081
- **title:** Audit every stat-writing path for correct guest skip
- **status:** ready
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Systematic pass over `persistMatch`, `persistAIMatch`, `awardGold`, `getOrCreateSeasonStats`, ELO application, achievement unlock. For each, add a unit test asserting a guest ID produces no DB write. Document findings in the PR description, including any paths that currently leak.

### Story: Client-side audit

#### TASK-082
- **title:** Audit UI surfaces for correct guest messaging
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **depends_on:** [TASK-081]
- **description:** Review Dashboard, Leaderboard, and Profile for the current user's stats view as a guest. Replace any stats display that would show misleading zeros with a "Sign up to track your stats" CTA (using `Button` → AuthPage). Verify via `verify-ui` skill in both guest and registered modes.

---

## Epic: Content Alignment & Guide Expansion
> Content-level alignment inconsistency (Guide page left-aligned, MainMenu centered) and a basic Captain's Guide that needs expansion with real examples and media. Guide expansion lands last because its content depends on campaign, achievements, and tournaments being reshaped.

### Story: Content alignment sweep

#### TASK-083
- **title:** Content alignment sweep — headings centered, paragraphs left
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Apply the convention: long paragraphs left-aligned inside the already-centered `PageShell` container, headings centered. Fix Guide page (all left-aligned today) and any other page where text alignment reads awkwardly (scan MainMenu, Dashboard, Leaderboard, Campaign, Shop, Tournaments, Friends, Clans, Profile). Verify via `verify-ui` skill with before/after screenshots.

### Story: Captain's Guide expansion

#### TASK-084
- **title:** Expand Captain's Guide with mixed media (screenshots, clips, diagrams)
- **status:** ready
- **priority:** low
- **workspaces:** client
- **complexity:** large
- **depends_on:** [TASK-074, TASK-079, TASK-069]
- **description:** Populate `GuidePage.tsx` with: static screenshots (placement screen, GameOverScreen, campaign map) under `client/public/guide/screenshots/`; short WebM clips of each ability activation under `client/public/guide/clips/`; SVG diagrams (turn flow, ability range overlays, trait effect indicators) under `client/public/guide/diagrams/`; one embedded R3F mini-scene showcasing a ship with a rotating camera. Reorganize the guide into clear sections (Basics, Abilities, Traits, Campaign, Tournaments, Achievements). Depends on the campaign/achievements/tournaments epics landing so the content reflects current reality.

