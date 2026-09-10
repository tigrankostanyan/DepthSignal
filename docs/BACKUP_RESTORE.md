# Backup & Restore

MyScreener stores all durable state in **MySQL** (users, subscriptions, walls, alerts, receipts).
Redis is a cache/rate-limit store and does **not** need backups.

The schema is maintained with **additive-only** sync (`server/src/db/database.ts`), which never
drops tables or columns — so restoring a dump into a newer code version is safe.

---

## 1. What to back up

| Item | Where | Method |
|---|---|---|
| MySQL database | MySQL server / `mysql` compose service | `mysqldump` |
| `.env` (secrets) | root `.env` + `server/.env` | secret manager / encrypted store |
| Uploaded receipts | stored as base64 in `PaymentProof` (DB) | included in the dump |
| Redis | cache only | not required |

---

## 2. Backup

### Against Docker Compose

```bash
# Timestamped logical dump inside the mysql container
docker compose exec -T mysql sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
     --single-transaction --routines --triggers --databases "$MYSQL_DATABASE"' \
  > "backup-$(date +%Y%m%d-%H%M%S).sql"
```

### Against a local / VPS MySQL

```bash
mysqldump -h "${MYSQL_HOST:-127.0.0.1}" -P "${MYSQL_PORT:-3306}" \
  -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  --single-transaction --routines --triggers \
  "$MYSQL_DATABASE" > "backup-$(date +%Y%m%d-%H%M%S).sql"
```

Use `--single-transaction` for a consistent snapshot without locking InnoDB tables.

### Schedule (cron, daily 03:00, keep 14 days)

```cron
0 3 * * * cd /opt/myscreener && ./scripts/backup-db.sh >> /var/log/myscreener-backup.log 2>&1
0 4 * * * find /opt/myscreener/backups -name 'backup-*.sql' -mtime +14 -delete
```

> `scripts/backup-db.sh` shelling out to `mysqldump` is provided as a reference in the docs;
> call it from cron/CI as needed. On Windows, run it under WSL or Git Bash.

---

## 3. Restore

> Stop the app first so no writes land mid-restore.

```bash
# 1. Stop the application (keep MySQL running)
docker compose stop app

# 2. Restore the dump
docker compose exec -T mysql sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup-20240101-030000.sql

# 3. Start the app (schema sync will add any missing columns/tables)
docker compose start app
```

For a VPS MySQL:

```bash
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < backup-XXXX.sql
```

---

## 4. Verify a restore (do this periodically)

1. Restore into a **staging** database, not production.
2. Boot the app against it: `npm run dev` (points at staging via `MYSQL_*`).
3. Check: `GET /api/health` → 200, admin user logs in, screener shows tickers.
4. Confirm row counts survived:
   ```sql
   SELECT
     (SELECT COUNT(*) FROM Users)                    AS users,
     (SELECT COUNT(*) FROM Subscriptions)            AS subscriptions,
     (SELECT COUNT(*) FROM DetectedWalls)            AS walls,
     (SELECT COUNT(*) FROM AlertRules)               AS alert_rules,
     (SELECT COUNT(*) FROM PaymentProofs)            AS receipts;
   ```
5. Record the test date and result. A backup that has never been restored is not a backup.

---

## 5. Recovery goals (recommended)

| Metric | Target |
|---|---|
| RPO (max data loss) | ≤ 24h (daily dump) — use binlog shipping for lower |
| RTO (max downtime) | ≤ 1h for a single-node MySQL restore |
| Retention | 14 daily, 8 weekly, 12 monthly |
| Off-site | Ship dumps to object storage (S3/Spaces) |

---

## 6. Scaling beyond a single node

For higher availability, move MySQL and Redis to managed services (RDS / ElastiCache / Upstash),
enable automated snapshots and point-in-time recovery, and set `REDIS_ENABLED=true` +
`REDIS_URL` so rate limiting and caches are shared across instances.
