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
- **status:** ready
- **priority:** med
- **workspaces:** client, server
- **complexity:** small
- **description:** The register flow currently accepts any string as an email. Add a simple regex check (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) server-side in `auth.ts` (return 400 on invalid format) and a matching inline validation message client-side on the register form before submission.

#### TASK-034
- **title:** Add rate limiting to clan chat messages
- **status:** ready
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Game chat already enforces a 5-message/10-second rate limit in `gameSocket.ts`. Apply the same pattern to the clan chat endpoint in `server/src/services/clans.ts` or the socket handler — track per-user message timestamps and reject if the limit is exceeded.

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
- **status:** ready
- **priority:** low
- **workspaces:** client
- **complexity:** small
- **description:** The Web Audio API `AudioContext` and any live oscillators/buffers are never closed when the user leaves the page. Add a `beforeunload` event listener in `client/src/services/audio.ts` that calls `audioContext.close()` to release resources and prevent oscillator leaks in browser profiles.

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
- **status:** in-progress
- **priority:** med
- **workspaces:** server
- **complexity:** small
- **description:** Add tests for `server/src/services/seasons.ts` — `getActiveSeason` returns current season or null, `getOrCreateSeasonStats` creates entry on first call and returns existing on subsequent calls, season transition logic. Mock Prisma with `vi.hoisted()` pattern.

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
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/store/achievementsStore.ts` — `checkAchievements` unlocks the correct achievement when conditions are met, does not double-unlock, stores unlocked IDs. Mock audio service. Follow existing client test patterns.

#### TASK-028
- **title:** Add clanStore unit tests
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for `client/src/store/clanStore.ts` — create clan (success sets current clan, error sets error state), join clan, leave clan, fetch chat messages, send chat message. Mock `apiFetch`/`apiFetchSafe` and audio service.

#### TASK-029
- **title:** Add friendsStore unit tests
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/store/friendsStore.ts` — send friend request, accept/reject incoming request, remove friend, localStorage fallback when API unavailable. Mock `apiFetch`/`apiFetchSafe` and audio service.

#### TASK-030
- **title:** Add seasonsStore unit tests
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/store/seasonsStore.ts` — fetch active season (populates state), fetch player season stats, null handling when no active season. Mock `apiFetchSafe` and audio service.

#### TASK-031
- **title:** Add socketStore unit tests
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** medium
- **description:** Add tests for `client/src/store/socketStore.ts` — connect attaches auth token, disconnect clears socket state, socket events are routed to the correct store actions, reconnect re-attaches. Use a mock socket with `_trigger` helper (same pattern as spectatorStore tests).

#### TASK-032
- **title:** Add apiClient service unit tests
- **status:** ready
- **priority:** med
- **workspaces:** client
- **complexity:** small
- **description:** Add tests for `client/src/services/apiClient.ts` — `ApiError` construction (status, message, data fields), `apiFetch` attaches auth header when token present, throws `ApiError` on non-2xx responses, `apiFetchSafe` returns null on any error without throwing.

