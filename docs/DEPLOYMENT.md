# Deployment

MyScreener is deployed as a **single HTTP process** (Next.js on port 8080) that proxies `/api/*`
to the bundled Express API (port 3002) running **inside the same process/container**. This is the
contract the [Dockerfile](../Dockerfile) enforces.

Two supported paths: **Docker Compose** (recommended) and **manual on a VPS**.

---

## 0. Secrets

1. Copy `.env.example` to `.env` at the repo root and fill in **real** values.
   - `JWT_SECRET` — generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Rotate every key that was ever present in `server/.env` (see AUDIT.md).
2. The runtime container reads `/app/.env` (mounted or provided via compose `environment`).
   Dev reads `server/.env`; Compose reads the root `.env` for substitution.

---

## 1. Docker Compose (recommended)

`docker-compose.yml` starts: **MySQL 8**, **Redis 7**, the **app** (built from the Dockerfile),
and an optional **nginx** reverse proxy (`--profile proxy`).

```bash
# 1. Create the root .env (used by compose for substitution)
cp .env.example .env
#    …edit .env and set at least: JWT_SECRET, MYSQL_ROOT_PASSWORD, MYSQL_APP_PASSWORD,
#    APP_DOMAIN/API_DOMAIN/CORS_ORIGINS, GOOGLE_CLIENT_ID, TELEGRAM_BOT_TOKEN,
#    MANUAL_PAYMENT_* (if using QR billing)

# 2. Build & start (mysql + redis + app)
docker compose up -d --build

# 3. Optional nginx on :80/:443 in front of the app
docker compose --profile proxy up -d nginx

# 4. Verify
curl http://localhost:8080/api/health
```

Health checks: `mysql` and `app` declare `service_healthy`; `app` waits for MySQL before booting.

> **Port note.** Do **not** set `PORT` for the app service — the API uses 3002 internally and
> Next.js serves the external port 8080 (`${PORT:-8080}` in the Dockerfile). Map `8080:8080`.

### Updates

```bash
git pull
docker compose up -d --build        # rebuilds the image; data lives in named volumes
```

The additive-only schema sync applies column/table changes automatically; nothing is dropped.

---

## 2. Manual deployment on a VPS

```bash
# Prereqs: Node 22+, MySQL 8+, Redis 7+, nginx

npm ci
npm --prefix web ci
npm run build:all                   # dist/server.cjs + web/.next

# Run both (production launcher)
npm run start:all
```

For a long-running service use `pm2` or systemd:

```bash
pm2 start scripts/start-prod.js --name myscreener
pm2 save && pm2 startup
```

### nginx

Put `nginx/nginx.conf` in `/etc/nginx/conf.d/myscreener.conf`, adjust `server_name`, and
obtain TLS with certbot:

```bash
sudo certbot --nginx -d screener.example.com
```

The provided config disables proxy buffering so SSE (`/api/realtime/stream`) streams correctly.

---

## 3. Reverse proxy & TLS

`nginx/nginx.conf` (Compose `--profile proxy` or standalone):

- Listens on 80 and 443 (TLS block commented out — fill cert paths / use certbot).
- Proxies to `app:8080` (compose) or `127.0.0.1:8080` (VPS).
- `proxy_buffering off` for `/api/realtime/stream` (SSE).
- Sends `X-Forwarded-Proto` so the API can build absolute URLs.

---

## 4. Health & readiness

| Probe | Expect |
|---|---|
| `GET /api/health` | `200` JSON `{ status: 'ok', ... }` |
| `GET /api/connectors/health` | connector status per exchange |
| Container `docker compose ps` | all `healthy` / `running` |

---

## 5. Go-live checklist

- [ ] `JWT_SECRET` ≥ 32 chars, generated fresh
- [ ] All keys rotated (Google OAuth, Telegram, Finnhub/Polygon, Stripe) — treat old ones as leaked
- [ ] `NODE_ENV=production` (enforces CSP, disables dev access bypass)
- [ ] `CORS_ORIGINS` = the real production origin; `APP_DOMAIN`/`API_DOMAIN` set
- [ ] MySQL root + app passwords changed; ports not exposed publicly (use compose internal network)
- [ ] Backup cron configured — see [BACKUP_RESTORE.md](BACKUP_RESTORE.md)
- [ ] TLS certificate valid; HTTP → HTTPS redirect active
- [ ] `GET /api/run-tests` verified to be ADMIN-only
- [ ] Monitoring / log aggregation configured (see AUDIT.md Phase 3)
