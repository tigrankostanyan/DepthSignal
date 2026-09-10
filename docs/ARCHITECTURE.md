# Architecture

MyScreener is a real-time crypto market screener. This document describes the moving parts and how
data flows from exchange to browser.

---

## Components

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Browser (Next.js)                            │
│   React 19 · App Router · Tailwind 4 · SSE client (EventSource)           │
└───────────────▲───────────────────────────────────────────┬──────────────┘
                │ /api/* rewrites (web/next.config.ts)       │ SSE /api/realtime/stream
                │                                            │
┌───────────────┴────────────────────────────────────────────▼──────────────┐
│                          Express API (server/)                             │
│                                                                            │
│  Routers ─ Controllers ─ Services                                          │
│                                    ┌──────────────────────────────┐        │
│                                    │ ConnectorManager             │        │
│                                    │  Binance │ Bybit │ OKX │ …   │◄───────┼── WebSocket / REST
│                                    └───────┬──────────────────────┘        │   to 10 exchanges
│                                            │ onTicker / onOrderBook / onTrade
│                        ┌───────────────────┼───────────────────┐           │
│                        ▼                   ▼                   ▼           │
│                 MarketStateService    WallEngine         AlertEngine       │
│                 (latest tickers,      (wall detection,   (rule evaluation, │
│                  order books,          spoofing)          triggers)        │
│                  candles)                  │                   │           │
└────────────────────────────────────────────┼───────────────────┼───────────┘
                                             ▼                   ▼
                                    SSEManager (broadcast)   NotificationQueue ──► Telegram / email
                                             │
                              ┌──────────────┴───────────────┐
                              ▼                              ▼
                        MySQL (Sequelize)                Redis (optional)
                     users, walls, alerts,            rate limits, caches,
                     subscriptions, receipts           TTL keys
```

---

## Backend (`server/`)

| Layer | Location | Responsibility |
|---|---|---|
| Entry | `server/server.ts` | Boots DB, wires event pipelines, starts connectors & background jobs |
| App | `server/src/app.ts` | Express assembly: CORS, JSON (8MB), security headers, routers |
| Context | `server/src/context.ts` | Builds the DI container (`ServerContext`) used by all controllers |
| Routes | `server/src/routes/` | 14 routers, mounted under `/api/*` |
| Controllers | `server/src/controllers/` | HTTP validation + response shaping |
| Repositories | `server/src/repositories/` | Data access over Sequelize models |
| Services | `server/src/services/` | Connectors, engines, billing, notifications, SSE, Redis |
| Security | `server/src/security/` | Auth/access middleware, rate limiting, CSP, SSRF guard |

### Connectors

`ConnectorManager` owns one connector per exchange. Each connector implements `ExchangeConnector`
(`connect`, `subscribe`, `unsubscribe`, `disconnect`) and emits normalized
`MarketTicker` / `OrderBookSnapshot` / `Trade` events.

- Registered: Binance, Bybit, OKX, MEXC, Gate, Bitget, KuCoin, Hyperliquid, AsterDEX (+ stock via Finnhub/Polygon)
- Enabled by default (`server/server.ts`): `BINANCE`, `BYBIT`, `OKX`, `MEXC`
- See `server/src/services/connectors/`.

### Wall & Alert engines

- **WallEngine** (`services/wall-engine/WallEngine.ts`) consumes order books, aggregates liquidity
  into walls, and emits `FORMING` / `CONFIRMED` / `REMOVED` events. Active walls are persisted with
  a throttle to avoid write amplification.
- **SpoofingDetector** (`services/wall-engine/SpoofingDetector.ts`) flags patterns such as
  layering / wash trading.
- **AlertEngine** (`services/alert-engine/AlertEngine.ts`) evaluates user rules against tickers and
  wall events, producing `AlertTrigger`s that flow to SSE and the notification queue.

### Realtime data flow

1. `ConnectorManager` pushes normalized updates into `MarketStateService`.
2. `server.ts` runs a **400ms interval**: it reads all tickers, buckets them by exchange, and calls
   `sseManager.broadcastTickers(all, groupedByExchange)`.
3. Each SSE client is registered with an `allowedExchanges` list derived from the user's plan
   (`realtimeRoutes.ts` → `getPlanDefinition(plan).limits.allowedExchanges`). Admin receives all.
4. Walls and alerts are pushed immediately (`wall_event`, `alert_trigger`).

SSE events: `tickers_batch`, `wall_event`, `alert_trigger`, `subscription_updated`.
Limits: 500 global clients / 5 per user, 15s heartbeat (`services/realtime/sseManager.ts`).

### Database

- **ODM:** Sequelize 6 (MySQL). 21 models in `server/src/models/`.
- **Schema sync:** `server/src/db/database.ts` → `syncSchema()` is **additive-only**:
  it creates missing tables (`model.sync()`) and adds missing columns (`queryInterface.addColumn`),
  wrapped in try/catch. **It never issues DROP/DELETE** — existing tables and data are preserved.
- **Retention:** wall history older than 90 days is purged every 6 hours; expired sessions every hour.

> A versioned migration tool (e.g. `umzug` + timestamped migration files) is recommended for
> multi-environment deployments — see AUDIT.md Phase 2.

### Redis (optional)

When `REDIS_ENABLED=true`, Redis is used for rate limiting (`INCR`+`TTL`), caches and TTL keys.
Without it the API falls back to in-process maps (single-instance only).

---

## Frontend (`web/`)

- **Framework:** Next.js 15 App Router, React 19, TypeScript, Tailwind 4.
- **Routing:** pages under `web/src/app/`; authenticated pages live in the `(app)` route group.
- **API access:** `web/src/lib/api-*.ts` modules call `/api/*`, which `next.config.ts` rewrites to
  the Express API (`API_DOMAIN` / localhost:3002).
- **Realtime:** `web/src/lib/realtime/sse.ts` opens the EventSource stream and fans events into
  `RealtimeContext`; heavy alert data is kept in a separate context to avoid re-rendering the
  screener on every alert.
- **Screener performance:** filtering/sorting is memoized separately from wall rendering;
  `ScreenerTable` is virtualized (`@tanstack/react-virtual`).

---

## Auth & access control

- **Sessions:** JWT signed with `JWT_SECRET` (required, ≥32 chars in production), 7-day validity,
  also set as an httpOnly cookie. `x-session-token` header is accepted as an alternative transport.
- **Google OAuth:** `POST /api/auth/google` verifies the ID token server-side.
- **Roles:** `USER` (default) / `TRADER` / `ADMIN`. Registered accounts always start as `USER`.
- **Login vs. registration:** logging in never overwrites an existing account's role; a new account
  is created only when the email is unknown (`AuthService`).
- **Access gate:** `requireActiveAccess` blocks API usage for users without an active subscription
  (bypass only when `ALLOW_DEV_ACCESS_BYPASS=true` and not in production).
- **Account deletion:** `DELETE /api/user/me` removes the account and records a tombstone
  (`DeletedAccount`) so the email cannot be silently re-registered.

---

## Billing

- **Plans** are defined in `server/src/services/billing/planConfig.ts` (limits + `allowedExchanges`).
- **Manual QR flow (active):** pricing page → user scans QR → uploads a receipt
  (`POST /api/billing/receipts`) → admin reviews (`GET/POST /api/admin/receipts/...`) →
  subscription upgraded.
- Stripe / Binance Pay providers exist but are not wired into the UI.
