#!/usr/bin/env bash
# =============================================================================
# scripts/install-backup-launchd.sh — install macOS launchd backup agent
#
# Usage:
#   ./scripts/install-backup-launchd.sh
#
# Installs docker/postgres/com.qa-platform.backup.plist into the current user's
# ~/Library/LaunchAgents directory after replacing the placeholder
# WorkingDirectory with this repository's absolute path.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_PLIST="${PROJECT_ROOT}/docker/postgres/com.qa-platform.backup.plist"
TARGET_DIR="${HOME}/Library/LaunchAgents"
TARGET_PLIST="${TARGET_DIR}/com.qa-platform.backup.plist"

if [[ ! -f "${SOURCE_PLIST}" ]]; then
  echo "[ERROR] Source plist not found: ${SOURCE_PLIST}" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"

if launchctl list com.qa-platform.backup >/dev/null 2>&1; then
  launchctl unload "${TARGET_PLIST}" >/dev/null 2>&1 || true
fi

sed "s#/path/to/WebsiteTester#${PROJECT_ROOT//\/\\}#g" "${SOURCE_PLIST}" > "${TARGET_PLIST}"
chmod 644 "${TARGET_PLIST}"
launchctl load "${TARGET_PLIST}"

echo "[OK] Installed launchd backup agent: ${TARGET_PLIST}"
echo "[OK] WorkingDirectory: ${PROJECT_ROOT}"
echo "[INFO] Manual trigger: launchctl start com.qa-platform.backup"
