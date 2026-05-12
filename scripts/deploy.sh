#!/usr/bin/env bash
# =============================================================================
# scripts/deploy.sh — QA Automation Platform deployment helper
#
# Usage:
#   ./scripts/deploy.sh <environment>   Deploy to staging or production
#   ./scripts/deploy.sh -h              Show this help message
#
# Supported environments:
#   staging     Uses docker-compose.yml + docker/docker-compose.staging.yml
#   production  Uses docker-compose.yml + docker/docker-compose.production.yml
#               (production compose file must exist before running)
#
# Required environment variables:
#   DASHBOARD_SESSION_SECRET   Long random secret for session signing
#   POSTGRES_PASSWORD          PostgreSQL password
#
# Optional environment variables:
#   COMPOSE_PROJECT_NAME       Docker Compose project name (default: qa-platform)
#   HEALTH_CHECK_URL           Full URL for health check (auto-derived if not set)
#   HEALTH_RETRIES             Number of health-check attempts (default: 24)
#   HEALTH_INTERVAL            Seconds between attempts (default: 10)
# =============================================================================

set -euo pipefail

# ── Colour output helpers ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# ── Help ─────────────────────────────────────────────────────────────────────
usage() {
  grep '^#' "$0" | sed 's/^# \{0,\}//' | sed 's/^#//'
  exit 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

# ── Argument validation ───────────────────────────────────────────────────────
ENV="${1:-}"

if [[ -z "${ENV}" ]]; then
  error "No environment specified."
  echo ""
  echo "Usage: $0 <staging|production>"
  exit 1
fi

if [[ "${ENV}" != "staging" && "${ENV}" != "production" ]]; then
  error "Unknown environment '${ENV}'. Must be 'staging' or 'production'."
  echo ""
  echo "Usage: $0 <staging|production>"
  exit 1
fi

# ── Resolve project root (script lives in <root>/scripts/) ───────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

info "Project root: ${PROJECT_ROOT}"
info "Target environment: ${ENV}"

# ── Resolve compose file set ──────────────────────────────────────────────────
BASE_COMPOSE="docker-compose.yml"

case "${ENV}" in
  staging)
    OVERRIDE_COMPOSE="docker/docker-compose.staging.yml"
    DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
    ;;
  production)
    OVERRIDE_COMPOSE="docker/docker-compose.production.yml"
    DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
    ;;
esac

# Verify compose override exists
if [[ ! -f "${OVERRIDE_COMPOSE}" ]]; then
  error "Compose override file not found: ${OVERRIDE_COMPOSE}"
  exit 1
fi

COMPOSE_FILES="-f ${BASE_COMPOSE} -f ${OVERRIDE_COMPOSE}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-qa-platform}"

# ── Validate required secrets are present ────────────────────────────────────
MISSING=0
for var in DASHBOARD_SESSION_SECRET POSTGRES_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    error "Required environment variable '${var}' is not set."
    MISSING=1
  fi
done

if [[ "${MISSING}" -eq 1 ]]; then
  echo ""
  echo "Export the missing variables and re-run:"
  echo "  export DASHBOARD_SESSION_SECRET='<value>'"
  echo "  export POSTGRES_PASSWORD='<value>'"
  exit 1
fi

# ── Check dependencies ────────────────────────────────────────────────────────
for cmd in docker curl; do
  if ! command -v "${cmd}" &>/dev/null; then
    error "'${cmd}' is not installed or not in PATH."
    exit 1
  fi
done

# Require Docker Compose v2 (plugin form)
if ! docker compose version &>/dev/null; then
  error "Docker Compose v2 plugin is required ('docker compose' not available)."
  exit 1
fi

# ── Step 1: Pull / build images ───────────────────────────────────────────────
info "Building Docker images for ${ENV}..."
docker compose ${COMPOSE_FILES} \
  -p "${COMPOSE_PROJECT}" \
  build --parallel

success "Docker images built."

# ── Step 2: Bring up services ─────────────────────────────────────────────────
info "Starting services (${ENV})..."
docker compose ${COMPOSE_FILES} \
  -p "${COMPOSE_PROJECT}" \
  up -d --remove-orphans

success "Services started."

# ── Step 3: Run database migrations ──────────────────────────────────────────
info "Running database migrations..."
docker compose ${COMPOSE_FILES} \
  -p "${COMPOSE_PROJECT}" \
  run --rm migrator

success "Migrations complete."

# ── Step 4: Health check ──────────────────────────────────────────────────────
HEALTH_URL="${HEALTH_CHECK_URL:-http://localhost:${DASHBOARD_PORT}/api/health}"
RETRIES="${HEALTH_RETRIES:-24}"
INTERVAL="${HEALTH_INTERVAL:-10}"

info "Health check: ${HEALTH_URL} (up to ${RETRIES} attempts, ${INTERVAL}s apart)"

attempt=1
while [[ "${attempt}" -le "${RETRIES}" ]]; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || true)
  if [[ "${HTTP_STATUS}" == "200" ]]; then
    success "Health check passed on attempt ${attempt}."
    break
  fi
  warn "Attempt ${attempt}/${RETRIES} — HTTP ${HTTP_STATUS}. Retrying in ${INTERVAL}s..."
  sleep "${INTERVAL}"
  attempt=$((attempt + 1))
done

if [[ "${attempt}" -gt "${RETRIES}" ]]; then
  error "Health check failed after $((RETRIES * INTERVAL)) seconds."
  echo ""
  echo "Troubleshooting tips:"
  echo "  docker compose ${COMPOSE_FILES} -p ${COMPOSE_PROJECT} logs dashboard-web"
  exit 1
fi

# ── Step 5: Status summary ────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Deployment to ${ENV} succeeded."
echo "  Environment : ${ENV}"
echo "  Dashboard   : ${HEALTH_URL%/api/health}"
echo "  Time        : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""
echo "Running containers:"
docker compose ${COMPOSE_FILES} \
  -p "${COMPOSE_PROJECT}" \
  ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
