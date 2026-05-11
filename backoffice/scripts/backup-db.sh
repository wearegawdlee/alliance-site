#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/backoffice-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Creating Postgres backup: ${BACKUP_FILE}"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$BACKUP_FILE"

gzip -f "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

echo "Backup created: ${BACKUP_FILE}"

if [[ -n "$S3_BUCKET" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "BACKUP_S3_BUCKET is set, but aws CLI was not found." >&2
    exit 1
  fi

  S3_URI="s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$BACKUP_FILE")"
  echo "Uploading backup to ${S3_URI}"
  aws s3 cp "$BACKUP_FILE" "$S3_URI" --only-show-errors
fi

find "$BACKUP_DIR" -type f -name 'backoffice-*.dump.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete."
