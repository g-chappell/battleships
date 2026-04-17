# ---------- Build stage: install deps + generate Prisma client ----------
FROM node:20-slim AS build

WORKDIR /app

# OpenSSL is required by Prisma at both build and runtime
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install all deps (including devDeps — we need tsx at runtime for the
# server because shared/ is consumed as raw TypeScript source).
RUN npm ci

# Copy sources for shared + server only
COPY shared/ shared/
COPY server/ server/

# Generate Prisma client against the schema
RUN cd server && npx prisma generate


# ---------- Runtime stage ----------
FROM node:20-slim AS runtime

WORKDIR /app

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy everything from the build stage. We ship TS source + tsx because
# shared/ has no compile step and the server imports shared files
# directly via relative .ts paths.
COPY --from=build /app /app

EXPOSE 3001

WORKDIR /app/server
# Push any pending schema changes, then start the server
CMD ["sh", "-c", "npx prisma db push && npx tsx src/index.ts"]
