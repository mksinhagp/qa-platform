#!/usr/bin/env bash
# =============================================================================
# restore.sh — QA Automation Platform PostgreSQL Restore Script
#
# Restores a PostgreSQL database from a custom-format pg_dump backup file
# created by backup.sh.  Uses pg_restore --clean --if-exists to safely
# drop and recreate objects before restoring data.
#
# Usage:
#   ./restore.sh <path-to-backup-file>
#   RESTORE_FILE=/backups/qa_platform_20260101_020000.dump ./restore.sh
#
# Arguments:
#   $1   Path to the .dump backup file (overridden by RESTORE_FILE env var)
#
# Environment variables (all optional — defaults shown):
#   RESTORE_FILE             Backup file path (alternative to $1)
#   POSTGRES_HOST            Hostname of PostgreSQL server (default: localhost)
#   POSTGRES_PORT            Port of PostgreSQL server    (default: 5432)
#   POSTGRES_DB              Database name               (default: qa_platform)
#   POSTGRES_USER            Database user               (default: qa_user)
#   POSTGRES_PASSWORD        Database password           (required)
#   RESTORE_FORCE            Skip confirmation prompt     (default: false)
#                            Set to "true" to bypass interactive confirmation.
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
RESTORE_FORCE="${RESTORE_FORCE:-false}"

# ---------------------------------------------------------------------------
# Resolve backup file: argument $1 takes precedence over RESTORE_FILE env var
# ---------------------------------------------------------------------------
BACKUP_FILE="${1:-${RESTORE_FILE:-}}"

if [[ -z "${BACKUP_FILE}" ]]; then
  log_error "No backup file specified."
  log_error "Usage: $0 <path-to-backup-file>"
  log_error "       or set RESTORE_FILE env var."
  exit 1
fi

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
# Validate backup file exists and is readable
# ---------------------------------------------------------------------------
if [[ ! -f "${BACKUP_FILE}" ]]; then
  log_error "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

if [[ ! -r "${BACKUP_FILE}" ]]; then
  log_error "Backup file is not readable: ${BACKUP_FILE}"
  exit 1
fi

BACKUP_SIZE_BYTES=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null || echo "unknown")

# ---------------------------------------------------------------------------
# Pre-flight integrity check on the backup file
# ---------------------------------------------------------------------------
log_info "Verifying backup file integrity with pg_restore --list..."
if ! pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1; then
  log_error "Backup file failed integrity check — pg_restore --list reported errors."
  log_error "The backup file may be corrupt or not in custom format: ${BACKUP_FILE}"
  exit 1
fi
log_info "Backup file integrity OK."

# ---------------------------------------------------------------------------
# Display restore plan and prompt for confirmation (unless RESTORE_FORCE=true)
# ---------------------------------------------------------------------------
log_info "======================================================"
log_info "RESTORE PLAN"
log_info "  Backup file : ${BACKUP_FILE}"
log_info "  File size   : ${BACKUP_SIZE_BYTES} bytes"
log_info "  Target DB   : ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "  User        : ${POSTGRES_USER}"
log_info "  Strategy    : pg_restore --clean --if-exists (drops + recreates objects)"
log_info "======================================================"
log_warn "WARNING: This will DROP and RECREATE all objects in '${POSTGRES_DB}'."
log_warn "         All existing data will be replaced by the backup contents."

if [[ "${RESTORE_FORCE}" != "true" ]]; then
  # Only prompt if stdin is a terminal; in non-interactive pipelines, abort.
  if [[ -t 0 ]]; then
    echo ""
    read -rp "Type 'yes' to confirm restore, anything else to abort: " CONFIRM
    if [[ "${CONFIRM}" != "yes" ]]; then
      log_info "Restore aborted by user."
      exit 0
    fi
  else
    log_error "Running in non-interactive mode but RESTORE_FORCE is not 'true'."
    log_error "Set RESTORE_FORCE=true to bypass confirmation in automated pipelines."
    exit 1
  fi
else
  log_info "RESTORE_FORCE=true — skipping confirmation prompt."
fi

# ---------------------------------------------------------------------------
# Verify connectivity before attempting restore
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
# Run pg_restore
#   --clean        : Drop objects before recreating (avoids conflicts)
#   --if-exists    : Use IF EXISTS on DROP statements (no error if missing)
#   --no-owner     : Do not restore object ownership (use connecting user)
#   --no-privileges: Do not restore ACLs (apply fresh from current roles)
#   --exit-on-error: Abort on first error during restore
# ---------------------------------------------------------------------------
log_info "Starting pg_restore..."
if ! pg_restore \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    --no-password \
    --verbose \
    "${BACKUP_FILE}" 2>&1 | while IFS= read -r line; do
      log_info "[pg_restore] ${line}"
    done; then
  # pg_restore exits non-zero; the pipe masks the exit code — capture it below
  log_error "pg_restore encountered errors. Check output above."
  exit 1
fi

# ---------------------------------------------------------------------------
# Post-restore connectivity sanity check
# ---------------------------------------------------------------------------
log_info "Running post-restore sanity check..."
ROW_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    --host="${POSTGRES_HOST}" \
    --port="${POSTGRES_PORT}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --tuples-only \
    --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d '[:space:]') || ROW_COUNT="unknown"

log_info "Post-restore check: ${ROW_COUNT} table(s) found in public schema."

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info "======================================================"
log_info "Restore completed successfully."
log_info "  Source file : ${BACKUP_FILE}"
log_info "  Target DB   : ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"
log_info "  Public tables restored: ${ROW_COUNT}"
log_info "======================================================"

exit 0
