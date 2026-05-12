# Disaster Recovery Runbook

**QA Automation Platform — Phase 11.4**  
**Owner:** Platform / DevOps  
**Last Updated:** 2026-07  
**Audience:** Manish Sinha. Assumes full familiarity with the stack, Docker Desktop on macOS, and the project repository layout.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Full Host Machine Loss — Fresh Machine Rebuild](#2-full-host-machine-loss--fresh-machine-rebuild)
3. [PostgreSQL Data Corruption or Accidental Deletion](#3-postgresql-data-corruption-or-accidental-deletion)
4. [Single Container Failure Recovery](#4-single-container-failure-recovery)
5. [Named Volume Recovery](#5-named-volume-recovery)
6. [Vault Master Password Loss](#6-vault-master-password-loss)
7. [Backup Failure or Gap in Backup History](#7-backup-failure-or-gap-in-backup-history)
8. [Corruption vs. Loss Decision Tree](#8-corruption-vs-loss-decision-tree)
9. [Recovery Time and Recovery Point Objectives](#9-recovery-time-and-recovery-point-objectives)
10. [Pre-Disaster Readiness Checklist](#10-pre-disaster-readiness-checklist)

---

## 1. Overview

This runbook covers the recovery procedures for every major failure mode of the QA Automation Platform. It is written for use under stress — read only the section that applies to your incident.

### Platform Summary

| Component | Service Name | Port | Notes |
|---|---|---|---|
| Next.js 14 dashboard | `dashboard-web` | 3000 | App Router; requires `DASHBOARD_SESSION_SECRET` |
| Playwright runner | `runner` | 4000 | Executes test runs against booking/registration sites |
| PostgreSQL 16 | `postgres` | 5432 (5434 on host) | All application state; `pg_data` named volume |
| Backup service | `backup` (profile: `backup`) | — | Invoked on demand or via launchd; writes to `backups` volume |
| Ollama LLM | `ollama` (profile: `llm`) | 11434 | Optional; models in `ollama_models` volume |

### Named Volumes

| Volume | Docker Compose Name | Contents | Criticality |
|---|---|---|---|
| `pg_data` | `websitetester_pg_data` | All database data | **Critical** — loss = full data loss |
| `backups` | `websitetester_backups` | PostgreSQL dump files | **High** — loss = no restore point unless off-volume copies exist |
| `ollama_models` | `websitetester_ollama_models` | Downloaded LLM model weights | **Low** — safe to lose; re-pull from Ollama hub |

### Backup System at a Glance

| Item | Value |
|---|---|
| Backup script | `docker/postgres/backup.sh` |
| Restore script | `docker/postgres/restore.sh` |
| Dump format | PostgreSQL custom format (`.dump`), compression level 9 |
| Naming | `qa_platform_YYYYMMDD_HHMMSS.dump` |
| Backup location (in container) | `/backups` → Docker volume `websitetester_backups` |
| Scheduled trigger | macOS launchd daily at 02:00 AM; log at `/tmp/qa-platform-backup.log` |
| Retention | `BACKUP_RETENTION_DAYS` (default: 30 days) |
| Integrity check | `pg_restore --list` dry-run after every backup |

### Cross-References

- Backup scheduling details: `docs/runbooks/backup-cron.md`
- Vault emergency recovery: `docs/runbooks/vault-runbook.md` Section 7
- Container-level troubleshooting: `docs/runbooks/troubleshooting.md`
- CI/CD and deployment: `docs/runbooks/cicd-runbook.md`
- Security pre-production gates: `docs/decisions/006-security-review.md`

---

## 2. Full Host Machine Loss — Fresh Machine Rebuild

**Scenario:** The development or production Mac is lost, stolen, destroyed, or replaced. The repository exists on GitHub. The backup files exist somewhere off the lost machine (external drive, NAS, or cloud copy).

**Prerequisites before starting:**

- Docker Desktop downloaded and ready to install
- Git configured with SSH key or credential for the GitHub repository
- The backup `.dump` file(s) accessible on an external drive or network location
- The vault master password known and available
- The `.env` file contents documented securely (not in the repo)

---

### Step 1 — Install Docker Desktop

Download and install Docker Desktop for Mac from `https://www.docker.com/products/docker-desktop`. After installation:

```bash
# Confirm Docker is running
docker info
docker compose version
```

Allocate sufficient resources in Docker Desktop → Settings → Resources. Recommended minimums: 4 CPU, 8 GB RAM, 40 GB disk image size.

---

### Step 2 — Clone the Repository

```bash
git clone git@github.com:<org>/WebsiteTester.git
cd WebsiteTester
```

---

### Step 3 — Restore Environment Configuration

The `.env` file is not committed to the repository. Recreate it from your secure documentation (password manager, secure notes, encrypted backup):

```bash
# At minimum, the following variables are required:
cat > .env <<'EOF'
POSTGRES_USER=qa_user
POSTGRES_PASSWORD=<your-db-password>
POSTGRES_DB=qa_platform
DASHBOARD_SESSION_SECRET=<your-32-char-secret>
# Add any additional site-specific or optional variables
EOF
```

Do not commit `.env` to the repository.

---

### Step 4 — Restore Backup Volume Data

Get the backup file(s) from the external drive, NAS, or cloud copy onto the new machine:

```bash
# Example: copy from external drive
cp /Volumes/BackupDrive/qa-platform-backups/qa_platform_20260601_020000.dump \
   /tmp/qa_platform_20260601_020000.dump
```

Verify the file integrity before proceeding:

```bash
docker run --rm \
  -v /tmp:/backups \
  postgres:16-alpine \
  pg_restore --list /backups/qa_platform_20260601_020000.dump
```

A valid dump prints a table of contents. Any error or empty output means the file is corrupt — find an earlier backup.

---

### Step 5 — Start Postgres and Run Migrations

Bring up only Postgres first, then run the migrator to establish a fresh schema:

```bash
# Start Postgres
docker compose up -d postgres

# Wait for Postgres to become healthy (watch until status = healthy)
docker compose ps postgres

# Run migrations against the clean database
docker compose up migrator
docker compose logs -f migrator
# Wait for exit code 0 — "Migrations complete" in output
```

---

### Step 6 — Restore the Database from Backup

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434          # host-mapped port from docker-compose.override.yml
export POSTGRES_DB=qa_platform
export POSTGRES_USER=qa_user
export POSTGRES_PASSWORD=<your-db-password>

./docker/postgres/restore.sh /tmp/qa_platform_20260601_020000.dump
```

The script will:
1. Validate the file exists and is readable
2. Run `pg_restore --list` integrity check
3. Print a restore plan and prompt `Type 'yes' to confirm restore`
4. Verify connectivity to Postgres
5. Execute `pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error`
6. Run a post-restore table count sanity check

After restore completes, verify the count output: "Post-restore check: N table(s) found in public schema." A healthy restore shows 30+ tables.

---

### Step 7 — Rebuild and Start All Containers

```bash
docker compose up -d
docker compose logs -f
```

Watch for all services to reach "healthy" or "running" status:

```bash
docker compose ps
```

---

### Step 8 — Re-install Backup Scheduling

```bash
# Copy the launchd plist and load it
cp docker/postgres/com.qa-platform.backup.plist \
   ~/Library/LaunchAgents/com.qa-platform.backup.plist

# Confirm WorkingDirectory in the plist matches your new checkout path
# Edit if necessary:
open ~/Library/LaunchAgents/com.qa-platform.backup.plist

# Load the agent
launchctl load ~/Library/LaunchAgents/com.qa-platform.backup.plist

# Verify
launchctl list | grep com.qa-platform.backup

# Run an immediate backup to confirm the new machine works end-to-end
launchctl start com.qa-platform.backup
sleep 10
tail -50 /tmp/qa-platform-backup.log
```

---

### Step 9 — Unlock the Vault and Re-enter Credentials

Open the dashboard at `http://localhost:3000`, log in, and unlock the vault with the master password. All encrypted secrets were restored from the backup (vault state is stored in the `vault_state` table). You do not need to re-bootstrap unless the master password is lost.

If the master password is lost, proceed to Section 6.

---

### Step 10 — Post-Rebuild Verification

```bash
# Confirm all containers are healthy
docker compose ps

# Check dashboard health endpoint
curl -sf http://localhost:3000/api/health

# Spot-check the database
docker exec qa-platform-postgres psql -U qa_user -d qa_platform \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

# Confirm backup volume is populated
docker run --rm -v websitetester_backups:/backups alpine ls -lh /backups
```

---

## 3. PostgreSQL Data Corruption or Accidental Deletion

**Scenario:** Data is missing or corrupted in the running database. This could be caused by a bad migration, accidental row deletion, index corruption, or a Postgres crash during a write.

---

### Step 1 — Identify and Confirm the Problem

**Symptoms:**

- Application returns 500 errors with database-related messages
- Missing rows in key tables (e.g., `sites`, `operators`, `test_runs`)
- Postgres logs show `invalid page` errors or checksum failures
- Migration runner reports unexpected schema state

**Confirm with targeted queries:**

```bash
# Connect to postgres
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform

# Check table counts for key tables
SELECT 'sites' AS tbl, count(*) FROM sites
UNION ALL SELECT 'operators', count(*) FROM operators
UNION ALL SELECT 'test_runs', count(*) FROM test_runs
UNION ALL SELECT 'secret_records', count(*) FROM secret_records;

# Check for Postgres errors in container logs
docker compose logs --tail=200 postgres | grep -i "ERROR\|FATAL\|PANIC\|corrupt\|invalid"
```

If data is clearly wrong or tables are empty when they should not be, proceed with restore.

---

### Step 2 — Stop the Application Stack Safely

Stop all services except Postgres so no further writes corrupt the state further. Do not stop Postgres until you have identified the backup file to use.

```bash
# Stop dashboard and runner but keep Postgres accessible
docker compose stop dashboard-web runner

# Optionally: take a snapshot of current broken state for forensics
docker run --rm \
  -v websitetester_pg_data:/pg_data \
  alpine \
  tar -czf /dev/stdout /pg_data > /tmp/pg_data_broken_$(date +%Y%m%d_%H%M%S).tar.gz
```

---

### Step 3 — Identify the Right Backup File

```bash
# List backup files (most recent first)
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  ls -lht /backups
```

Example output:
```
-rw-r--r--  1  root  root  24.3M  Jun  3  02:00  qa_platform_20260603_020000.dump
-rw-r--r--  1  root  root  24.1M  Jun  2  02:00  qa_platform_20260602_020000.dump
-rw-r--r--  1  root  root  23.9M  Jun  1  02:00  qa_platform_20260601_020000.dump
```

Select the most recent backup that predates the data corruption event. If you are unsure when corruption occurred, start with the most recent backup, inspect it, and work backward.

**Verify the chosen backup file integrity:**

```bash
docker run --rm \
  -v websitetester_backups:/backups \
  postgres:16-alpine \
  pg_restore --list /backups/qa_platform_20260603_020000.dump
```

A valid file prints a TOC. If this fails, try the next older backup.

---

### Step 4 — Copy the Backup to the Host

`restore.sh` runs on the host and needs a locally accessible file path:

```bash
docker run --rm \
  -v websitetester_backups:/backups \
  -v "$(pwd)":/host \
  alpine \
  cp /backups/qa_platform_20260603_020000.dump /host/qa_platform_restore.dump
```

---

### Step 5 — Stop Postgres and Bring It Back Up Clean

```bash
docker compose down
docker compose up -d postgres

# Wait for healthy status
docker compose ps postgres
```

---

### Step 6 — Run the Restore

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434
export POSTGRES_DB=qa_platform
export POSTGRES_USER=qa_user
export POSTGRES_PASSWORD=<your-db-password>

./docker/postgres/restore.sh ./qa_platform_restore.dump
```

Type `yes` at the confirmation prompt. Watch the output for any `[ERROR]` lines. A successful restore ends with:

```
[INFO ] Restore completed successfully.
[INFO ]   Public tables restored: <N>
```

---

### Step 7 — Validate Post-Restore State

```bash
# Connect and spot-check key tables
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform

-- Table count sanity
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Verify critical tables have data
SELECT count(*) FROM sites;
SELECT count(*) FROM operators;
SELECT count(*) FROM vault_state;

-- Spot check a known row (example — use a site slug you know exists)
SELECT id, name, base_url FROM sites LIMIT 5;
```

If counts look correct and known rows are present, the restore is good.

---

### Step 8 — Restart the Full Stack

```bash
docker compose up -d
docker compose logs -f
```

Unlock the vault at `http://localhost:3000/dashboard/settings/vault` with the master password. Vault state was restored from the backup — no re-bootstrap needed.

Discard the temporary restore file:

```bash
rm ./qa_platform_restore.dump
```

---

## 4. Single Container Failure Recovery

**Scenario:** One container has crashed or is in an unhealthy/exited state. The rest of the stack and the `pg_data` volume are intact.

For detailed container-level diagnostics, see `docs/runbooks/troubleshooting.md` Section 2.

---

### 4.1 Dashboard Container Crash (`dashboard-web`)

**Symptoms:** `http://localhost:3000` returns connection refused or 502.

```bash
# Check status
docker compose ps dashboard-web
docker compose logs --tail=100 dashboard-web

# Attempt restart (preserves container; fastest recovery)
docker compose restart dashboard-web

# If restart fails or container keeps exiting, rebuild and recreate
docker compose up -d --build dashboard-web
```

**Common causes:**

| Log pattern | Cause | Fix |
|---|---|---|
| `DASHBOARD_SESSION_SECRET is required` | Missing env var | Add to `.env` and restart |
| `ECONNREFUSED 5432` | Postgres not healthy when dashboard started | Wait for postgres healthy, then restart dashboard |
| JavaScript heap out of memory | Container memory limit hit | Increase Docker Desktop memory allocation |

After recovery, verify the session cookie still works or log in again. The vault will need to be unlocked (the in-memory RVK is gone after container restart — this is expected).

---

### 4.2 Runner Container Crash

**Symptoms:** `http://localhost:4000` returns connection refused; active test runs are stuck in `running` status with no updates.

```bash
# Check status
docker compose ps runner
docker compose logs --tail=100 runner

# Restart
docker compose restart runner
```

**Check for stuck runs after restart:**

If a run was in progress when the runner crashed, its status will remain `running` in the database with no callback. Identify and mark it failed:

```bash
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform \
  -c "UPDATE test_runs SET status='failed', error_message='Runner crashed mid-run — marked failed during recovery', completed_at=NOW() WHERE status='running';"
```

Verify the runner is accepting new work:

```bash
curl -sf http://localhost:4000/health
```

---

### 4.3 Postgres Container Crash

**Determine the nature of the failure before acting:**

```bash
docker compose ps postgres
docker compose logs --tail=200 postgres
```

**Decision tree:**

```
Postgres container exited or unhealthy
    |
    +-- Look for "database system is ready to accept connections" in prior logs
    |       |
    |       +-- YES → Ephemeral crash (OOM, signal, Docker restart policy)
    |       |           Action: docker compose restart postgres
    |       |           Expected: recovers in 10-30 seconds
    |       |
    |       +-- NO, look for "invalid page", "checksum failure", "could not write"
    |               |
    |               +-- Found → Data corruption likely
    |               |           Action: Section 3 (full restore from backup)
    |               |
    |               +-- Not found, but still failing → Volume permission / ownership issue
    |                           Action: docker compose down → docker compose up -d postgres
    |                           If still failing: Section 5.1 (pg_data recovery)
```

**Ephemeral crash recovery (no data corruption):**

```bash
docker compose restart postgres
# Watch for "ready to accept connections"
docker compose logs -f postgres
```

**After Postgres restarts**, restart the application services that depend on it:

```bash
docker compose restart dashboard-web runner
```

---

### 4.4 Migrator Failures

The migrator is a run-once container. It exits 0 on success and non-zero on failure. It does not run again automatically after a successful exit.

**Force a migrator re-run:**

```bash
# Remove the completed/failed migrator container
docker compose rm -f migrator

# Rerun it (waits for postgres healthy, then applies pending migrations)
docker compose up migrator
docker compose logs -f migrator
```

**Migrations are idempotent:** Every migration file uses `IF NOT EXISTS` guards for `CREATE TABLE`, `CREATE INDEX`, and `CREATE SEQUENCE` statements. Re-running a migration that was already applied is safe — it will skip already-applied versions (tracked in `schema_migrations`) and only apply new ones.

**If a migration fails:**

```bash
# Find the failing migration
docker compose logs migrator | grep -i "ERROR\|failed\|error"
```

The migrator wraps each file in a transaction. On failure the transaction rolls back completely — no partial schema changes are applied. Fix the SQL file, then re-run:

```bash
docker compose rm -f migrator && docker compose up migrator
```

---

## 5. Named Volume Recovery

### 5.1 `pg_data` Volume Lost or Corrupted

**Scenario:** The `websitetester_pg_data` volume is deleted, corrupted at the filesystem level, or Postgres refuses to start due to volume-level errors.

**Warning:** Removing and recreating this volume destroys all data. Only proceed after confirming you have a usable backup dump file.

**Verify you have a good backup before deleting the volume:**

```bash
# Check backups volume
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  ls -lht /backups

# Verify most recent backup
docker run --rm \
  -v websitetester_backups:/backups \
  postgres:16-alpine \
  pg_restore --list /backups/qa_platform_YYYYMMDD_HHMMSS.dump
```

**Recover:**

```bash
# Step 1 — Stop everything
docker compose down

# Step 2 — Remove the corrupted volume
docker volume rm websitetester_pg_data

# Step 3 — Start Postgres (initializes a fresh empty volume)
docker compose up -d postgres

# Step 4 — Wait for healthy
docker compose ps postgres

# Step 5 — Run migrations (establishes schema)
docker compose up migrator
docker compose logs -f migrator
# Wait for exit code 0

# Step 6 — Copy backup to host and restore
docker run --rm \
  -v websitetester_backups:/backups \
  -v "$(pwd)":/host \
  alpine \
  cp /backups/qa_platform_YYYYMMDD_HHMMSS.dump /host/qa_platform_restore.dump

export POSTGRES_HOST=localhost
export POSTGRES_PORT=5434
export POSTGRES_DB=qa_platform
export POSTGRES_USER=qa_user
export POSTGRES_PASSWORD=<your-db-password>

./docker/postgres/restore.sh ./qa_platform_restore.dump

# Step 7 — Restart all services
docker compose up -d

# Step 8 — Clean up
rm ./qa_platform_restore.dump
```

---

### 5.2 `backups` Volume Lost

**Scenario:** The `websitetester_backups` Docker volume is deleted or corrupted. The backup `.dump` files are gone from Docker's volume storage.

**RPO Impact:** Your most recent restorable point is now the oldest backup that exists somewhere outside the Docker volume. If no off-volume copies exist, RPO extends back to the last time you manually copied a backup off-host — potentially many days or the full history.

**Immediate triage — locate any off-volume copies:**

```bash
# Check external drives
ls /Volumes/*/qa-platform-backups/

# Check any cloud sync folders (iCloud, OneDrive, etc.)
find ~/Library/CloudStorage -name "*.dump" 2>/dev/null

# Check /tmp (if a backup was ever manually copied there)
ls /tmp/*.dump 2>/dev/null

# Check the project directory (if you ever ran a manual backup to host)
ls "$(pwd)"/*.dump 2>/dev/null
```

**If off-volume copies are found:**

1. Recreate the backups volume:
   ```bash
   docker volume create websitetester_backups
   ```

2. Copy the backup files back in:
   ```bash
   docker run --rm \
     -v websitetester_backups:/backups \
     -v /Volumes/BackupDrive/qa-platform-backups:/source \
     alpine \
     cp /source/qa_platform_YYYYMMDD_HHMMSS.dump /backups/
   ```

3. Verify:
   ```bash
   docker run --rm \
     -v websitetester_backups:/backups \
     alpine \
     ls -lh /backups
   ```

**If no off-volume copies exist:**

The backup history is gone. The production database (`pg_data` volume) is likely still intact and running — the loss of the `backups` volume does not affect the running database. Take an immediate backup:

```bash
docker compose --profile backup run --rm backup
```

Then set up off-volume copying immediately. See Section 7 and `docs/runbooks/backup-cron.md` for ongoing backup scheduling.

---

### 5.3 `ollama_models` Volume Lost

**Scenario:** The `websitetester_ollama_models` volume is deleted or corrupted.

**Impact:** None on application data. The Ollama LLM service will fail to find its models, causing LLM-dependent test features to fail.

**Recovery:**

```bash
# The volume can be safely deleted and recreated — models are pulled from Ollama hub
docker volume rm websitetester_ollama_models

# Start the Ollama service (recreates volume automatically)
docker compose --profile llm up -d ollama

# Re-pull required models
docker exec qa-platform-ollama ollama pull llama3
# Repeat for any other models used by the platform
```

Model download time depends on model size and network speed. A 4B parameter model is typically 2–4 GB. There is no proprietary data in this volume — only downloaded model weights.

---

## 6. Vault Master Password Loss

**Scenario:** The master password used to bootstrap the vault is not known. The vault cannot be unlocked. All secrets stored in `secret_records` are permanently inaccessible.

---

### Why Secrets Cannot Be Recovered

The vault uses Argon2id KDF + AES-256-GCM envelope encryption. The master password is **never stored anywhere** — not in the database, not in logs, not in environment variables, not in the Docker image. The Root Vault Key (RVK) exists only in process memory while the vault is unlocked and is zeroized on lock or container restart.

Without the master password, the Key Encryption Key (KEK) cannot be derived. Without the KEK, the RVK cannot be unwrapped. Without the RVK, no individual secret's Data Encryption Key (DEK) can be recovered. There is no backdoor, no admin override, no recovery email.

**This is intentional and cannot be circumvented.**

---

### Before Declaring the Password Lost

Check every possible location before proceeding to re-bootstrap:

- All password manager entries (personal vault, shared vault, organizational vault)
- Physical secure storage (fireproof safe, safety deposit box)
- Encrypted note apps, secure notes
- Other operator accounts — any other operator who may have been told the password at bootstrap
- Emails from the bootstrap session that may have inadvertently quoted it
- Browser autofill or saved passwords (check Safari/Chrome/Firefox saved passwords)

If the password is found anywhere, unlock normally at `http://localhost:3000/dashboard/settings/vault` and immediately save it in at least two secure locations.

---

### Re-Bootstrap Procedure (Nuclear Option)

For full step-by-step detail, follow **`docs/runbooks/vault-runbook.md` Section 7 — Emergency Lock-Out Recovery**. The high-level steps are:

**Step 1 — Stop all services**

```bash
docker compose down
```

**Step 2 — Take a labeled backup of the current (locked-out) state**

```bash
docker compose --profile backup run --rm backup
```

Label the resulting dump: "POST-LOCKOUT — VAULT SECRETS UNRECOVERABLE." This preserves audit records.

**Step 3 — Clear vault state from the database**

```bash
docker compose up -d postgres
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform
```

```sql
BEGIN;

-- Remove all vault unlock sessions (no longer valid)
DELETE FROM vault_unlock_sessions;

-- Remove the bootstrap record (enables re-bootstrap)
-- secret_records rows are retained for audit
DELETE FROM vault_state;

COMMIT;
```

**Step 4 — Restart services and re-bootstrap**

```bash
docker compose up -d
```

Navigate to `http://localhost:3000/dashboard/settings/vault/bootstrap`. Follow the full bootstrap procedure in `docs/runbooks/vault-runbook.md` Section 2. Choose a new, strong master password and store it in at least two secure locations immediately.

---

### Post-Recovery: Re-Enter Site Credentials

All previously encrypted site credentials (login usernames, passwords, API keys stored for test automation) must be re-entered manually. The encrypted rows in `secret_records` are unrecoverable — they remain in the table for audit purposes but cannot be decrypted.

**Process:**

1. Open the dashboard and navigate to each configured site
2. For each site, re-enter the credentials needed for automated testing (username, password, any API tokens)
3. Use `encryptSecret` via the dashboard UI to store them in the re-bootstrapped vault
4. Run a test pass against each site to confirm credentials work

---

## 7. Backup Failure or Gap in Backup History

**Scenario:** The daily backup has not run, has been running but failing silently, or you have just discovered a gap in the backup history.

---

### Step 1 — Check the Backup Log

On macOS with launchd:

```bash
# View the backup log
cat /tmp/qa-platform-backup.log

# Follow it live during a manual backup run
tail -f /tmp/qa-platform-backup.log
```

Look for `[ERROR]` or `[WARN]` lines. A successful backup ends with:

```
[INFO ] Backup completed successfully.
[INFO ]   File    : /backups/qa_platform_YYYYMMDD_HHMMSS.dump
```

---

### Step 2 — Check the launchd Agent Status

```bash
# Confirm the agent is loaded
launchctl list | grep com.qa-platform.backup

# Expected output format:
# <PID or ->  <last-exit-code>  com.qa-platform.backup
# PID="-" with exit code 0 = not currently running, last run succeeded
# PID="-" with exit code non-zero = last run failed
```

If the agent is not listed, it is not installed:

```bash
# Re-install
cp docker/postgres/com.qa-platform.backup.plist \
   ~/Library/LaunchAgents/com.qa-platform.backup.plist

launchctl load ~/Library/LaunchAgents/com.qa-platform.backup.plist
launchctl list | grep com.qa-platform.backup
```

For full scheduling details, see `docs/runbooks/backup-cron.md` Section 4.1.

---

### Step 3 — Identify Why the Backup Failed

Common failure modes:

| Symptom | Cause | Fix |
|---|---|---|
| `POSTGRES_PASSWORD is not set` | Env var not in backup job environment | Update plist `EnvironmentVariables` key or pass via `.env` |
| `Cannot reach PostgreSQL at localhost:5432` | Postgres not running when backup triggered | Ensure Postgres is up before the scheduled time; consider dependency checking in plist |
| `Backup integrity check failed` | Disk full during pg_dump; partial write | Free disk space, then retrigger |
| `Low disk space` warning followed by failure | `backups` volume storage exhausted | Delete old backups manually or reduce `BACKUP_RETENTION_DAYS` |
| No log file at all | launchd agent not loaded | Re-install agent (Step 2 above) |

---

### Step 4 — Trigger a Manual Backup Immediately

Do not rely on the next scheduled run. Trigger one now:

```bash
# Via launchd (uses the same environment as the scheduled job)
launchctl start com.qa-platform.backup
sleep 15
tail -50 /tmp/qa-platform-backup.log
```

Or directly via Docker Compose:

```bash
docker compose --profile backup run --rm backup
```

---

### Step 5 — Verify the Resulting Backup File

```bash
# List the backups volume to confirm a new file appeared
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  ls -lht /backups

# Verify the new file is valid (replace timestamp with actual filename)
docker run --rm \
  -v websitetester_backups:/backups \
  postgres:16-alpine \
  pg_restore --list /backups/qa_platform_YYYYMMDD_HHMMSS.dump
```

A valid backup produces a non-empty table of contents and exits with code 0. Any error indicates a bad backup — do not rely on it. Re-run and re-verify.

---

### Step 6 — Copy the Backup Off-Volume

Once you have a verified backup, immediately copy it to an external location so a Docker volume loss does not eliminate the only copy:

```bash
# Copy to project directory (temporary — move to persistent storage)
docker run --rm \
  -v websitetester_backups:/backups \
  -v "$(pwd)":/host \
  alpine \
  cp /backups/qa_platform_YYYYMMDD_HHMMSS.dump /host/

# Then move to NAS, external drive, or cloud sync folder
cp qa_platform_YYYYMMDD_HHMMSS.dump /Volumes/BackupDrive/qa-platform-backups/
```

---

## 8. Corruption vs. Loss Decision Tree

Use this tree to quickly determine which recovery procedure to follow.

```
START: Something is wrong with the platform
    |
    +--[ Can docker compose ps show any containers healthy? ]
    |       |
    |       +-- YES → Partial failure
    |       |           |
    |       |           +--[ Which container is unhealthy? ]
    |       |                   |
    |       |                   +-- dashboard-web only → Section 4.1
    |       |                   +-- runner only        → Section 4.2
    |       |                   +-- postgres           → Continue below
    |       |
    |       +-- NO → Full stack down → Try: docker compose up -d
    |                                   Still failing? Continue below.
    |
    +--[ Is Postgres starting but data looks wrong/missing? ]
    |       |
    |       +-- YES (tables empty, known rows missing, query errors)
    |       |       |
    |       |       +--[ Is this a schema issue or data issue? ]
    |       |               |
    |       |               +-- Schema wrong (missing tables/columns)
    |       |               |       → Re-run migrator: Section 4.4
    |       |               |
    |       |               +-- Data wrong or deleted
    |       |                       → Restore from backup: Section 3
    |       |
    |       +-- NO → Postgres container crash / volume issue → Continue below
    |
    +--[ Does Postgres log show "invalid page" or "checksum failure"? ]
    |       |
    |       +-- YES → pg_data volume corruption
    |       |           → Section 5.1 (destroy volume + restore from backup)
    |       |
    |       +-- NO → Ephemeral crash
    |                   → docker compose restart postgres
    |                   → If it recovers: done
    |                   → If it keeps crashing: Section 5.1
    |
    +--[ Is the backup volume (websitetester_backups) missing or empty? ]
    |       |
    |       +-- YES → Section 5.2 (locate off-volume copies)
    |       |
    |       +-- NO → Backups are intact; proceed with Section 3 restore
    |
    +--[ Is the vault unable to unlock and master password is lost? ]
            |
            +-- YES → Section 6 (re-bootstrap vault)
            |
            +-- NO → Vault troubleshooting: docs/runbooks/vault-runbook.md §10

ESCALATION: If none of the above applies or recovery fails after following the relevant
section, run:
    docker compose logs > /tmp/platform-logs-$(date +%Y%m%d_%H%M%S).txt
and review docs/runbooks/troubleshooting.md for further diagnostics.
```

---

## 9. Recovery Time and Recovery Point Objectives

The following estimates are based on the daily backup schedule, local Docker restarts, and the `restore.sh` script on a modern Mac with SSD and a typical database size under 1 GB.

| Scenario | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) | Notes |
|---|---|---|---|
| Single container crash (dashboard-web, runner) | 1–5 minutes | Zero (no data loss) | `docker compose restart`; database unaffected |
| Postgres ephemeral crash (no data corruption) | 2–10 minutes | Zero (no data loss) | Container restart; `pg_data` volume intact |
| Postgres data corruption — restore from backup | 20–45 minutes | Up to 24 hours | Depends on how recently backup ran; daily schedule at 02:00 AM |
| Full host loss — fresh rebuild with backup | 1–3 hours | Up to 24 hours | Includes OS setup, Docker install, repo clone, restore |
| Full host loss — no off-volume backup copy | Indeterminate | Total data loss | All application data gone; only recovery is from memory |
| `pg_data` volume loss — restore from backup | 20–40 minutes | Up to 24 hours | Volume recreated; restore.sh run against backup |
| `backups` volume loss — off-volume copy exists | 15–30 minutes | Depends on copy age | Copy back to volume; pg_data still intact |
| `backups` volume loss — no off-volume copy | N/A | Total backup history loss | pg_data likely still intact; start fresh backup schedule immediately |
| `ollama_models` volume loss | 15–90 minutes | Zero (no data loss) | Re-pull models from Ollama hub; LLM features unavailable during re-pull |
| Vault master password loss — re-bootstrap | 30–60 minutes + credential re-entry | All encrypted secrets lost | Site credentials must be re-entered manually; audit trail preserved |
| Backup gap (missed scheduled backup) | N/A | Gap extends RPO | Trigger manual backup immediately; next restore point is today's manual backup |
| Migrator failure | 5–15 minutes | Zero (no data loss) | Fix SQL; re-run migrator; idempotent migrations |

**Key takeaways:**
- The dominant RPO risk is the 24-hour backup window from the daily schedule. If the machine is active, manually trigger additional backups before significant data entry sessions.
- RTO for any database restore scenario depends heavily on how quickly the right backup file can be located and verified.
- Any scenario involving `pg_data` volume loss without a usable backup dump results in **total data loss**. There is no other copy.
- The vault master password is the only unrecoverable credential. Everything else can be rebuilt from backup or re-configured.

---

## 10. Pre-Disaster Readiness Checklist

Run this checklist at least monthly and after any significant infrastructure change.

---

### 10.1 Backup Schedule is Running and Healthy

```bash
# Confirm launchd agent is loaded
launchctl list | grep com.qa-platform.backup
# Expected: a line with "com.qa-platform.backup" and last exit code 0

# Confirm a recent backup exists in the volume (within last 25 hours)
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  find /backups -name "*.dump" -mtime -1
# Expected: at least one file listed

# Confirm the most recent backup is valid
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  ls -t /backups | head -1
# Take the filename from above and run:
docker run --rm \
  -v websitetester_backups:/backups \
  postgres:16-alpine \
  pg_restore --list /backups/<most-recent-file>.dump > /dev/null
# Expected: exits 0 with no error output
```

---

### 10.2 Backup Volume Has Off-Platform Copies

Manually verify that at least the three most recent backup files exist in at least one of the following:

- An external drive mounted at a known path
- A NAS or shared network drive
- A cloud sync folder (OneDrive, iCloud Drive, or similar)

```bash
# Example: verify on external drive
ls -lh /Volumes/BackupDrive/qa-platform-backups/*.dump | tail -5
```

If no off-platform copies exist, copy the current backups now:

```bash
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  ls /backups | while read f; do echo "$f"; done
# For each file, copy to external storage
docker run --rm \
  -v websitetester_backups:/backups \
  -v /Volumes/BackupDrive/qa-platform-backups:/dest \
  alpine \
  sh -c "cp /backups/*.dump /dest/"
```

---

### 10.3 Vault Master Password is Documented and Accessible

Confirm you can answer YES to all of the following:

- [ ] The master password is stored in at least one password manager entry
- [ ] A second copy exists in physical secure storage (fireproof safe, safety deposit box, or equivalent)
- [ ] You can retrieve and correctly enter the master password without typing it from memory
- [ ] The password has been tested by performing a lock/unlock cycle recently

**Test the password now:**

```bash
# Lock the vault (via the dashboard UI at Settings → Vault → Lock)
# Then unlock it at Settings → Vault using the stored password
# If unlock succeeds, the password is correct and accessible
```

If the password test fails, treat it as a lock-out event and follow Section 6 immediately.

---

### 10.4 `.env` and Secrets are Documented Securely

- [ ] The `.env` file is NOT committed to the repository
  ```bash
  git ls-files .env
  # Expected: no output (file is not tracked)
  
  grep -r "\.env" .gitignore
  # Expected: .env entry present
  ```
- [ ] All required `.env` variables are documented somewhere secure and off-machine (password manager secure note, encrypted document)
- [ ] `POSTGRES_PASSWORD` is documented
- [ ] `DASHBOARD_SESSION_SECRET` is documented
- [ ] Any site-specific env vars are documented

---

### 10.5 Deployment and Restore Scripts Have Been Tested

```bash
# Confirm restore.sh is executable
ls -la docker/postgres/restore.sh
# Expected: -rwxr-xr-x

# Confirm backup.sh is executable
ls -la docker/postgres/backup.sh
# Expected: -rwxr-xr-x

# Confirm deploy.sh is executable
ls -la scripts/deploy.sh
# Expected: -rwxr-xr-x
```

Run an end-to-end backup and restore drill at least quarterly:

1. Trigger a manual backup: `docker compose --profile backup run --rm backup`
2. Verify the backup file: `pg_restore --list` on the new dump
3. Restore to a test database (use `POSTGRES_DB=qa_platform_test`) or on a throwaway Docker container to confirm the dump restores without errors
4. Confirm table counts match the source

Document the drill result and date.

---

### 10.6 Security Pre-Production Gates Reviewed

Before any production deployment, confirm the findings from `docs/decisions/006-security-review.md` have been addressed. Findings F-01 through F-04 and F-08 must be resolved. Check their status:

```bash
# Open the ADR and review the status column for each finding
cat docs/decisions/006-security-review.md | grep -A2 "F-0[1234]\|F-08"
```

Do not deploy to production with open critical or high findings.

---

### 10.7 Recovery Contact and Reference List

| Resource | Location |
|---|---|
| This runbook | `docs/runbooks/disaster-recovery.md` |
| Vault recovery detail | `docs/runbooks/vault-runbook.md` Section 7 |
| Backup scheduling | `docs/runbooks/backup-cron.md` |
| Container troubleshooting | `docs/runbooks/troubleshooting.md` |
| CI/CD and deployment | `docs/runbooks/cicd-runbook.md` |
| Security review findings | `docs/decisions/006-security-review.md` |
| Backup script | `docker/postgres/backup.sh` |
| Restore script | `docker/postgres/restore.sh` |
| launchd plist | `docker/postgres/com.qa-platform.backup.plist` |
| launchd installer | `scripts/install-backup-launchd.sh` |
| Staging compose override | `docker/docker-compose.staging.yml` |
| Deployment script | `scripts/deploy.sh` |

---

*End of Disaster Recovery Runbook*
