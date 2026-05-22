#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_DIR="${SCRIPT_DIR}/systemd"

sudo cp "${UNIT_DIR}/alliance-db-backup.service" /etc/systemd/system/alliance-db-backup.service
sudo cp "${UNIT_DIR}/alliance-db-backup.timer" /etc/systemd/system/alliance-db-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now alliance-db-backup.timer
sudo systemctl list-timers --all | grep alliance || true

echo "Installed alliance-db-backup.service and alliance-db-backup.timer"
