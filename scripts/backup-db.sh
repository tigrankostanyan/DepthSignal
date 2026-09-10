#!/usr/bin/env bash
# Logical MySQL backup for MyScreener.
#
# Usage:
#   ./scripts/backup-db.sh [output-dir]
#
# Reads connection settings from the environment (falls back to a local .env):
#   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
#
# On Windows run this from WSL or Git Bash.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/backups}"
mkdir -p "$OUT_DIR"

# Load .env if values are not already exported (root first, then server/).
for env_file in "$ROOT_DIR/.env" "$ROOT_DIR/server/.env"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    break
  fi
done

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:?MYSQL_USER is not set}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is not set}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is not set}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/backup-$STAMP.sql"

echo "[backup] dumping $MYSQL_DATABASE from $MYSQL_HOST:$MYSQL_PORT -> $OUT_FILE"
mysqldump \
  --host="$MYSQL_HOST" \
  --port="$MYSQL_PORT" \
  --user="$MYSQL_USER" \
  --password="$MYSQL_PASSWORD" \
  --single-transaction --routines --triggers \
  "$MYSQL_DATABASE" > "$OUT_FILE"

echo "[backup] done ($(du -h "$OUT_FILE" | cut -f1))"
