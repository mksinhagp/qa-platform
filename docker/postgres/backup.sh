#!/usr/bin/env bash
# =============================================================================
# backup.sh — QA Automation Platform PostgreSQL Backup Script
#
# Creates a compressed pg_dump backup (custom format), applies retention
# policy, and verifies backup integrity via pg_restore --list.
#
# Usage:
#   ./backup.sh
#
# Environment variables (all optional — defaults shown):
#   POSTGRES_HOST            Hostname of PostgreSQL server (default: localhost)
#   POSTGRES_PORT            Port of PostgreSQL server    (default: 5432)
#   POSTGRES_DB              Database name               (default: qa_platform)
#   POSTGRES_USER            Database user               (default: qa_user)
#   POSTGRES_PASSWORD        Database password           (required)
#   BACKUP_DIR               Directory to write backups  (default: /backups)
#   BACKUP_RETENTION_DAYS    Days to retain backups      (default: 30)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Structured logging helpers
# ---------------------------------------------------------------------------
log() {
  local level="$1"
  shift
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [${level}] $*"
}

log_info()  { log "INFO " "$@"; }
log_warn()  { log "WARN " "$@"; }
log_error() { log "ERROR" "$@" >&2; }

# ---------------------------------------------------------------------------
# Configuration — env vars with defaults
# ---------------------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-qa_platform}"
POSTGRES_USER="${POSTGRES_USER:-qa_user}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# ---------------------------------------------------------------------------
# Validate required env vars
# ---------------------------------------------------------------------------
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  log_error "POSTGRES_PASSWORD is not set. Aborting."
  exit 1
fi

# Export password so pg tools pick it up without a prompt
export PGPASSWORD="${POSTGRES_PASSWORD}"

# ---------------------------------------------------------------------------
# Ensure backup directory exists
# ---------------------------------------------------------------------------
if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_info "Backup directory '${BACKUP_DIR}' does not exist — creating it."
  mkdir -p "${BACKUP_DIR}" || {
    log_error "Failed to create backup directory '${BACKUP_DIR}'."
    exit 1
  }
fi

# ---------------------------------------------------------------------------
# Check available disk space (warn if < 500 MB free)
# ---------------------------------------------------------------------------
FREE_KB=$(df -k "${BACKUP_DIR}" | awk 'NR==2 {print $4}')
FREE_MB=$(( FREE_KB / 1024 ))
if (( FREE_MB < 500 )); then
  log_warn "Low disk space: only ${FREE_MB} MB available in '${BACKUP_DIR}'. Proceeding anyway."
fi

# ---------------------------------------------------------------------------
# Generate backup filename with timestamp
# ---------------------------------------------------------------------------
TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.dump"

log_info "Starting backup of database '${POSTGRES_DB}' on ${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "Backup target: ${BACKUP_FILE}"

# ---------------------------------------------------------------------------
# Verify connectivity before attempting backup
# ---------------------------------------------------------------------------
log_info "Verifying database connectivity..."
if ! pg_isready \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --quiet; then
  log_error "Cannot reach PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}. Aborting."
  exit 1
fi
log_info "Database connectivity verified."

# ---------------------------------------------------------------------------
# Run pg_dump (custom format = compressed, supports selective restore)
# ---------------------------------------------------------------------------
log_info "Running pg_dump (custom format, compression level 9)..."
if ! pg_dump \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --format=custom \
    --compress=9 \
    --no-password \
    --file="${BACKUP_FILE}"; then
  log_error "pg_dump failed. Removing incomplete backup file if it exists."
  rm -f "${BACKUP_FILE}"
  exit 1
fi

BACKUP_SIZE_BYTES=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null || echo "unknown")
log_info "pg_dump completed successfully. Backup size: ${BACKUP_SIZE_BYTES} bytes."

# ---------------------------------------------------------------------------
# Verify backup integrity using pg_restore --list (dry run — no DB write)
# ---------------------------------------------------------------------------
log_info "Verifying backup integrity with pg_restore --list..."
if ! pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1; then
  log_error "Backup integrity check failed — pg_restore --list reported errors."
  log_error "The backup file may be corrupt: ${BACKUP_FILE}"
  exit 1
fi
log_info "Backup integrity verified. File is valid."

# ---------------------------------------------------------------------------
# Retention policy — remove backups older than BACKUP_RETENTION_DAYS
# ---------------------------------------------------------------------------
log_info "Applying retention policy: removing backups older than ${BACKUP_RETENTION_DAYS} days..."

DELETED_COUNT=0
while IFS= read -r -d '' old_file; do
  log_info "Deleting expired backup: ${old_file}"
  rm -f "${old_file}"
  (( DELETED_COUNT++ )) || true
done < <(find "${BACKUP_DIR}" \
    -maxdepth 1 \
    -name "${POSTGRES_DB}_*.dump" \
    -mtime "+${BACKUP_RETENTION_DAYS}" \
    -print0 2>/dev/null)

if (( DELETED_COUNT > 0 )); then
  log_info "Retention cleanup complete: ${DELETED_COUNT} expired backup(s) removed."
else
  log_info "Retention cleanup: no expired backups found."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info "======================================================"
log_info "Backup completed successfully."
log_info "  File    : ${BACKUP_FILE}"
log_info "  Size    : ${BACKUP_SIZE_BYTES} bytes"
log_info "  Database: ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "  Retained: last ${BACKUP_RETENTION_DAYS} days"
log_info "======================================================"

exit 0
