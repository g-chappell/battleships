# CLAUDE.md — Ironclad Waters

## Project overview
3D pirate-themed battleships game. Monorepo: `shared/` (game engine), `client/` (React 19 + Vite + R3F), `server/` (Express + Socket.IO + Prisma/Postgres).

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
```

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

## Testing patterns
- All tests use Vitest. Locations: `shared/src/__tests__/`, `server/src/__tests__/`, `client/src/__tests__/`
- **Shared tests:** Import directly from source files. Use `placeAllShips()` helper for standard game state setup.
- **Client tests:** Mock `../services/audio` first. Use `useGameStore.getState()` for Zustand store testing. Reset store in `beforeEach`.
- **Server tests:** Use `createRoom()`/`joinRoom()`/`placeShips()` helpers and `makePlayer()` factory.
- **Coverage gaps:** campaign, tournaments, replay, socket lifecycle, most client stores — new features in these areas MUST include tests.
- Run all workspaces: `npm run test --workspace=shared && npm run test --workspace=server && npm run test --workspace=client`

## MCP Servers
- **shadcn** (`.mcp.json`) — component discovery & installation via `npx shadcn@latest mcp`. Lets Claude Code search, browse, and install shadcn/ui components conversationally.

## Architecture notes
- `gh` CLI is at `"/c/Program Files/GitHub CLI/gh.exe"` (not on bash PATH)
- Client tsconfig has `erasableSyntaxOnly` removed — enums are used pervasively
- Ocean.tsx eslint-disable at line 125 is intentional (shader uniform pattern)
- Audio is fully procedural via Web Audio API (no audio files)
- Spectator mode uses fog-of-war (same as opponent view) on both boards
