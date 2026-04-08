# Deployment Guide — Ironclad Waters

This guide covers deploying the game to a single Linux VPS using Docker Compose, with a reverse proxy in front for HTTPS.

---

## Prerequisites

- **VPS**: Ubuntu 22.04+ or Debian 12+, minimum 2 GB RAM, 20 GB disk
- **Domain**: A registered domain name pointed at the VPS IP (A record)
- **Ports**: 80 and 443 open in the firewall
- **Docker**: Docker Engine + Compose plugin installed

Install Docker on a fresh VPS:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group membership to apply
```

---

## First-time deployment

### 1. Clone the repo

```bash
sudo mkdir -p /opt/battleships
sudo chown $USER:$USER /opt/battleships
git clone <your-repo-url> /opt/battleships
cd /opt/battleships
```

### 2. Create the production `.env` file

`docker-compose.prod.yml` reads variables from a `.env` file at the repo root (not `server/.env`).

```bash
cp server/.env.production.example .env
```

Edit `.env` and fill in:

| Variable | How to set |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 64` — paste the output (64+ chars required) |
| `POSTGRES_PASSWORD` | Strong random password (e.g. `openssl rand -base64 32`) |
| `CLIENT_URL` | The public HTTPS URL, e.g. `https://battleships.yourdomain.com` |
| `ADMIN_TOKEN` | (optional) random string used to authorize admin endpoints |

**Do not commit `.env`** — it contains secrets.

### 3. Build and start containers

```bash
npm run docker:prod:build
npm run docker:prod:up
```

This brings up four containers: `postgres`, `redis`, `server`, `client`. The client listens on host port 80 by default.

### 4. Apply the database schema

```bash
npm run docker:prod:migrate
```

This runs `prisma migrate deploy` inside the server container.

### 5. (Optional) Seed an initial season

If you set `ADMIN_TOKEN` in `.env`, you can create a season via curl:

```bash
curl -X POST http://localhost/api/seasons/admin/create \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"name":"Season 1","durationDays":30}'
```

### 6. Set up HTTPS with a reverse proxy

The simplest option is **Caddy**, which handles TLS certificates automatically.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Because the client container already binds port 80, change `HOST_HTTP_PORT=8080` in your `.env` and restart:

```bash
echo "HOST_HTTP_PORT=8080" >> .env
npm run docker:prod:down
npm run docker:prod:up
```

Then edit `/etc/caddy/Caddyfile`:

```caddyfile
battleships.yourdomain.com {
  reverse_proxy localhost:8080
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy will automatically obtain a Let's Encrypt certificate on first request. Point your DNS A record at the VPS IP, wait for propagation, and open `https://battleships.yourdomain.com`.

---

## Ongoing updates

When you push new code and want to deploy:

```bash
cd /opt/battleships
git pull
npm run docker:prod:build
npm run docker:prod:up

# Only if prisma/schema.prisma changed:
npm run docker:prod:migrate
```

`docker compose up -d` with `--build` recreates changed containers with zero-downtime for the database volume.

---

## Environment variable reference

All variables live in the repo-root `.env` file, read by `docker-compose.prod.yml`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | Enables JWT_SECRET safety guard |
| `JWT_SECRET` | **yes** | — | Signs auth JWTs. 32+ chars, never the dev default. |
| `POSTGRES_USER` | no | `battleships` | Database user |
| `POSTGRES_PASSWORD` | **yes** | — | Database password |
| `POSTGRES_DB` | no | `battleships` | Database name |
| `CLIENT_URL` | **yes** | — | Public HTTPS URL; used for CORS + Socket.IO origin |
| `HOST_HTTP_PORT` | no | `80` | Host port the client container binds to |
| `ADMIN_TOKEN` | no | — | Guards admin endpoints (season creation, etc.) |

---

## Operations

```bash
# Tail logs for all services
npm run docker:prod:logs

# Tail logs for just the server
docker compose -f docker-compose.prod.yml logs -f server

# Restart one service
docker compose -f docker-compose.prod.yml restart server

# Shell into the server container
docker compose -f docker-compose.prod.yml exec server sh

# Open a Postgres console
docker compose -f docker-compose.prod.yml exec postgres psql -U battleships

# Stop everything (preserves volumes)
npm run docker:prod:down
```

---

## Backup and restore

### Backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U battleships battleships | gzip > backup-$(date +%F).sql.gz
```

Store the resulting file off-host (S3, rclone, etc.). Schedule with cron for daily backups.

### Restore

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U battleships battleships
```

---

## Troubleshooting

### "FATAL: JWT_SECRET must be set..."
Your `.env` file is missing `JWT_SECRET`, or it's set to the dev default, or it's shorter than 32 characters. Generate one with `openssl rand -hex 64` and paste into `.env`.

### 502 Bad Gateway from nginx/Caddy
The server container isn't reachable. Check `docker compose -f docker-compose.prod.yml logs server` for crash loops, and `ps` to confirm the container is running.

### "Database connection refused"
Postgres is still starting up. The server container has `depends_on: postgres.service_healthy`, so it will retry until Postgres is ready — give it 10–20 seconds on first boot.

### WebSocket fails to connect (browser network tab shows no 101 upgrade)
Your reverse proxy isn't forwarding the `Upgrade` + `Connection` headers. Caddy does this automatically; if you're using nginx on the host, add the same headers as the in-container nginx config in `client/nginx.conf`.

### Client shows `localhost:3001` in network tab
The `VITE_*` env vars are baked in at **build time**, not runtime. Rebuild the client image: `npm run docker:prod:build`. The build args in `docker-compose.prod.yml` set these to relative paths (`/api`, `/`) so nginx proxies them.

### "No active season" on leaderboard
No season exists yet. Call the admin seed endpoint (see step 5 of first-time deployment) or create one via the Prisma Studio.

### Client won't build — Prisma error on Alpine
The Dockerfile uses `node:20-slim` (Debian) specifically to avoid Alpine's musl libc issue with Prisma's OpenSSL dependency. If you fork and switch the base image, you'll need to install `openssl` and possibly the matching Prisma engine binary.

---

## Architecture notes

```
Internet (443)
     ↓
   Caddy (host, handles TLS)
     ↓
   client container (nginx on :80)
     ├── static assets → /usr/share/nginx/html
     ├── /api/*        → proxy → server:3001/api/*
     └── /socket.io/*  → proxy (WS upgrade) → server:3001/socket.io/*
                                                 ↓
                                         server container
                                          ├── postgres (5432, internal)
                                          └── redis (6379, internal)
```

Only the client container exposes a host port. `server`, `postgres`, and `redis` communicate on the default Docker Compose network and are not reachable from outside the host.
