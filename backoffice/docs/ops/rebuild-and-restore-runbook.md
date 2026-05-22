# Alliance Backoffice Rebuild and Restore Runbook

This runbook is for rebuilding the current single-host production-style EC2 environment and restoring the Alliance Backoffice database from an S3 backup.

The goal is not fancy infrastructure. The goal is a boring, repeatable recovery path.

## Current Assumptions

- Host: Ubuntu EC2 instance
- App repo: `/home/ubuntu/repos/alliance-site`
- Backoffice app: `/home/ubuntu/repos/alliance-site/backoffice`
- Runtime user: `ubuntu`
- Node process manager: PM2
- Reverse proxy: Nginx
- Database: local PostgreSQL
- Backup storage: S3
- S3 bucket: `database-backups-194226863661-us-east-2-an`
- S3 prefix: `dev`
- App health endpoint: `/backoffice/health`

## Required Secrets / Values

Before starting, have these available in a secure place:

- Postgres app database name
- Postgres app role/user
- Postgres app role password
- `DATABASE_URL`
- `SESSION_SECRET`
- SMTP user/password, if notifications are enabled
- Stripe secrets, if payment flows are enabled
- AWS credentials or instance role with access to the backup S3 bucket

Current expected backup env vars:

```env
BACKUP_S3_BUCKET=database-backups-194226863661-us-east-2-an
BACKUP_S3_PREFIX=dev
```

Do not rely on undocumented credentials already present on the server.

## Safety Check Before Rebuild

Confirm at least one recent backup exists in S3:

```bash
aws s3 ls s3://database-backups-194226863661-us-east-2-an/dev/
```

Optionally run a fresh backup before making destructive changes:

```bash
cd /home/ubuntu/repos/alliance-site/backoffice
npm run db:backup
```

Confirm the upload appears in S3:

```bash
aws s3 ls s3://database-backups-194226863661-us-east-2-an/dev/
```

## 1. Stop the App

```bash
pm2 stop all || true
```

If PM2 has no registered process, that is not fatal.

## 2. Rebuild / Verify Host Baseline

Run the EC2 bootstrap script from the repo:

```bash
cd /home/ubuntu/repos/alliance-site
./infra/bootstrap-ec2.sh
```

The bootstrap script should be idempotent and safe to rerun. It should install or verify:

- base apt packages
- Node.js / npm
- PM2
- AWS CLI
- PostgreSQL client/server tools
- Nginx
- `rsync` for static-site publishing
- runtime directories
- backup directories
- static web root at `/var/www/alliance-site/dist`

Validate core tools:

```bash
node --version
npm --version
pm2 --version
aws --version
pg_dump --version
pg_restore --version
```

## 3. Install Nginx Config

Install the committed Nginx config from the repo:

```bash
cd /home/ubuntu/repos/alliance-site
./infra/install-nginx-config.sh
```

This installs `infra/nginx/alliance-site.conf`, removes the default Ubuntu site, points the public site at `/var/www/alliance-site/dist`, and proxies `/backoffice` to the Express app on port `3001`.

Validate:

```bash
sudo nginx -t
systemctl status nginx --no-pager
```

## 4. Build and Publish Astro Static Site

Production does not run Astro as a server. Astro builds static files, and Nginx serves them.

From repo root:

```bash
cd /home/ubuntu/repos/alliance-site
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/alliance-site/dist/
sudo chown -R www-data:www-data /var/www/alliance-site
```

The deploy script now owns this during normal deployments.

Validate locally on the host:

```bash
curl -I http://localhost/
```

## 5. Install Backoffice App Dependencies

From the backoffice directory:

```bash
cd /home/ubuntu/repos/alliance-site/backoffice
npm install --omit=dev
```

When a lockfile is maintained and committed, prefer:

```bash
npm ci --omit=dev
```

If install appears to hang, check memory and disk before retrying:

```bash
free -h
df -h
```

## 6. Recreate PostgreSQL Cluster or Database

Use this section when intentionally resetting local Postgres state.

Inspect installed clusters:

```bash
pg_lsclusters
```

If intentionally destroying the local cluster, replace `16` with the actual version from `pg_lsclusters`:

```bash
sudo pg_dropcluster --stop 16 main
sudo pg_createcluster 16 main --start
```

If only resetting the app DB is needed, skip cluster destruction and use:

```bash
sudo -u postgres psql
```

Then run the SQL in the next section as needed.

## 7. Create App Role and Database

Open psql as the postgres superuser:

```bash
sudo -u postgres psql
```

Create the app role and database:

```sql
CREATE USER gdor WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE gdor_prod OWNER gdor;
GRANT ALL PRIVILEGES ON DATABASE gdor_prod TO gdor;
\q
```

Validate auth before restoring:

```bash
psql "postgres://gdor:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/gdor_prod"
```

If this fails, stop and fix auth before continuing.

## 8. Configure `.env`

Edit:

```bash
vi /home/ubuntu/repos/alliance-site/backoffice/.env
```

Minimum production-style database and backup values:

```env
NODE_ENV=production
PORT=3001
BASE_PATH=/backoffice
DATABASE_URL=postgres://gdor:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/gdor_prod
SESSION_SECRET=REPLACE_WITH_SESSION_SECRET
BACKUP_S3_BUCKET=database-backups-194226863661-us-east-2-an
BACKUP_S3_PREFIX=dev
```

Keep legacy or feature-specific values only as needed, such as SMTP, Stripe, and notification settings.

## 9. Download Latest Backup From S3

List backups:

```bash
aws s3 ls s3://database-backups-194226863661-us-east-2-an/dev/
```

Download the chosen backup:

```bash
mkdir -p /tmp/dbrestore
aws s3 cp \
  s3://database-backups-194226863661-us-east-2-an/dev/REPLACE_WITH_BACKUP_FILE.dump.gz \
  /tmp/dbrestore/restore.dump.gz
```

## 10. Restore Database

Use the project restore script:

```bash
cd /home/ubuntu/repos/alliance-site/backoffice
CONFIRM_RESTORE=yes npm run db:restore -- /tmp/dbrestore/restore.dump.gz
```

The restore script targets `DATABASE_URL`, drops/recreates the `public` schema, and restores the custom-format dump.

## 11. Validate Restored Data

Connect to the database:

```bash
psql "$DATABASE_URL"
```

Run sanity checks:

```sql
\dt
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM invoices;
SELECT COUNT(*) FROM work_orders;
\q
```

If table names differ, use `\dt` to inspect available tables and validate equivalent core business tables.

## 12. Start App With PM2

Preferred long-term command once an ecosystem file exists:

```bash
cd /home/ubuntu/repos/alliance-site/backoffice
pm2 startOrRestart ecosystem.config.js --update-env
pm2 save
```

Current fallback command:

```bash
cd /home/ubuntu/repos/alliance-site/backoffice
pm2 start app.js --name alliance-backoffice
pm2 save
```

If the app is already registered:

```bash
pm2 restart alliance-backoffice --update-env
pm2 save
```

Validate PM2:

```bash
pm2 status
pm2 logs alliance-backoffice --lines 50
```

If PM2 shows repeated restarts, inspect logs. Common causes:

- missing `node_modules`
- wrong `DATABASE_URL`
- missing env var
- app listening on an unexpected port
- wrong entrypoint

## 13. Validate App Health

Local health check:

```bash
curl -i http://localhost:3001/backoffice/health
```

External health check:

```bash
curl -I https://agdofroswell.com/backoffice/health
```

Then manually validate:

- login page loads
- dashboard loads
- customer/invoice pages load
- public payment lookup works
- a backup can still be created

## 14. Configure Nightly Backup Timer

Expected files:

```text
/etc/systemd/system/alliance-db-backup.service
/etc/systemd/system/alliance-db-backup.timer
```

Example service:

```ini
[Unit]
Description=Alliance Backoffice PostgreSQL backup

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/home/ubuntu/repos/alliance-site/backoffice
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run db:backup
```

Example timer:

```ini
[Unit]
Description=Run Alliance DB backup nightly

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true
Unit=alliance-db-backup.service

[Install]
WantedBy=timers.target
```

Enable and test:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alliance-db-backup.timer
sudo systemctl start alliance-db-backup.service
journalctl -u alliance-db-backup.service -n 50 -l --no-pager
systemctl list-timers --all | grep alliance
```

Confirm the service logs include an S3 upload line.

Confirm backup appears in S3:

```bash
aws s3 ls s3://database-backups-194226863661-us-east-2-an/dev/
```

## 15. Final Validation Checklist

- [ ] EC2 bootstrap script reruns cleanly
- [ ] Nginx config is installed from `infra/nginx/alliance-site.conf`
- [ ] Astro site builds with `npm run build`
- [ ] Astro `dist/` is published to `/var/www/alliance-site/dist`
- [ ] public site returns `200` from Nginx
- [ ] `npm install --omit=dev` or `npm ci --omit=dev` completes for backoffice
- [ ] Postgres role auth works with `DATABASE_URL`
- [ ] latest S3 backup can be downloaded
- [ ] restore script completes successfully
- [ ] core table counts look sane
- [ ] PM2 app is online without restart loop
- [ ] local health check succeeds
- [ ] external health check succeeds
- [ ] systemd backup service succeeds
- [ ] systemd timer is enabled
- [ ] new backup appears in S3
- [ ] PM2 state saved with `pm2 save`
- [ ] current server state is captured in an AMI after successful validation

## Lessons Learned From First Drill

Preventable churn:

- Credentials were not tracked rigorously early on.
- Backup env var names were confused: the script expects `BACKUP_S3_BUCKET` and `BACKUP_S3_PREFIX`.
- PM2 had no saved process, so `pm2 restart` had nothing to restart.
- App dependencies were not guaranteed after rebuild, causing runtime failure.

Normal churn:

- Restore testing exposed assumptions before a real emergency.
- systemd behavior differed from an interactive shell, which is expected.
- Backup success and restore success are separate guarantees.

The goal going forward is to encode every repeated manual step into scripts or committed config.
