# PRD: 3D Battleships — Pirates & Steampunk Edition

**Author:** Graham Chappell
**Date:** 2026-04-02
**Status:** Draft
**Version:** 0.1

---

## Problem Statement

Classic Battleships is a well-understood, beloved strategy game — but existing digital versions are largely 2D, visually flat, and lack the depth that mid-core gamers expect from modern web games. There is no standout browser-based Battleships game that combines 3D visuals, meaningful strategic depth (abilities, ship powers), and robust multiplayer with social features. Players looking for a quick tactical experience in the browser are left choosing between bare-bones implementations or native apps that require installation.

This project aims to fill that gap: a visually rich, strategically deep, browser-based 3D Battleships game wrapped in a Pirates & Steampunk theme, with both single-player progression and competitive multiplayer.

---

## Goals

1. **Deliver a compelling core loop** — Players should find the turn-based combat engaging enough to play multiple rounds in a single session, with abilities and ship powers adding meaningful decisions beyond "pick a tile."
2. **Support both solo and social play** — Single-player campaign and quick-play AI modes for solo sessions; real-time multiplayer with matchmaking and in-game chat for competitive play.
3. **Drive retention through progression** — Leaderboards, player statistics, campaign progression, and unlockable content give players reasons to return.
4. **Showcase technical quality** — The 3D presentation, animations, and UI polish should be portfolio-grade and demonstrate modern web game development.
5. **Build a foundation for expansion** — Architecture should support future additions (new ship types, abilities, game modes) without major rewrites.

---

## Non-Goals

- **Mobile-native apps** — This is a web application. Responsive design for tablets is a stretch goal, but native iOS/Android builds are out of scope. *Why: Keeps scope manageable and focused on browser experience.*
- **Pay-to-win mechanics** — No gameplay advantages from purchases. This is a free-to-play hobby project. Cosmetic monetization may be considered later but is not designed for in v1. *Why: Preserves competitive integrity and simplifies initial scope.*
- **Real-time (non-turn-based) combat** — The game remains turn-based. No real-time ship movement or action-game mechanics. *Why: Core identity is strategic Battleships, not an action game.*
- **User-generated content / modding** — No map editor, custom ship creator, or mod support in v1. *Why: Significant engineering effort with low initial payoff.*
- **Voice chat** — Text chat only for multiplayer. *Why: Voice adds complexity (WebRTC, moderation) disproportionate to value for a turn-based game.*

---

## User Stories

### New Player
- As a **new player**, I want to play a tutorial battle so that I understand the core mechanics, ship placement, and ability system before facing real opponents.
- As a **new player**, I want to create an account quickly (email or OAuth) so that my progress is saved without a lengthy signup process.
- As a **new player**, I want to start a single-player campaign battle so that I can learn the game at my own pace without pressure.

### Solo Player
- As a **solo player**, I want to choose an AI difficulty level (Easy / Medium / Hard) for quick-play so that I can have a satisfying game regardless of my skill level.
- As a **solo player**, I want to progress through a campaign with themed battles and escalating difficulty so that I have a narrative-driven reason to keep playing.
- As a **solo player**, I want to unlock new abilities and see my stats improve over time so that I feel a sense of progression.

### Competitive Player
- As a **competitive player**, I want to queue for a ranked multiplayer match so that I can test my skills against human opponents.
- As a **competitive player**, I want to view leaderboards (global and friends) so that I can see how I rank and set goals.
- As a **competitive player**, I want to review my match history and statistics (win rate, favorite ships, ability usage) so that I can identify areas to improve.

### Multiplayer Social Player
- As a **multiplayer player**, I want to chat with my opponent during a match so that the experience feels social and engaging.
- As a **multiplayer player**, I want to invite a friend to a private match so that we can play together without matchmaking.
- As a **multiplayer player**, I want to see when my opponent is taking their turn so that I know the game is progressing.

### Returning Player
- As a **returning player**, I want my campaign progress, stats, and rank to persist across sessions so that I never lose progress.
- As a **returning player**, I want to see a dashboard with my recent matches, current rank, and campaign progress so that I can quickly pick up where I left off.

---

## Requirements

### Must-Have (P0) — Core Game

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| P0-1 | **Standard Battleships grid & placement** — 10×10 grid, standard ship set (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2), drag-and-drop placement with rotation | - Ships snap to grid cells<br>- Ships cannot overlap or extend beyond grid<br>- Ships can be rotated 90°<br>- All ships must be placed before game starts |
| P0-2 | **Turn-based firing** — Players alternate turns selecting a target cell; hits, misses, and sinks are clearly communicated | - Clicking an enemy cell fires a shot<br>- Hit/miss feedback with distinct 3D animations<br>- Ship sinks when all cells are hit, with sink animation<br>- Game ends when all ships of one player are sunk |
| P0-3 | **3D board rendering** — Both player and opponent boards rendered in 3D with a Pirates/Steampunk aesthetic | - Ocean/sea environment with water shader<br>- Ships modeled in steampunk-pirate style (brass, rivets, sails + gears)<br>- Camera can orbit, zoom, and switch between boards<br>- Hit markers (fire/explosion) and miss markers (water splash) in 3D |
| P0-4 | **Ship-specific passive traits** — Each ship type has a unique passive ability tied to the theme | - Carrier: "Spotter" — when hit, reveals one adjacent enemy cell<br>- Battleship: "Ironclad" — first hit on this ship is negated (steampunk armor)<br>- Cruiser: "Swift" — can be repositioned once per game (moved 1 cell in any direction)<br>- Submarine: "Submerge" — invisible to sonar-type abilities<br>- Destroyer: "Nimble" — occupies 2 cells but opponent's first shot on adjacent cells auto-misses |
| P0-5 | **Active abilities (per turn)** — Players choose from a set of unlockable active abilities, one use per turn instead of a normal shot | - **Cannon Barrage**: Fires on a 2×2 area (3 turn cooldown)<br>- **Sonar Ping**: Reveals whether a 3×3 area contains a ship (does not reveal position exactly) (4 turn cooldown)<br>- **Smoke Screen**: Hides a 3×3 area of your board from the opponent for 2 turns (5 turn cooldown)<br>- **Repair Kit**: Restores one hit cell on one of your ships (once per game)<br>- Players select 2 active abilities before the match begins |
| P0-6 | **Single-player vs AI (Quick Play)** — Play against AI with selectable difficulty (Easy, Medium, Hard) | - Easy: Random targeting with basic "hunt" after a hit<br>- Medium: Probability-based targeting, uses abilities sub-optimally<br>- Hard: Optimal probability targeting, strategic ability usage, adapts to player patterns<br>- AI turns execute with a short delay for dramatic effect |
| P0-7 | **User authentication** — Account creation and login via email/password and OAuth (Google, Discord) | - Email/password registration with email verification<br>- OAuth login with Google and Discord<br>- Password reset flow<br>- Session persistence (stay logged in)<br>- Guest play available for quick-play AI only (no stats saved) |
| P0-8 | **Player dashboard** — Post-login landing page showing player state | - Current rank/rating<br>- Win/loss record<br>- Recent match history (last 10)<br>- Campaign progress<br>- Quick-play and multiplayer launch buttons |
| P0-9 | **Basic game statistics** — Track and display per-player stats | - Total games played (AI + multiplayer separately)<br>- Win/loss ratio<br>- Shot accuracy percentage<br>- Average game duration<br>- Ships sunk / ships lost totals |

### Must-Have (P0) — Multiplayer

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| P0-10 | **Real-time multiplayer** — Two players connected via WebSocket for live turn-based play | - Matchmaking queue (random opponent)<br>- Both players place ships, then game begins when both are ready<br>- Turn state synchronized in real-time<br>- Opponent disconnect handled gracefully (timeout → forfeit after 60s) |
| P0-11 | **In-game text chat** — Chat panel during multiplayer matches | - Messages appear in real-time<br>- Chat history persists for the duration of the match<br>- Basic profanity filter<br>- Option to mute opponent<br>- Chat limited to match context (no global chat in v1) |
| P0-12 | **Private match invites** — Invite a specific player to a match | - Generate a shareable invite link or code<br>- Invited player joins directly without matchmaking<br>- Host can set match parameters (ability restrictions, etc.) |

### Must-Have (P0) — Infrastructure

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| P0-13 | **Leaderboard** — Global ranking of players | - Ranked by ELO or similar rating system<br>- Top 100 displayed<br>- Player can see their own rank regardless of position<br>- Filterable by time period (all-time, monthly, weekly) |
| P0-14 | **Responsive UI** — Playable on desktop browsers; functional on tablet | - Full experience at 1280×720 and above<br>- Functional (playable but not optimized) at tablet landscape (1024×768)<br>- Not required to work on phone-sized screens |

### Nice-to-Have (P1)

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| P1-1 | **Campaign mode** — Story-driven single-player progression with themed battles | - 15-20 campaign missions with escalating difficulty<br>- Brief narrative text between missions (pirate crew story arc)<br>- Unique AI behaviors per mission (e.g., "fog of war" mission, "kraken attack" environmental hazard)<br>- Abilities and ship traits unlock progressively through campaign<br>- Star rating (1-3) per mission based on performance |
| P1-2 | **Achievement system** — Unlock achievements for milestones | - 20+ achievements (e.g., "Sink all ships without missing," "Win 10 ranked matches," "Complete campaign on Hard")<br>- Achievements visible on player profile<br>- Toast notification on unlock |
| P1-3 | **Spectator mode** — Watch live multiplayer matches | - Join as spectator via match link<br>- See both boards with fog-of-war (spectator delay to prevent cheating)<br>- Spectator chat separate from player chat |
| P1-4 | **Sound design & music** — Themed audio | - Ambient ocean/steampunk soundtrack<br>- SFX for shots, hits, misses, sinks, abilities<br>- Volume controls and mute option |
| P1-5 | **Rematch & post-game** — End-of-match experience | - Full board reveal showing both sides<br>- Match summary (accuracy, abilities used, turns taken)<br>- "Rematch" button to immediately play again vs same opponent<br>- "Share result" generates a match summary image |
| P1-6 | **Friends list** — Add and manage friends | - Send/accept friend requests by username<br>- See friends' online status<br>- Quick-invite friends to private matches<br>- Friends leaderboard |
| P1-7 | **Additional active abilities** — Expand the ability pool | - **Chain Shot**: Hits a 1×3 line (horizontal or vertical, player chooses) (3 turn cooldown)<br>- **Spyglass**: Reveals one specific cell and all cells in the same row (5 turn cooldown)<br>- **Boarding Party**: If you hit a ship, learn the ship type and remaining health (passive, triggers on hit, once per game)<br>- Players unlock new abilities through campaign or match milestones |

### Future Considerations (P2)

| # | Requirement | Notes |
|---|-------------|-------|
| P2-1 | **Cosmetic customization** — Ship skins, board themes, explosion effects | Design ship model system to support texture/material swaps. Store player inventory in DB from the start. |
| P2-2 | **Tournament mode** — Bracket-based competitive events | Ensure matchmaking and rating systems can support seeded brackets. |
| P2-3 | **Clan / guild system** — Player groups with shared stats | DB schema should allow grouping players. Leaderboard should be extensible to group-based rankings. |
| P2-4 | **Replay system** — Record and replay past matches | Store match events (not board state snapshots) as an event log from day one — this makes replays a UI feature, not a data migration. |
| P2-5 | **Mobile-optimized experience** — Touch controls, portrait layout | Keep UI components modular so mobile-specific layouts can be built without rewriting game logic. |
| P2-6 | **Seasonal content** — Time-limited events, seasonal leaderboards | Leaderboard time-period filtering (P0-13) lays the groundwork. |

---

## Recommended Tech Stack

Given the requirements (3D browser rendering, real-time multiplayer, auth, persistence) and the open-ended hobby timeline:

### Frontend
- **React 18+** with TypeScript — Component architecture, ecosystem, strong typing
- **Three.js + React Three Fiber (R3F)** — 3D rendering with React integration; large community, good docs, avoids Unity WebGL's heavy bundle size and slow load times
- **Zustand** — Lightweight state management for game state
- **Tailwind CSS** — Rapid UI styling for menus, dashboard, leaderboards

### Backend
- **Node.js + Express** (or Fastify) with TypeScript — Same language as frontend, good WebSocket support
- **Socket.IO** — Real-time multiplayer communication and chat
- **PostgreSQL** — Relational data: users, match history, stats, leaderboards, campaign progress
- **Prisma** — Type-safe ORM for PostgreSQL
- **Redis** — Session management, matchmaking queue, real-time game state cache

### Auth
- **Passport.js** or **Auth.js (NextAuth)** — OAuth (Google, Discord) + email/password with JWT sessions

### Infrastructure
- **Vite** — Frontend build tool
- **Docker** — Containerized backend for consistent dev/deploy
- **GitHub Actions** — CI/CD

### Why Not Unity WebGL?
- Large initial download (10-30MB runtime) hurts first-load experience
- Limited web integration (auth, chat, leaderboards all need bridging)
- Three.js + R3F gives full control over web integration while delivering strong 3D visuals
- Better for a hobby project: faster iteration, smaller bundles, no Unity license concerns

---

## Success Metrics

### Leading Indicators (1-4 weeks post-launch)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Quick-play completion rate | 80% of started games are finished | 90% | Server-side game state tracking |
| Multiplayer match queue time | < 30 seconds (with 50+ concurrent users) | < 15 seconds | Socket.IO server logs |
| Tutorial completion rate | 70% of new users complete the tutorial | 85% | Event tracking |
| Session duration | Average 20+ minutes per session | 30+ minutes | Analytics |
| Campaign start rate | 50% of registered users start campaign | 65% | DB query |

### Lagging Indicators (1-3 months post-launch)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| 7-day retention | 30% of registered users return within 7 days | 45% | Cohort analysis |
| 30-day retention | 15% of registered users active at day 30 | 25% | Cohort analysis |
| Campaign completion rate | 20% of starters finish all missions | 35% | DB query |
| Ranked adoption | 40% of multiplayer players play 5+ ranked games | 55% | DB query |
| Community growth | 200 registered accounts in first 3 months | 500 | DB count |

---

## Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should ability balance be symmetric (both players have the same ability pool) or asymmetric (draft/ban phase)? | Design / Graham | Yes — affects P0-5 implementation |
| 2 | What ELO/rating system variant to use? (Standard ELO, Glicko-2, TrueSkill) | Engineering | No — can start with basic ELO and migrate |
| 3 | How should campaign mission narrative be delivered? (Text overlays, comic-panel cutscenes, dialogue boxes) | Design | No — affects P1-1 only |
| 4 | Should guest players be able to play multiplayer quick-play (unranked)? | Product / Graham | No — easy to add later |
| 5 | What is the profanity filter approach? (Blocklist, ML-based, third-party API) | Engineering | No — can start with simple blocklist |
| 6 | How to handle ship trait balance? (e.g., Ironclad negating a hit is powerful — should it have a counter?) | Design / Graham | Yes — affects P0-4 implementation |
| 7 | 3D asset pipeline — create original models, use/modify open-source assets, or commission? | Art / Graham | No — placeholder models work for development |

---

## Timeline Considerations

This is an open-ended hobby project. Suggested phasing:

### Phase 1: Core Engine (Foundation)
- 3D board rendering and camera controls
- Ship placement (drag, drop, rotate)
- Turn-based firing with hit/miss/sink logic
- Single-player vs basic AI (Easy difficulty)
- No auth, no persistence — local play only

### Phase 2: Accounts & Single-Player
- User authentication (email + OAuth)
- Player dashboard and statistics
- AI difficulty tiers (Medium, Hard)
- Ship passive traits (P0-4)
- Active abilities (P0-5)
- Database setup, stat tracking

### Phase 3: Multiplayer & Social
- WebSocket multiplayer (matchmaking + private matches)
- In-game chat
- Leaderboard and ELO rating
- Post-game summary

### Phase 4: Campaign & Polish
- Campaign mode (P1-1)
- Achievement system (P1-2)
- Sound design (P1-4)
- Spectator mode (P1-3)
- UI polish, animations, visual effects refinement

### Dependencies
- 3D asset creation can proceed in parallel with engine development (use placeholder primitives initially)
- Multiplayer requires auth to be complete (players need identity)
- Campaign requires ability system to be complete (abilities unlock through campaign)
- Leaderboard requires multiplayer and rating system

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)                │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  React UI │  │ R3F / Three.js│  │  Zustand   │ │
│  │ (Menus,   │  │ (3D Boards,  │  │ (Game State│ │
│  │  Dashboard│  │  Ships, FX)  │  │  Store)    │ │
│  │  Chat)    │  │              │  │            │ │
│  └──────────┘  └──────────────┘  └────────────┘ │
│         │              │               │          │
│         └──────────────┼───────────────┘          │
│                        │                          │
│              REST API (Auth, Stats, Leaderboard)  │
│              WebSocket (Game State, Chat)          │
└────────────────────────┼──────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────┐
│                   Server (Node.js)                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ REST API  │  │  Socket.IO   │  │  Game      │  │
│  │ (Express) │  │  (Realtime)  │  │  Engine    │  │
│  │           │  │              │  │  (Logic)   │  │
│  └─────┬────┘  └──────┬───────┘  └─────┬──────┘  │
│        │               │                │          │
│  ┌─────┴───────────────┴────────────────┴──────┐  │
│  │              Data Layer (Prisma)              │  │
│  └──────────┬───────────────────┬──────────────┘  │
│             │                   │                  │
│     ┌───────┴──────┐    ┌──────┴───────┐          │
│     │  PostgreSQL   │    │    Redis      │          │
│     │  (Persistent) │    │  (Sessions,   │          │
│     │               │    │   Queues,     │          │
│     │               │    │   Live State) │          │
│     └──────────────┘    └──────────────┘          │
└───────────────────────────────────────────────────┘
```

---

*This is a living document. Update as decisions are made on open questions and as implementation reveals new considerations.*
