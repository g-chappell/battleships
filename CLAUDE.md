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

## Architecture notes
- `gh` CLI is at `"/c/Program Files/GitHub CLI/gh.exe"` (not on bash PATH)
- Client tsconfig has `erasableSyntaxOnly` removed — enums are used pervasively
- Ocean.tsx eslint-disable at line 125 is intentional (shader uniform pattern)
- Audio is fully procedural via Web Audio API (no audio files)
- Spectator mode uses fog-of-war (same as opponent view) on both boards
