# ---------- Build stage ----------
FROM node:20-slim AS build

WORKDIR /app

# Install OpenSSL (required by Prisma) and build tools
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

# Copy sources for shared + server only
COPY shared/ shared/
COPY server/ server/

# Build shared first, then generate Prisma client, then build server
RUN npm run build --workspace=shared
RUN cd server && npx prisma generate
RUN npm run build --workspace=server


# ---------- Runtime stage ----------
FROM node:20-slim AS runtime

WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy runtime files (built output + deps)
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/shared/package.json ./shared/
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
