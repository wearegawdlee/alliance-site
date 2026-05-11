#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: npm run db:restore -- /path/to/backoffice-YYYYMMDDTHHMMSSZ.dump.gz" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

CONFIRM="${CONFIRM_RESTORE:-}"
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Refusing to restore without CONFIRM_RESTORE=yes" >&2
  echo "Example: CONFIRM_RESTORE=yes npm run db:restore -- ${BACKUP_FILE}" >&2
  exit 1
fi

TMP_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  TMP_FILE="$(mktemp /tmp/backoffice-restore.XXXXXX.dump)"
  gunzip -c "$BACKUP_FILE" > "$TMP_FILE"
fi

echo "Restoring ${BACKUP_FILE} into DATABASE_URL target."
echo "Dropping/recreating public schema before restore."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

pg_restore --dbname="$DATABASE_URL" --no-owner --no-acl --clean --if-exists "$TMP_FILE"

if [[ "$TMP_FILE" != "$BACKUP_FILE" ]]; then
  rm -f "$TMP_FILE"
fi

echo "Restore complete."
