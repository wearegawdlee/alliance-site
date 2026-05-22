#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/repos/alliance-site}"
BACKOFFICE_DIR="${BACKOFFICE_DIR:-${REPO_DIR}/backoffice}"
APP_NAME="${APP_NAME:-alliance-backoffice}"

cd "$REPO_DIR"

if [[ "${SKIP_SETUP:-0}" != "1" ]]; then
  echo "==> Running idempotent host setup scripts"
  ./infra/bootstrap-ec2.sh
  ./infra/install-nginx-config.sh
  ./infra/install-systemd-units.sh
else
  echo "==> SKIP_SETUP=1 set; skipping host setup scripts"
fi

echo "==> Installing/building public site dependencies"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build

echo "==> Publishing Astro static site to /var/www/alliance-site/dist"
sudo mkdir -p /var/www/alliance-site/dist
sudo rsync -a --delete dist/ /var/www/alliance-site/dist/
sudo chown -R www-data:www-data /var/www/alliance-site
sudo chmod -R 755 /var/www/alliance-site

echo "==> Installing backoffice production dependencies"
cd "$BACKOFFICE_DIR"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo "==> Ensuring runtime directories exist"
sudo mkdir -p /var/log/alliance /var/backups/alliance
sudo chown -R ubuntu:ubuntu /var/log/alliance /var/backups/alliance

echo "==> Starting/restarting PM2 app"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --only "$APP_NAME"
fi
pm2 save

echo "==> Reloading nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Validating local health endpoint"
curl -fsS http://localhost:3001/backoffice/health >/dev/null

echo "==> Deploy complete"
