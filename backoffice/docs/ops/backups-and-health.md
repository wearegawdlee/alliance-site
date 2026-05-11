# Backups, Restore, and Health Checks

## Health check

The app exposes an unauthenticated health endpoint:

```text
/backoffice/health
```

It verifies:

- Node process is responding
- PostgreSQL accepts a simple `SELECT 1`

Expected healthy response:

```json
{
  "ok": true,
  "service": "backoffice",
  "uptimeSeconds": 123,
  "db": "ok",
  "latencyMs": 12,
  "timestamp": "2026-05-09T00:00:00.000Z"
}
```

Use this for uptime monitoring once DNS/HTTPS are finalized.

## Required server packages

Install these on EC2 if missing:

```bash
sudo apt update
sudo apt install -y postgresql-client awscli
```

## Environment variables

Required:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/database_name
```

Optional:

```bash
BACKUP_DIR=./backups
BACKUP_S3_BUCKET=your-s3-bucket-name
BACKUP_S3_PREFIX=postgres
BACKUP_RETENTION_DAYS=14
```

If `BACKUP_S3_BUCKET` is set, the backup script uploads the compressed dump to S3 using the EC2 instance role or configured AWS credentials.

## Manual backup

From `backoffice/`:

```bash
npm run db:backup
```

This creates:

```text
backups/backoffice-YYYYMMDDTHHMMSSZ.dump.gz
```

## Manual restore

Restore is intentionally guarded.

```bash
CONFIRM_RESTORE=yes npm run db:restore -- ./backups/backoffice-YYYYMMDDTHHMMSSZ.dump.gz
```

The restore script drops/recreates the `public` schema before restoring the dump.

Do not run this against production unless you are intentionally replacing production data.

## Nightly cron example

Run daily at 2:15 AM server time:

```bash
crontab -e
```

Add:

```cron
15 2 * * * cd /home/ubuntu/repos/alliance-site/backoffice && /usr/bin/npm run db:backup >> /var/log/backoffice-backup.log 2>&1
```

## Restore drill

A backup is not trusted until restore has been tested.

Recommended drill:

1. Copy a recent `.dump.gz` backup.
2. Restore it into a non-production database.
3. Start the app against that restored database.
4. Hit `/backoffice/health`.
5. Spot-check login, customers, invoices, and recurring plans.
