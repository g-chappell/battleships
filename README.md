# Ironclad Waters

A stylized 3D pirate battleships game with a 15-mission single-player campaign, ability-driven combat, ranked multiplayer, clans, tournaments, seasonal leaderboards, and replays.

## Stack

- **Client** — React 19 + Vite 7 + TypeScript, React Three Fiber (R3F) for 3D, Zustand state, TailwindCSS v4
- **Server** — Node 20 + Express + Socket.IO, Prisma + Postgres, Redis for matchmaking
- **Shared** — pure TypeScript game engine, AI, traits, abilities, replay format (74 unit tests)
- **Monorepo** — npm workspaces (`shared`, `client`, `server`)

## Dev quickstart

```bash
git clone <repo>
cd battleships
npm install

# Start Postgres + Redis locally via Docker
npm run docker:up

# Create dev env files
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Apply the schema
npm run db:migrate --workspace=server

# Run client + server together
npm run dev
```

The client is served on <http://localhost:5173> and the server on <http://localhost:3001>.

## Folder tour

```
shared/     Game engine, AI, traits, abilities, replay types. 74 unit tests.
server/     Express + Socket.IO backend. Prisma schema + migrations.
client/     React + R3F frontend. Zustand stores, UI primitives, pages.
docs/       Product spec and design notes.
```

## Production deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for first-time VPS setup, ongoing update workflow, environment reference, backup/restore, and troubleshooting.

Quick reference:

```bash
# First deploy
cp server/.env.production.example .env
# ...fill in JWT_SECRET, POSTGRES_PASSWORD, CLIENT_URL
npm run docker:prod:build
npm run docker:prod:up
npm run docker:prod:migrate

# Ongoing updates
git pull
npm run docker:prod:build
npm run docker:prod:up
```
