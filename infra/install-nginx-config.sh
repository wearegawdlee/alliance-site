#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/repos/alliance-site}"
NGINX_TEMPLATE="${REPO_DIR}/infra/nginx/alliance-site.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/alliance-site.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/alliance-site.conf"

if [[ ! -f "$NGINX_TEMPLATE" ]]; then
  echo "Missing nginx template: $NGINX_TEMPLATE" >&2
  exit 1
fi

echo "==> Installing nginx site config"
sudo cp "$NGINX_TEMPLATE" "$NGINX_AVAILABLE"
sudo ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"

# Keep this script idempotent on a fresh Ubuntu host or an existing host.
# The packaged Alliance config intentionally does NOT claim default_server,
# but Ubuntu's default site may. Disable it so the public site is served by
# the Alliance server block and so repeated installs do not hit duplicate
# default_server failures.
echo "==> Disabling Ubuntu default nginx site if present"
sudo rm -f /etc/nginx/sites-enabled/default

# Remove stale duplicate Alliance symlinks from previous/manual attempts.
# Leave the canonical enabled path created above.
for enabled_file in /etc/nginx/sites-enabled/alliance-site /etc/nginx/conf.d/alliance-site.conf; do
  if [[ -e "$enabled_file" || -L "$enabled_file" ]]; then
    echo "==> Removing stale nginx config: $enabled_file"
    sudo rm -f "$enabled_file"
  fi
done

echo "==> Creating web root"
sudo mkdir -p /var/www/alliance-site/dist
sudo chown -R www-data:www-data /var/www/alliance-site
sudo chmod -R 755 /var/www/alliance-site

echo "==> Testing nginx config"
sudo nginx -t

echo "==> Enabling/reloading nginx"
sudo systemctl enable nginx
sudo systemctl reload nginx || sudo systemctl restart nginx

echo "==> Nginx config installed"
