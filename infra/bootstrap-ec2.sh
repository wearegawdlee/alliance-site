#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-ubuntu}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Updating apt cache"
sudo apt update

echo "==> Installing base packages"
sudo apt install -y \
  ca-certificates \
  curl \
  unzip \
  git \
  rsync \
  nginx \
  postgresql \
  postgresql-client \
  build-essential

echo "==> Installing Node.js ${NODE_MAJOR}.x if needed"
if ! command -v node >/dev/null 2>&1 || ! node --version | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "==> Installing PM2 if needed"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> Installing AWS CLI v2 if needed"
if ! command -v aws >/dev/null 2>&1; then
  tmpdir="$(mktemp -d)"
  pushd "$tmpdir" >/dev/null
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip -q awscliv2.zip
  sudo ./aws/install
  popd >/dev/null
  rm -rf "$tmpdir"
fi

echo "==> Creating runtime directories"
sudo mkdir -p /var/backups/alliance /var/log/alliance /var/www/alliance-site/dist
sudo chown -R "${APP_USER}:${APP_USER}" /var/backups/alliance /var/log/alliance
sudo chmod 750 /var/backups/alliance /var/log/alliance
sudo chown -R www-data:www-data /var/www/alliance-site
sudo chmod -R 755 /var/www/alliance-site

echo "==> Enabling nginx without restart; config install handles reload"
sudo systemctl enable nginx

echo "==> Versions"
node --version
npm --version
pm2 --version
aws --version
psql --version

echo "==> Bootstrap complete"
