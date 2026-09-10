# MyScreener

Crypto **order-book screener** with **liquidity wall detection** and **real-time alerts**.

Monorepo containing a Next.js frontend (`web/`) and an Express + Sequelize API (`server/`)
that streams live market data from 10 exchanges via WebSocket connectors.

---

## Highlights

- **Live data** — order books, trades and tickers streamed over SSE (`tickers_batch` every 400ms,
  `wall_event`, `alert_trigger`). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#realtime-data-flow).
- **Wall Engine** — detects liquidity walls and spoofing patterns in real time
  (`server/src/services/wall-engine/`).
- **Alert Engine** — price / wall alerts delivered via Telegram, email (stub) and SSE.
- **Plans & manual QR billing** — users pick a plan on a dedicated pricing page, upload a payment
  receipt, and an admin activates it. See `web/src/app/(app)/pricing/`.
- **Auth** — JWT + Google OAuth, 7-day sessions, role-based access (USER / TRADER / ADMIN).
- **Additive-only schema sync** — the schema is kept up to date **without ever dropping tables**,
  see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#database).

---

## Repository layout

```
.
├── server/                  # Express API (port 3002, overridable via PORT)
│   ├── src/
│   │   ├── app.ts           # Express app assembly (middleware + routers)
│   │   ├── server.ts        # Entry point (also bundled to dist/server.cjs)
│   │   ├── controllers/     # 15 HTTP controllers
│   │   ├── models/          # 21 Sequelize models
│   │   ├── repositories/    # 10 data-access repositories
│   │   ├── routes/          # 14 routers (auth, billing, walls, watchlists, …)
│   │   ├── security/        # auth/access middleware, rate limiting, CSP, SSRF
│   │   └── services/        # connectors, wall/alert engines, market state, SSE, billing
│   └── tests/               # 7 test suites (see "Testing")
├── web/                     # Next.js 15 App Router frontend (port 3001)
│   └── src/app/             # 18 pages, incl. (app)/screener, pricing, admin
├── scripts/                 # build/run/clean helpers
├── docs/                    # architecture, API, deployment, backup/restore
├── AUDIT.md                 # full technical audit + handover checklist
├── Dockerfile               # multi-stage: server bundle + Next build + runtime
└── docker-compose.yml       # mysql + redis + app (+ optional nginx)
```

---

## Quick start (development)

Requirements: **Node.js 22+**, **MySQL 8+**, optional **Redis 7**.

```bash
# 1. Install dependencies (root + web)
npm install
npm --prefix web install

# 2. Configure environment
#    Dev reads server/.env — copy the template and fill in secrets
cp .env.example server/.env

# 3. Start the API (http://localhost:3002)
npm run dev

# 4. In a second terminal, start the web app (http://localhost:3001)
npm run start:web          # requires a production web build; for dev use:
# cd web && npm run dev
```

The web app proxies `/api/*` to the API via `web/next.config.ts` rewrites, so in dev you can also
open `http://localhost:3001` after running `npm --prefix web run dev`.

> **Env note.** Dev loads `server/.env`. The production bundle (`dist/server.cjs`) looks for
> `.env` in the repo root — `start-prod.js` and `docker-compose.yml` handle this for you.

---

## Production

```bash
# Build both apps
npm run build:all           # esbuild bundle -> dist/server.cjs  +  Next.js -> web/.next

# Start API + web together (one process tree, clean shutdown)
npm run start:all

# Or run only one side
npm start                   # API only (node dist/server.cjs)
npm run start:web           # web only
```

Ports: API `PORT` (default 3002), web `WEB_PORT` (default 3001).

For containerised deployment see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and `docker-compose.yml`.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Run the API in watch mode (`tsx`) |
| `npm run build` | Bundle the API with esbuild → `dist/server.cjs` |
| `npm run build:web` | Build the Next.js app |
| `npm run build:all` | Build both |
| `npm start` | Run the built API |
| `npm run start:web` | Run the built web app (port 3001) |
| `npm run start:all` | Run API + web together (production) |
| `npm run clean` | Remove build artefacts (cross-platform) |
| `npm run lint` | TypeScript typecheck (root) |
| `npm --prefix web run lint` | TypeScript typecheck (web) |
| `npm test` | Run all server test suites |
| `npm run test:domain` | Domain + security hardening suites (needs MySQL) |
| `npm run test:comprehensive` | Live runtime verification (needs exchanges/network) |

---

## Configuration

All environment variables are documented in [.env.example](.env.example). Key groups:

- **Database** — `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`
- **Auth** — `JWT_SECRET` (required, ≥32 chars in production), `GOOGLE_CLIENT_ID`
- **Billing** — `MANUAL_PAYMENT_*` (QR payment), optional `STRIPE_*` / `BINANCE_PAY_*`
- **Realtime** — `REDIS_ENABLED`, `REDIS_URL`, `REDIS_*_TTL_SECONDS`
- **Notifications** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SMTP_*`
- **Exchanges** — `FINNHUB_API_KEY`, `POLYGON_API_KEY` (stock exchange, optional)
- **App** — `APP_DOMAIN`, `API_DOMAIN`, `CORS_ORIGINS`, `LOG_LEVEL`, `NODE_ENV`, `PORT`

> **Security.** The audit (AUDIT.md) treats all keys that were ever present in `server/.env` as
> leaked. Rotate them before going live and never commit real secrets.

---

## Testing

```bash
npm run test:domain         # 12 domain + security tests (WallEngine, isolation, rate limit, …)
npm test                    # everything incl. billing, notifications, telegram linking
```

Tests load `.env` from `server/.env` and require a reachable MySQL instance.

---

## Deployment

- **Single container** — [Dockerfile](Dockerfile) builds API + web into one image; `docker-compose.yml`
  adds MySQL and Redis services.
- **Reverse proxy** — see [nginx/nginx.conf](nginx/nginx.conf) for TLS / gzip / proxy sample.
- **CI** — `.github/workflows/ci.yml` runs lint, builds and `test:domain`.
- **Backups** — see [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md).

---

## Documentation

| Document | Contents |
|---|---|
| [AUDIT.md](AUDIT.md) | Full technical audit, security findings, phased roadmap |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data flow, module map |
| [docs/API.md](docs/API.md) | REST + SSE API reference |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, nginx, env setup, go-live steps |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | MySQL backup / restore / retention |

---

## Notes for the receiving team

1. The live data pipeline is real: connectors open WebSocket connections to exchanges and the SSE
   stream pushes `tickers_batch` every 400ms. Don't assume data is mocked.
2. Schema changes are applied automatically and **additively** — tables are never dropped, but a
   proper migration workflow is still recommended before scaling (see AUDIT.md, Phase 2).
3. Only 4 of 10 exchange connectors are enabled by default (`BINANCE, BYBIT, OKX, MEXC`) — see
   `server/server.ts` → `connectorManager.startAll([...])`.
