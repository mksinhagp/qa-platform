# CI/CD Operations Runbook

**QA Automation Platform — Phase 10.3**

---

## Table of Contents

1. [Overview](#1-overview)
2. [GitHub Repository Secrets](#2-github-repository-secrets)
3. [Branch Strategy](#3-branch-strategy)
4. [Workflow Reference](#4-workflow-reference)
   - [CI (`ci.yml`)](#41-ci-workflow-ciyml)
   - [Staging Deployment (`deploy-staging.yml`)](#42-staging-deployment-deploy-stagingyml)
   - [Security Scan (`security-scan.yml`)](#43-security-scan-security-scanyml)
5. [Manual Deployment](#5-manual-deployment)
6. [Rollback Procedure](#6-rollback-procedure)
7. [Adding a New Environment](#7-adding-a-new-environment)
8. [Troubleshooting](#8-troubleshooting)
9. [Local Deployment with deploy.sh](#9-local-deployment-with-deploysh)

---

## 1. Overview

The platform has three automated workflows:

| Workflow | File | Triggers | Purpose |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | Push to `main`, all PRs | Lint, type-check, test, build, validate Docker images |
| Staging Deploy | `.github/workflows/deploy-staging.yml` | Push to `main`, manual | Deploy to staging server via SSH |
| Security Scan | `.github/workflows/security-scan.yml` | Weekly (Sun 02:00 UTC), push to `main`, manual | Dependency audit, Docker image CVE scan, secret detection |

**Pipeline order for main branch push:**

```
Push to main
    │
    ├─► CI workflow (lint → test/build → docker-build)
    │        └── all jobs must pass
    │
    └─► Staging Deploy workflow (runs in parallel with CI, has its own build gate)
             └── health-check must pass
```

---

## 2. GitHub Repository Secrets

Configure these in **Settings → Secrets and variables → Actions → Repository secrets**.

### CI Workflow Secrets

None required. CI uses ephemeral test credentials defined inline.

### Staging Deployment Secrets

| Secret name | Description |
|---|---|
| `STAGING_SSH_HOST` | Hostname or IP address of the staging server (e.g. `staging.example.com`) |
| `STAGING_SSH_USER` | Linux user account used for SSH (must have Docker access, e.g. `deploy`) |
| `STAGING_SSH_KEY` | Full private key content (PEM format) for SSH authentication. The corresponding public key must be in `~/.ssh/authorized_keys` on the staging server. |
| `STAGING_DEPLOY_PATH` | Absolute path to the project directory on the staging server (e.g. `/opt/qa-platform`) |
| `STAGING_DASHBOARD_SESSION_SECRET` | Long random secret (min 32 chars) used to sign dashboard sessions. Generate with: `openssl rand -hex 32` |
| `STAGING_POSTGRES_PASSWORD` | PostgreSQL password for the staging database. Written to `.env.staging` and forwarded to Docker Compose via `${POSTGRES_PASSWORD}`. |

### Security Scan Secrets

None required beyond standard GitHub token (SARIF upload uses the built-in `GITHUB_TOKEN`).

### GitHub Environment: `staging`

The `deploy-staging.yml` workflow targets the `staging` GitHub environment, which allows:
- Required reviewers before deployment (optional protection rule)
- Environment-scoped secrets (alternative to repo-level secrets)

Create the environment: **Settings → Environments → New environment → staging**

---

## 3. Branch Strategy

```
main ──────────── deployable; direct push only for hotfixes
  └── feature/*   all feature development; opened as PRs to main
  └── fix/*       bug fixes; opened as PRs to main
  └── chore/*     non-functional changes; opened as PRs to main
```

**Rules:**
- `main` is the single deployable branch. Every commit to `main` triggers a staging deployment.
- All changes must go through a pull request. CI must pass before merging.
- No long-lived feature branches. Keep PRs small and focused.
- Tag releases with semver (`v1.2.3`) for production deployments (not yet automated).

---

## 4. Workflow Reference

### 4.1 CI Workflow (`ci.yml`)

**Trigger:** Push to `main` OR any pull request.

**Jobs and dependencies:**

```
lint-and-typecheck
    ├── test          (needs: lint-and-typecheck)
    ├── build         (needs: lint-and-typecheck)
    └── docker-build  (needs: test, build)
```

**Job details:**

| Job | What it does | Artifacts |
|---|---|---|
| `lint-and-typecheck` | `pnpm run lint` (turbo), `pnpm run typecheck` (turbo) | None |
| `test` | Spins up `postgres:16-alpine` service, runs migrations, then `pnpm run test:coverage` | `coverage-report` (14 days) |
| `build` | `pnpm run build` (turbo) — compiles all packages and Next.js app | `build-artifacts` (7 days) |
| `docker-build` | Builds `docker/dashboard/Dockerfile` and `docker/runner/Dockerfile` with GHA cache. Does NOT push. | None |

**Caching strategy:**
- pnpm store: via `actions/setup-node` cache key on `pnpm-lock.yaml`
- Docker layers: GitHub Actions cache (`type=gha`) scoped by image name

---

### 4.2 Staging Deployment (`deploy-staging.yml`)

**Trigger:** Push to `main` (automatic after CI), or `workflow_dispatch` (manual).

**Steps in order:**

1. Checkout source
2. Build Docker images locally (using GHA layer cache)
3. Save images as `.tar.gz` tarballs
4. Copy tarballs to staging server via SCP (`appleboy/scp-action`)
5. SSH into staging (`appleboy/ssh-action`) and:
   - Load Docker images from tarballs
   - `git fetch` + `git reset --hard origin/main` (update source for compose files)
   - Write `.env.staging` with runtime secrets
   - `docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml up -d --remove-orphans`
   - `docker compose … run --rm migrator`
   - `docker image prune -f`
6. Health check: poll `http://<host>:3000/api/health` every 10s, up to 24 attempts (4 minutes)
7. Print deployment summary

**Concurrency:** Only one staging deployment runs at a time (`concurrency: deploy-staging`, `cancel-in-progress: false` — queues rather than cancels).

---

### 4.3 Security Scan (`security-scan.yml`)

**Trigger:** Every Sunday at 02:00 UTC, push to `main`, or `workflow_dispatch`.

**Jobs (run in parallel):**

| Job | Tool | Failure condition |
|---|---|---|
| `dependency-audit` | `pnpm audit --audit-level=high` | Any HIGH or CRITICAL CVE in dependencies |
| `docker-scan` | Trivy (`aquasecurity/trivy-action`) | Any HIGH or CRITICAL CVE in OS packages or libraries in Docker images |
| `secret-scan` | TruffleHog (`trufflesecurity/trufflehog-actions-scan`) | Any verified leaked secret detected |

Trivy scan results are also uploaded as SARIF to the **GitHub Security tab** (Code Scanning alerts).

---

## 5. Manual Deployment

### Trigger via GitHub UI

1. Go to **Actions → Deploy — Staging**
2. Click **Run workflow**
3. Optionally fill in the "Reason" field
4. Click **Run workflow**

The workflow runs immediately with the `main` branch HEAD.

### Trigger via GitHub CLI

```bash
gh workflow run deploy-staging.yml \
  --field reason="Hotfix for session bug"
```

### Monitor a running deployment

```bash
gh run list --workflow=deploy-staging.yml --limit=5
gh run watch <run-id>
```

---

## 6. Rollback Procedure

There is no automated rollback yet. Follow these steps manually.

### Identify the last good commit

```bash
# List recent deployments from GitHub Actions
gh run list --workflow=deploy-staging.yml --status=success --limit=5

# Get the SHA of the last successful deployment
GOOD_SHA=$(gh run list --workflow=deploy-staging.yml --status=success --limit=1 --json headSha -q '.[0].headSha')
echo "Last good SHA: ${GOOD_SHA}"
```

### Roll back on the staging server

SSH into the staging server and run:

```bash
cd /opt/qa-platform   # STAGING_DEPLOY_PATH

# Check out the last good commit
git fetch origin
git reset --hard <GOOD_SHA>

# Rebuild and redeploy that version
docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml \
  --env-file .env.staging build --parallel

docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml \
  --env-file .env.staging up -d --remove-orphans

# Run migrations (should be a no-op for a rollback to a previous schema)
docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml \
  --env-file .env.staging run --rm migrator
```

### Verify the rollback

```bash
curl -sf http://localhost:3000/api/health && echo "OK" || echo "FAILED"
```

### Database rollback

Schema migrations are forward-only. If the new schema is incompatible with the previous code:
1. Restore from the latest `pg_dump` backup taken before the deployment.
2. Contact Manish — database schema changes require explicit sign-off before rollback.

---

## 7. Adding a New Environment

Example: adding a `production` environment.

### Step 1 — Create the compose override

```bash
cp docker/docker-compose.staging.yml docker/docker-compose.production.yml
# Edit to match production-specific settings (ports, resource limits, secrets)
```

### Step 2 — Add GitHub secrets

In **Settings → Secrets → Actions**, add:
- `PRODUCTION_SSH_HOST`
- `PRODUCTION_SSH_USER`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_DEPLOY_PATH`
- `PRODUCTION_DASHBOARD_SESSION_SECRET`

### Step 3 — Create the workflow

Copy `.github/workflows/deploy-staging.yml` to `.github/workflows/deploy-production.yml`.

Change:
- Trigger branch (e.g. `release` or tag pattern `v*`)
- All `STAGING_*` secret references to `PRODUCTION_*`
- `environment: production`
- Concurrency group name: `deploy-production`

### Step 4 — Create the GitHub environment

**Settings → Environments → New environment → production**

Add a required reviewer protection rule so accidental pushes cannot auto-deploy to production.

### Step 5 — Update `scripts/deploy.sh`

The script already accepts `production` as an argument. Ensure `docker/docker-compose.production.yml` exists before running.

---

## 8. Troubleshooting

### Test failures in CI

**Symptom:** `test` job fails with connection errors to PostgreSQL.

**Checks:**
- The `postgres` service health check must pass before the test steps run. GitHub Actions waits for `--health-*` options — verify `options` block in `ci.yml`.
- Check that `DATABASE_URL` and individual `POSTGRES_*` env vars are consistent.
- If migration fails, check `packages/db/src/migrations.ts` for SQL errors.

```bash
# Reproduce locally
docker run -d --name pg-test -e POSTGRES_DB=qa_platform_test \
  -e POSTGRES_USER=qa_user -e POSTGRES_PASSWORD=qa_password_test \
  -p 5432:5432 postgres:16-alpine

export DATABASE_URL=postgresql://qa_user:qa_password_test@localhost:5432/qa_platform_test
pnpm --filter @qa-platform/db run migrate
pnpm run test:coverage
```

---

### Docker build failures in CI

**Symptom:** `docker-build` job fails with a build error.

**Checks:**
- Reproduce the build locally:
  ```bash
  docker build -f docker/dashboard/Dockerfile . --no-cache
  docker build -f docker/runner/Dockerfile . --no-cache
  ```
- Common causes:
  - `pnpm-lock.yaml` out of sync — run `pnpm install` locally and commit the updated lockfile.
  - Missing build output from a dependency — check that `pnpm run build` succeeds locally before the Docker build.
  - Next.js standalone output not generated — verify `output: 'standalone'` in `apps/dashboard-web/next.config.js`.

---

### Migration failures on staging

**Symptom:** `docker compose run --rm migrator` exits non-zero.

**Checks:**
1. SSH into staging and check migrator logs:
   ```bash
   docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml \
     logs migrator
   ```
2. Check if the database is reachable:
   ```bash
   docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml \
     exec postgres pg_isready -U qa_user -d qa_platform
   ```
3. If a migration is partially applied, inspect the migrations table:
   ```bash
   docker compose … exec postgres psql -U qa_user -d qa_platform \
     -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"
   ```
4. Never manually delete migration records without explicit approval.

---

### Health check timeout after deployment

**Symptom:** The health check step in `deploy-staging.yml` fails after 4 minutes.

**Checks:**
1. View dashboard logs on staging:
   ```bash
   docker compose -f docker-compose.yml -f docker/docker-compose.staging.yml \
     logs --tail=100 dashboard-web
   ```
2. Verify port 3000 is not blocked by a firewall rule.
3. Confirm `DASHBOARD_SESSION_SECRET` is set — the app will fail to start without it.
4. Check if the migration step completed successfully; the dashboard waits for `migrator` to finish.

---

### pnpm audit reports vulnerabilities

**Symptom:** `dependency-audit` job fails.

**Remediation:**
```bash
# See details locally
pnpm audit --audit-level=high

# Update affected packages
pnpm update <package-name>

# If no fix is available, add to .npmrc or pnpm audit's ignore list
# and document the exception with a comment
```

If a vulnerability cannot be immediately patched, create a GitHub issue, document the risk, and add an exemption comment in the workflow until resolved.

---

### TruffleHog detects a secret

**Symptom:** `secret-scan` job fails.

**Immediate actions:**
1. **Rotate the secret immediately** — assume it is compromised.
2. Identify the commit: check the TruffleHog output in the job log for the file and line.
3. Remove the secret from git history using `git filter-repo` (do NOT use `git rebase` — it leaves refs).
4. Force-push the cleaned history (coordinate with team).
5. Add the file/pattern to `.trufflehogignore` only after confirming the secret is fully rotated and the false positive is verified.

---

## 9. Local Deployment with deploy.sh

The `scripts/deploy.sh` helper runs the same compose orchestration as the GitHub Actions workflow.

```bash
# Export required secrets
export DASHBOARD_SESSION_SECRET="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="your-secure-password"

# Deploy to staging (from project root)
./scripts/deploy.sh staging

# Show help
./scripts/deploy.sh -h
```

**Optional overrides:**

| Variable | Default | Description |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `qa-platform` | Docker Compose project name |
| `HEALTH_CHECK_URL` | `http://localhost:3000/api/health` | URL polled during health check |
| `HEALTH_RETRIES` | `24` | Number of health check attempts |
| `HEALTH_INTERVAL` | `10` | Seconds between health check attempts |
| `DASHBOARD_PORT` | `3000` | Used to build the default health check URL |
