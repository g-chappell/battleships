# ---------- Build stage ----------
FROM node:20-slim AS build

WORKDIR /app

# These are baked into the static bundle at build time. For a single-host
# deployment behind nginx, relative paths work because nginx proxies /api
# and /socket.io to the server container on the docker network.
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

# Copy sources. shared/ has no compile step — Vite transpiles its
# TypeScript source directly via the @shared alias.
COPY shared/ shared/
COPY client/ client/

RUN npm run build --workspace=client


# ---------- Runtime stage (nginx) ----------
FROM nginx:1.27-alpine AS runtime

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
