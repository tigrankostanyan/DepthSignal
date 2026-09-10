# API Reference

Base URL: `/api` (dev API: `http://localhost:3002/api`; reached through the web app at `/api/*`).

**Auth legend**

| Symbol | Meaning |
|---|---|
| — | Public |
| 🔑 | Requires a valid session (`requireAuth`) |
| ✅ | Requires session **and** an active subscription (`requireActiveAccess`) |
| 🛡 | Requires an `ADMIN` role |

Session is taken from the JWT cookie or the `x-session-token` header. Login issues a 7-day token.

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create an account (role defaults to `USER`) |
| POST | `/login` | — | Log in; never overwrites an existing account's role |
| POST | `/google` | — | Google OAuth login (verifies ID token) |
| POST | `/refresh` | — | Refresh the session token |
| POST | `/logout` | — | End the session |
| GET | `/me` | 🔑 | Current user profile |
| GET | `/config` | — | Public auth config (e.g. whether Google login is enabled) |

## Realtime — `/api/realtime`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/stream` | ✅ | **SSE** stream. Events: `tickers_batch`, `wall_event`, `alert_trigger`, `subscription_updated` |

## Market — `/api/market`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/tickers` | — | Screener tickers. Supports filters + `limit`; results respect plan entitlements |
| GET | `/symbol/:symbol` | — | Detail for a single symbol (order book, trades, candles) |

## Walls — `/api/walls`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/active` | — | Currently active walls |
| GET | `/history` | — | Historical walls (retention: 90 days) |
| GET | `/daily-aggregates` | — | Daily wall aggregates |
| GET | `/config` | — | Wall detection configuration |
| POST | `/config` | ✅ | Update wall detection configuration |

## Alerts — `/api/alerts`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rules` | ✅ | List alert rules |
| POST | `/rules` | ✅ | Create a rule |
| DELETE | `/rules/:id` | ✅ | Delete a rule |
| GET | `/triggers` | ✅ | List triggered alerts |
| POST | `/triggers/read` | ✅ | Mark trigger(s) as read |
| DELETE | `/triggers` | ✅ | Clear triggers |
| POST | `/test-trigger` | ✅ | Fire a test alert (rate-limited) |

## Watchlists — `/api/watchlists`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | List watchlists |
| POST | `/` | ✅ | Create a watchlist |
| DELETE | `/:id` | ✅ | Delete a watchlist |
| POST | `/:id/items` | ✅ | Add an item |
| DELETE | `/:id/items` | ✅ | Remove an item |

## Blacklist — `/api/blacklist`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | List blacklisted symbols |
| POST | `/` | ✅ | Add an entry |
| DELETE | `/:id` | ✅ | Remove an entry |

Blacklisted symbols are excluded before ingestion (no walls/alerts generated).

## Presets — `/api/presets`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | List saved filter presets |
| POST | `/` | ✅ | Save a preset |
| DELETE | `/:id` | ✅ | Delete a preset |

## Settings — `/api/settings`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | Get user settings |
| POST | `/` | ✅ | Update user settings |

## Telegram — `/api/telegram`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/status` | ✅ | Link status |
| POST | `/link-token` | ✅ | Generate a link token |
| POST | `/test-alert` | ✅ | Send a test alert to Telegram |
| POST | `/disconnect` | ✅ | Unlink Telegram |
| POST | `/webhook` | — | Telegram bot webhook |

## Billing — `/api/billing`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/config` | — | Billing configuration |
| GET | `/plans` | — | Available plans |
| GET | `/subscription` | 🔑 | Current subscription |
| POST | `/receipts` | 🔑 | Submit a payment receipt (base64 image) |
| GET | `/receipts` | 🔑 | My submitted receipts |
| GET | `/history` \| `/events` | 🔑 | Billing history |
| POST | `/checkout` | 🔑 | Stripe checkout (not used by UI) |
| POST | `/portal` | ✅ | Stripe billing portal (not used by UI) |
| GET | `/sandbox/checkout` | — | Sandbox checkout helper |
| POST | `/webhook` | — | Stripe webhook |
| POST | `/binance/checkout` | 🔑 | Binance Pay checkout |
| POST | `/binance/webhook` | — | Binance Pay webhook |

## Admin — `/api/admin` (all 🛡)

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List users |
| POST | `/users/:id/plan` | Set a user's plan |
| POST | `/users/:id/role` | Set a user's role |
| GET | `/stats` | Platform stats |
| GET | `/receipts` | Payment receipts pending review |
| POST | `/receipts/:id/activate` | Approve a receipt → upgrade subscription |
| POST | `/receipts/:id/reject` | Reject a receipt |
| GET | `/notifications/deliveries` | Notification delivery log |
| POST | `/notifications/:id/retry` | Retry a failed delivery |

## User — `/api/user`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/export` | 🔑 | Export the user's data (GDPR) |
| DELETE | `/me` | 🔑 | Permanently delete the account |

## System — `/api` (mounted at root)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Liveness probe |
| GET | `/integrations/status` | — | Status of external integrations |
| GET | `/connectors/health` | — | Exchange connector health |
| GET | `/audit/logs` | 🔑 | Audit log entries |
| GET | `/run-tests` | 🛡 | Trigger the internal test runner |

---

## SSE stream

Connect with an authenticated `EventSource` to `GET /api/realtime/stream`.

| Event | Payload | Cadence |
|---|---|---|
| `tickers_batch` | `{ tickers: MarketTicker[] }` (plan-filtered by exchange) | every 400ms |
| `wall_event` | `{ wall: DetectedWall, eventType: 'FORMING' \| 'CONFIRMED' \| ... }` | on detection |
| `alert_trigger` | `AlertTrigger` (sent to the owning user, or broadcast) | on rule match |
| `subscription_updated` | `{ plan: string, ... }` | on plan change |

Server limits: 500 concurrent clients, 5 per user, 15s heartbeat.

---

## Errors

All errors are JSON: `{ "error": string, "message"?: string, "correlationId": string }`.
Common statuses: `400` validation, `401` unauthenticated, `403` forbidden / no active access,
`404` not found, `429` rate limited (see `Retry-After` / rate-limit headers), `500` server error.
