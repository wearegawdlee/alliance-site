#!/usr/bin/env bash

set -euo pipefail

echo "==> Updating apt cache"
sudo apt update

echo "==> Installing base packages"
sudo apt install -y \
  curl \
  unzip \
  git \
  nginx \
  postgresql-client \
  build-essential

echo "==> Installing Node LTS"

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "==> Installing PM2"

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> Installing AWS CLI"

if ! command -v aws >/dev/null 2>&1; then
  cd /tmp

  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" \
    -o "awscliv2.zip"

  unzip -o awscliv2.zip

  sudo ./aws/install
fi

echo "==> Creating runtime directories"

sudo mkdir -p /var/backups/alliance
sudo mkdir -p /var/log/alliance

echo "==> Setting permissions"

sudo chown -R ubuntu:ubuntu /var/backups/alliance
sudo chown -R ubuntu:ubuntu /var/log/alliance

echo "==> Restarting nginx"

sudo systemctl enable nginx
sudo systemctl restart nginx

echo "==> Versions"

node --version
npm --version
pm2 --version
aws --version

echo "==> Bootstrap complete"
