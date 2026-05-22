# Alliance EC2 Infrastructure

This directory contains the repeatable host setup pieces for the current single-EC2 production shape.

Current architecture:

- Nginx serves the Astro static site from `/var/www/alliance-site/dist`
- Nginx proxies `/backoffice` to the Node/Express app on `127.0.0.1:3001`
- PM2 manages the backoffice process
- PostgreSQL runs locally on the EC2 instance
- systemd timer runs nightly Postgres backups to S3

## Fresh EC2 bootstrap flow

From a fresh Ubuntu EC2 instance after cloning the repo to `/home/ubuntu/repos/alliance-site`:

```bash
cd /home/ubuntu/repos/alliance-site

./deploy.sh
```

`deploy.sh` runs the idempotent host setup scripts first, then builds/publishes the site and restarts the backoffice. To skip host setup on a known-good server, run `SKIP_SETUP=1 ./deploy.sh`.

Then restore the database from the latest S3 backup using `docs/ops/rebuild-and-restore-runbook.md` when rebuilding from scratch.

## What each script owns

### `bootstrap-ec2.sh`

Installs host-level dependencies:

- Node.js
- npm
- PM2
- Nginx
- PostgreSQL client/server packages
- AWS CLI v2
- common build utilities

Also creates runtime directories:

- `/var/backups/alliance`
- `/var/log/alliance`
- `/var/www/alliance-site/dist`

### `install-nginx-config.sh`

Installs `infra/nginx/alliance-site.conf` into `/etc/nginx/sites-available`, enables it, removes the default Ubuntu site/stale duplicate Alliance configs, validates config, and reloads Nginx. The Alliance config intentionally avoids `default_server` so repeated installs do not collide with other server blocks.

### `install-systemd-units.sh`

Installs the backup service and timer from `infra/systemd`.

### `deploy.sh`

Application deployment:

- runs `bootstrap-ec2.sh`, `install-nginx-config.sh`, and `install-systemd-units.sh` unless `SKIP_SETUP=1` is set
- installs root/Astro dependencies
- builds the Astro site
- publishes `dist/` to `/var/www/alliance-site/dist`
- installs backoffice production dependencies
- starts/restarts PM2 using `backoffice/ecosystem.config.js`
- reloads Nginx
- validates `/backoffice/health`

## Notes

The Astro site is not run as a long-lived Node service in production. It is built into static files and served by Nginx.

The backoffice is the only long-running Node app.
