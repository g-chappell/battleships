# CLAUDE.md — Ironclad Waters

## Project overview
3D pirate-themed battleships game. Monorepo: `shared/` (game engine), `client/` (React 19 + Vite + R3F), `server/` (Express + Socket.IO + Prisma/Postgres), `e2e/` (Playwright end-to-end tests).

## Key commands

### Local development
```bash
npm run dev              # client + server together
npm run dev:client       # client only (Vite on :5173)
npm run dev:server       # server only (tsx watch on :3001)
```

### Tests
```bash
npm run test --workspace=shared    # 74 tests — game engine
npm run test --workspace=server    # 37 tests — ELO, matchmaking, rooms
npm run test --workspace=client    # 15 tests — gameStore, authStore
```

### Type checking
```bash
cd client && npx tsc -b   # strict mode — must pass before build
```

### Build
```bash
npm run build              # client production build (runs tsc -b first)
```

## Monorepo structure

```
shared/src/         — Game engine (consumed as raw TS, no compile step)
  types.ts            Enums (CellState, ShipType, GamePhase, AbilityType), interfaces, coordKey/parseCoordKey
  GameEngine.ts       State machine: Placement → Playing → Finished. Turn logic, win detection.
  Board.ts            10×10 grid. Ship placement, shot resolution, land cells.
  AI.ts               EasyAI, MediumAI, HardAI + randomPlacement helper
  abilities.ts        7 abilities: CannonBarrage, SonarPing, SmokeScreen, RepairKit, ChainShot, Spyglass, BoardingParty
  traits.ts           4 traits: Ironclad (Battleship), Spotter (Carrier), Nimble (Destroyer), Swift (Cruiser)
  campaign.ts         15 missions, calculateStars, comic panel definitions
  captains.ts         3 captains (Ironbeard, Mistral, Blackheart) with ability loadouts
  cosmetics.ts        Ship skins, board themes, explosion FX — gold economy catalog
  achievements.ts     20+ achievements across 6 categories
  seasons.ts          Seasonal ladder with duration/rating
  tournaments.ts      Single-elimination bracket helpers (4/8/16 players)
  clans.ts            Clan types (roles, chat, stats)
  replay.ts           Compact event log schema for match replays
  sockets.ts          Socket.IO event protocol types (shared between client/server)
  index.ts            Barrel file — all public exports

client/src/
  store/              13 Zustand stores: gameStore, authStore, socketStore, settingsStore,
                      cosmeticsStore, campaignStore, tournamentsStore, clanStore,
                      friendsStore, seasonsStore, replayStore, spectatorStore, achievementsStore
  pages/              GamePage, MainMenu, CampaignMap, MultiplayerLobby, Dashboard,
                      Leaderboard, Clans, Shop, Profile, Guide, etc.
  components/three/   R3F: GameScene, BoardGrid, Ocean (GLSL shader), ShipModel, CoastalTerrain, Creatures
  components/ui/      GameHUD, AbilityBar, ShipTray, ChatPanel, GameOverScreen, CaptainPicker, etc.
  components/shadcn/  shadcn/ui components (installed via `npx shadcn add <component>`)
  lib/utils.ts        cn() helper for shadcn class merging
  services/audio.ts   Procedural Web Audio API (no audio files)
  styles/tokens.ts    Design tokens (colors, sizes)

server/src/
  sockets/gameSocket.ts  Main Socket.IO handler — auth, matchmaking, game actions, chat, spectator
  services/rooms.ts      In-memory GameRoom map — authoritative game state, room lifecycle
  services/matchmaking.ts  ELO-based queue with rating window expansion
  services/elo.ts        Rating calculation
  services/persistence.ts  Match history & replay storage
  services/gold.ts       Currency rewards
  services/seasons.ts    Season management
  services/clans.ts      Clan CRUD
  services/tournaments.ts  Tournament bracket management
  services/db.ts         Prisma client instance
  routes/                REST: auth, stats, cosmetics, seasons, matches, tournaments, clans, leaderboard
  middleware/auth.ts     JWT (7-day) + guest fallback
  prisma/schema.prisma   Models: User, PlayerStats, Match, UserCosmetic, Tournament,
                         TournamentMatch, Clan, ClanChatMessage, Season, SeasonPlayerStats
  generated/prisma/      Auto-generated Prisma client — never edit directly

e2e/                — Playwright end-to-end tests (@playwright/test ^1.52, wait-on installed)
  playwright.config.ts  (to be created by TASK-047)
  tests/              Playwright test specs
  fixtures/           registeredUser, guestUser, socketReady helpers
```

## E2E workspace notes
- `@playwright/test` (v1.59) and `wait-on` are already installed in `e2e/` and in root `node_modules`
- Browser binaries must be installed once: `cd e2e && npx playwright install --with-deps`
- Run e2e tests: `npm run test --workspace=e2e` (or `cd e2e && npx playwright test`)
- E2E tests require the full stack running (client + server + DB)
- TASK-047 scaffolds the config; TASK-048/049/050 add the actual test specs

## Import patterns
- **Client → shared:** `import { GameEngine, GamePhase } from '@shared/index'` (Vite alias defined in `vite.config.ts` + `tsconfig.app.json`)
- **Server → shared:** `import { GameEngine } from '../../../shared/src/GameEngine.ts'` (relative path with `.ts` extension — server runs via tsx, no compile step)
- **Within shared:** `import { Board } from './Board'` (relative, no extension)
- **Prisma client:** `import { PrismaClient } from '../generated/prisma/client.js'`
- **Client tests** use the `@shared` alias. **Server tests** use relative paths with `.ts`.

## Design system
- Brand guidelines skill: `.claude/skills/brand-guidelines/SKILL.md` — pirate color palette, typography, component patterns, anti-patterns
- All UI work must follow the brand guidelines
- shadcn components are themed via CSS variables mapped to pirate palette in `client/src/index.css`
- shadcn components install to `client/src/components/shadcn/` (separate from hand-built UI in `client/src/components/ui/`)
- Use `cn()` from `@/lib/utils` for conditional class merging in shadcn components

## Tailwind CSS v4
- Config: `@import "tailwindcss"` + `@theme {}` block in `client/src/index.css` — there is no `tailwind.config.js`
- Project colors (auto-generate utilities like `bg-blood`, `text-bone`, `border-gold`):
  `blood`, `blood-dark`, `blood-bright`, `crimson`, `mahogany`, `mahogany-light`, `mahogany-mid`, `pitch`, `coal`, `copper`, `aged-gold`, `gold`, `bone`, `parchment`, `rust`
- Fonts: `font-pirate` (Pirata One), `font-label` (IM Fell English SC), `font-body` (IM Fell English)
- V4 breaking changes: use `bg-blood/50` slash syntax (not `bg-opacity-*`), `ring-*` defaults differ from v3
- When unsure if a Tailwind class exists in v4, prefer inline styles or custom CSS

## Game engine internals
- **State machine:** `GamePhase.Placement` → `GamePhase.Playing` → `GamePhase.Finished`
- **Board:** 10×10 grid (`GRID_SIZE = 10`), cells are `CellState` enum (Empty, Ship, Hit, Miss, Land, LandRevealed)
- **Coordinate serialization:** `coordKey({row, col})` → `"row,col"` string; `parseCoordKey(key)` → `{row, col}`
- **Ships:** Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2) — hits tracked as `Set<string>` of coordKeys
- **Abilities:** Each has cooldown (turns) and maxUses. `AbilitySystemState` tracks per-player state. Players select 2 abilities pre-match.
- **Traits:** Passive effects tied to ship types. `TraitState` tracks one-shot effects (e.g., Ironclad armor consumed).
- **Turn logic:** Hits grant consecutive turns (no switch). Misses switch turn and increment `turnCount`.
- **Multiplayer:** Server `rooms.ts` holds authoritative `GameEngine` per room. Client receives `PublicGameState` with fog-of-war applied. Socket events defined in `shared/src/sockets.ts`.
- **Spectator:** Sees `PublicBoardView` (same as opponent view) for both sides.

## VPS deployment

**The VPS does NOT have npm/node installed at the host level.** Everything runs via Docker. Never use `npm run docker:prod:*` on the VPS.

### Deploy latest changes:
```bash
cd /opt/battleships
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Only if schema.prisma changed:
```bash
docker compose -f docker-compose.prod.yml exec server npx prisma db push
```

### Useful operations:
```bash
docker compose -f docker-compose.prod.yml logs -f          # all logs
docker compose -f docker-compose.prod.yml logs -f server   # server only
docker compose -f docker-compose.prod.yml restart server    # restart one service
docker compose -f docker-compose.prod.yml down              # stop all (keeps data)
```

## Rules
- Only implement exactly what is requested. Do not add extra systems, abstractions, or features beyond the scope of the ask.
- When making UI changes, NEVER remove existing UI elements (icons, counts, indicators) unless explicitly asked. After any UI edit, verify all previously visible elements are still present.
- This project uses Tailwind CSS v4. Some v3 utility classes don't work — always verify generated classes exist in v4. Prefer inline styles or custom CSS if a Tailwind class doesn't apply correctly.
- After implementing changes, run the test suite and manually verify core game mechanics (ship sinking, ability processing, fog-of-war, turn logic) have not regressed. Do NOT skip this even for "simple" UI changes.
- When touching `shared/`, also run server and client tests — both workspaces consume shared and can break independently.
- Read the full React component before editing. Verify all JSX elements, event handlers, and conditional renders survive your edit. Common mistake: replacing a section and losing sibling elements.
- For multi-file changes, edit one file at a time with intermediate type-checks between each. Never batch-edit 3+ files without verifying compilation.
- Server ships raw TS via `tsx` at runtime — never add server-only or client-only dependencies to `shared/`.
- Prefer editing existing files over creating new ones. This codebase uses a flat structure by design.
- Brand color anti-patterns to fix on sight: `#2ecc71` (lime green) → `text-gold`; `#8ab0d4` (light blue) → `text-copper`; `#f5a845`/`#c0c0c0`/`#cd7f32` (medal colors) → `text-gold`/`text-parchment`/`text-copper`; raw `<button>` for interactive UI → always `Button` component with appropriate `variant`.

## Testing patterns
- All tests use Vitest. Locations: `shared/src/__tests__/`, `server/src/__tests__/`, `client/src/__tests__/`
- **Shared tests:** Import directly from source files. Use `placeAllShips()` helper for standard game state setup.
- **Client tests:** Mock `../services/audio` first. Use `useGameStore.getState()` for Zustand store testing. Reset store in `beforeEach`. When a store action internally calls a refresh (e.g., `loadFromServer`, `fetchMyClan`), tests need 1 (action) + N (refresh calls) total `mockResolvedValueOnce` calls chained in sequence — read the refresh function to count N (`loadFromServer` uses `Promise.all` with 2 `apiFetchSafe` calls, so N=2).
- **Server tests:** Use `createRoom()`/`joinRoom()`/`placeShips()` helpers and `makePlayer()` factory.
- **Server route tests:** Create an Express app in `beforeAll`, mount the router, bind to port 0 (dynamic) with `server.listen(0, '127.0.0.1', resolve)`, use Node 20 built-in `fetch` for requests. Cast `server.address() as AddressInfo` from `net` to get the port. Mock Prisma via `vi.hoisted()` + `vi.mock('../services/db.ts')`. For modules with a module-level `setInterval` (e.g., `seasons.ts` has a 60s rollover watchdog), mock the entire module to prevent background timers firing during tests. For Prisma `$transaction` mocks: add `$transaction: vi.fn().mockImplementation((fn) => fn({ user: txUser, ... }))` in `vi.hoisted` — route logic uses `tx.user.update` etc.; throwing from the callback propagates as a rejected promise for the route's outer catch.
- **Coverage gaps:** campaign, tournaments, replay, socket lifecycle, most client stores — new features in these areas MUST include tests.
- **Long-running tests (fuzz/stress):** Pass an explicit timeout as the 3rd argument to `it()` — e.g. `it('...', async () => { ... }, 300_000)`. Use `throw` (not `expect()`) for per-step invariant checks inside large loops — millions of `expect()` calls in Vitest have significant overhead.
- **Service tests that call `fetch` directly:** Mock via `vi.stubGlobal('fetch', vi.fn())` in `beforeEach` (not `vi.mock`). Assert URL paths with `toMatch(/\/api\/path$/)` not full URLs — `import.meta.env.VITE_API_URL` is undefined in Vitest. No audio mock needed for non-store services.
- **Asserting intermediate loading state:** Create a deferred promise (`let resolve!: () => void; const p = new Promise<T>(r => { resolve = r as () => void; })`), mock the API call with it, start the store action without awaiting, assert `loading: true`, then call `resolve()` and `await` the action.
- Always use `tsc -b` (not `tsc --noEmit`) for the final type check — `tsc -b` validates project references and composite builds; `--noEmit` misses these and can pass locally while CI fails.
- Run all workspaces: `npm run test --workspace=shared && npm run test --workspace=server && npm run test --workspace=client`

## E2E testing patterns
- **Run the `/e2e-test` skill before writing or debugging an `e2e/tests/*.test.ts` spec.** It covers the bridge pattern, multiplayer gotchas, rematch flow, and CI-survival tips that cost real time to rediscover.
- Import from `../fixtures` (not `@playwright/test`) to get the `test` object extended with `registeredUser`, `guestUser`, and `socketReady` fixtures.
- `socketReady(page, eventName)` must be called BEFORE the UI action that triggers the socket event — the WebSocket listener registers at call-time; frames arriving before registration are missed.
- Add `data-testid="..."` attributes to components when a test needs to target them — prefer these over CSS selectors or text matches.
- `IroncladBridge` type and the `declare global { interface Window { __ironclad?: IroncladBridge } }` augmentation are declared ONCE in `e2e/fixtures/index.ts`. Never duplicate in per-file `declare global` blocks — structurally different types trigger TS2717.
- Use `test.setTimeout(N)` inside the test body. `{ timeout: N }` as a `TestDetails` option is a TS2353 error in Playwright v1.52/1.59.
- **Multiplayer E2E:** poll `getMultiplayerState().gameState.phase` (socketStore, synchronous) not `getPhase()` (gameStore, React-dependent). Use `resignViaSocket()` for deterministic wins — server-side Ironclad/Nimble traits make shot-based MP assertions non-deterministic. Wrap every paired `waitForFunction` across two pages in `Promise.all([...])` or sequential waits will compound past the test timeout.
- Playwright tsconfig requires `"lib": ["ES2022", "DOM"]` — Playwright's type definitions reference `HTMLElement`, `SVGElement`, etc. even though tests run in Node.js.
- When adding a new Playwright CI job, always include at least one smoke test in `testDir` — an empty test directory causes `playwright test` to exit code 1 and fail CI.
- Both `ci` and `e2e` are required status checks on `main`. Auto-merge will not fire until both pass. If an e2e failure appears stuck or the job is skipped, check that the `e2e` context is listed in the branch protection required checks (`gh api repos/g-chappell/battleships/branches/main/protection`).

## MCP Servers
- **shadcn** (`.mcp.json`) — component discovery & installation via `npx shadcn@latest mcp`. Lets Claude Code search, browse, and install shadcn/ui components conversationally.

## shadcn component notes
- Components safe to `npx shadcn add` (all use Radix UI, already installed as `radix-ui`): Button, Dialog, Switch, Slider, Input, Label, Textarea, Tooltip, Select, Checkbox, RadioGroup, Tabs, Accordion, Popover, and any other component that sources from `@radix-ui/*`.
- Some shadcn components wrap a **separate npm package** (not Radix): `sonner` (toast), `vaul` (drawer), `cmdk` (command palette), `embla-carousel-react` (carousel), `recharts` (charts). Installing these requires `npm install`, which violates the no-dependency rule. **Do not build a custom substitute — stop and ask the human for permission to install the package instead.**
- When refactoring a component that reads from a Zustand store that already has tests, use the **bridge pattern**: keep the store API unchanged, have the refactored component watch the store and delegate rendering to the new UI primitive. This preserves existing tests without modification.
- `preview_screenshot` consistently times out because the 3D R3F canvas holds the renderer busy. Use `preview_eval` (DOM queries, `data-slot` counts, mounted-state checks) and `preview_snapshot` (accessibility tree for text/roles) for visual verification instead. Skip `preview_screenshot` unless the specific visual output is essential.
- `IconButton` (in `client/src/components/ui/`) auto-renders a shadcn `Tooltip` when a `label` prop is passed — no additional tooltip wiring needed.

## Architecture notes
- `gh` CLI is at `"/c/Program Files/GitHub CLI/gh.exe"` (not on bash PATH)
- Client tsconfig has `erasableSyntaxOnly` removed — enums are used pervasively
- Ocean.tsx eslint-disable at line 125 is intentional (shader uniform pattern)
- Audio is fully procedural via Web Audio API (no audio files)
- Spectator mode uses fog-of-war (same as opponent view) on both boards
