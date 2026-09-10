# syntax=docker/dockerfile:1
# Verdent fullstack contract: one externally reachable HTTP process (Next.js)
# proxying /api/* to the Express server running in the same container.

# ---------- Stage 1: build server bundle ----------
FROM node:22-bookworm-slim AS server-build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY server/ ./server/
# --ignore-scripts: dev-only native modules (better-sqlite3/sqlite3) are not
# needed for bundling; esbuild binary comes from @esbuild/linux-arm64 optional dep.
RUN npm ci --ignore-scripts --no-audit --no-fund
RUN npm run build

# ---------- Stage 2: build Next.js frontend ----------
FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# web/src re-exports server type definitions via ../../../server/src/types,
# which must exist inside this stage for the Next.js build to resolve them.
COPY server/src/types/ /app/server/src/types/
RUN npm run build

# ---------- Stage 3: production runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Server runtime dependencies (pure JS; native deps moved to devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Server bundle
COPY --from=server-build /app/dist/ ./dist/

# Frontend production runtime
COPY web/package.json ./web/
COPY --from=web-build /app/web/node_modules/ ./web/node_modules/
COPY --from=web-build /app/web/.next/ ./web/.next/
COPY web/public/ ./web/public/
COPY web/next.config.ts ./web/

# Internal API port (Express) is 3002; external port comes from injected PORT.
EXPOSE 8080
CMD ["sh", "-c", "node dist/server.cjs & cd web && exec node node_modules/next/dist/bin/next start -p ${PORT:-8080}"]
