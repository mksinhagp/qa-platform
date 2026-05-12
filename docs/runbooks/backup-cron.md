# Runbook: PostgreSQL Backup & Restore — QA Automation Platform

**Owner**: Platform / DevOps  
**Last updated**: 2026-06  
**Applies to**: QA Automation Platform (PostgreSQL 16, Docker Compose)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backup File Naming & Location](#2-backup-file-naming--location)
3. [Running a Manual Backup](#3-running-a-manual-backup)
4. [Automated Scheduling](#4-automated-scheduling)
   - [macOS — launchd](#41-macos--launchd)
   - [Linux — cron](#42-linux--cron)
5. [Retention Policy](#5-retention-policy)
6. [Verifying a Backup](#6-verifying-a-backup)
7. [Restoring from Backup](#7-restoring-from-backup)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Overview

Backups are created using `pg_dump` in PostgreSQL **custom format** (`.dump`).  
Custom format is:

- Compressed at level 9 (smaller files than plain SQL)
- Selectively restorable (individual tables, schemas, or sequences)
- Verified for integrity via `pg_restore --list` immediately after creation

The backup Docker service uses the same `postgres:16-alpine` image as the main database container, guaranteeing `pg_dump` / `pg_restore` version parity.

**Scripts**:

| Script | Purpose |
|--------|---------|
| `docker/postgres/backup.sh` | Create a backup, apply retention, verify integrity |
| `docker/postgres/restore.sh` | Restore from a specific backup file |

---

## 2. Backup File Naming & Location

### Naming Convention

```
<database>_<YYYYMMDD>_<HHMMSS>.dump
```

Example:

```
qa_platform_20260601_020000.dump
```

### Location

Backups are written to the `backups` Docker named volume, mounted at `/backups` inside the container.

To inspect the volume contents from the host:

```bash
docker run --rm \
  -v qa_platform_backups:/backups \
  alpine \
  ls -lh /backups
```

To copy a backup to the local host:

```bash
docker run --rm \
  -v qa_platform_backups:/backups \
  -v "$(pwd)":/host \
  alpine \
  cp /backups/qa_platform_20260601_020000.dump /host/
```

> **Volume name**: Docker Compose prefixes the project name. With the default project name (`websitetester`), the volume is `websitetester_backups`. Verify with `docker volume ls`.

---

## 3. Running a Manual Backup

### Via Docker Compose (recommended)

```bash
docker compose --profile backup run --rm backup
```

This starts the `backup` service, executes `backup.sh`, then removes the container (`--rm`).

The `backup` service:
- Only activates under the `backup` profile — it does not run with normal `docker compose up`
- Waits for the `postgres` healthcheck to pass before starting
- Writes the backup file to the `backups` named volume

### With custom retention (e.g. keep 7 days only)

```bash
BACKUP_RETENTION_DAYS=7 docker compose --profile backup run --rm backup
```

### From the host (requires pg_dump installed locally)

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432   # or the mapped port if changed
export POSTGRES_DB=qa_platform
export POSTGRES_USER=qa_user
export POSTGRES_PASSWORD=qa_password
export BACKUP_DIR=/tmp/qa-backups

./docker/postgres/backup.sh
```

---

## 4. Automated Scheduling

### 4.1 macOS — launchd

A ready-to-use launchd plist is provided at:

```
docker/postgres/com.qa-platform.backup.plist
```

It runs the backup daily at **02:00 AM** and logs all output to `/tmp/qa-platform-backup.log`.

**Install the agent**:

```bash
# 1. Copy the plist to the LaunchAgents directory
cp docker/postgres/com.qa-platform.backup.plist \
   ~/Library/LaunchAgents/com.qa-platform.backup.plist

# 2. Edit the plist and update <WorkingDirectory> to the actual project path
#    (already set to the project root — confirm it matches your checkout path)
open ~/Library/LaunchAgents/com.qa-platform.backup.plist

# 3. Load the agent (takes effect immediately; persists across reboots)
launchctl load ~/Library/LaunchAgents/com.qa-platform.backup.plist

# 4. Verify it is loaded
launchctl list | grep com.qa-platform.backup
```

**Run the backup immediately** (without waiting for 02:00):

```bash
launchctl start com.qa-platform.backup
```

**View logs**:

```bash
tail -f /tmp/qa-platform-backup.log
```

**Uninstall**:

```bash
launchctl unload ~/Library/LaunchAgents/com.qa-platform.backup.plist
rm ~/Library/LaunchAgents/com.qa-platform.backup.plist
```

---

### 4.2 Linux — cron

On a Linux host where Docker is available, add a cron entry for the user that has Docker access (typically a deploy user or root).

**Edit crontab**:

```bash
crontab -e
```

**Daily at 02:00 AM — standard**:

```cron
0 2 * * * cd /path/to/WebsiteTester && docker compose --profile backup run --rm backup >> /var/log/qa-platform-backup.log 2>&1
```

**Daily at 02:00 AM — with log rotation via logger**:

```cron
0 2 * * * cd /path/to/WebsiteTester && docker compose --profile backup run --rm backup 2>&1 | logger -t qa-platform-backup
```

**Weekly on Sunday at 03:00 AM (alternative)**:

```cron
0 3 * * 0 cd /path/to/WebsiteTester && docker compose --profile backup run --rm backup >> /var/log/qa-platform-backup.log 2>&1
```

**Notes**:
- Replace `/path/to/WebsiteTester` with the actual checkout directory.
- Ensure the cron user's `PATH` includes the directory containing `docker` (commonly `/usr/local/bin` or `/usr/bin`). Add to the crontab if needed:
  ```cron
  PATH=/usr/local/bin:/usr/bin:/bin
  ```
- The `DASHBOARD_SESSION_SECRET` env var is consumed by the `dashboard-web` service, not by the backup service; `docker compose --profile backup` will not start other services and will not require it.

**Verify cron is working** after first scheduled run:

```bash
# Check log file
tail -50 /var/log/qa-platform-backup.log

# Or check the backups volume
docker run --rm -v websitetester_backups:/backups alpine ls -lh /backups
```

---

## 5. Retention Policy

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_RETENTION_DAYS` | `30` | Backup files older than this many days are deleted after each successful backup run |

Retention is applied by `backup.sh` at the end of every run using `find ... -mtime +N`. Only files matching the pattern `<POSTGRES_DB>_*.dump` in `BACKUP_DIR` are removed — other files in the directory are left untouched.

**Override at runtime**:

```bash
BACKUP_RETENTION_DAYS=14 docker compose --profile backup run --rm backup
```

**Override permanently** by setting the variable in a `.env` file at the project root:

```dotenv
BACKUP_RETENTION_DAYS=14
```

Docker Compose picks up `.env` automatically.

---

## 6. Verifying a Backup

To verify a backup file without restoring it to the database:

```bash
# Inside the backup container (ad-hoc)
docker run --rm \
  -v websitetester_backups:/backups \
  postgres:16-alpine \
  pg_restore --list /backups/qa_platform_20260601_020000.dump
```

A healthy backup produces a table of contents listing schemas, tables, sequences, functions, and data sections. If the file is corrupt, `pg_restore` exits non-zero with an error.

`backup.sh` performs this check automatically after every run. If integrity fails, the script exits with code 1 and logs an `[ERROR]` message.

---

## 7. Restoring from Backup

### Step 1 — Identify the backup file

```bash
docker run --rm \
  -v websitetester_backups:/backups \
  alpine \
  ls -lht /backups
```

### Step 2 — Copy the backup to the host (if running restore.sh from host)

```bash
docker run --rm \
  -v websitetester_backups:/backups \
  -v "$(pwd)":/host \
  alpine \
  cp /backups/qa_platform_20260601_020000.dump /host/
```

### Step 3 — Run the restore

**Interactive (prompts for confirmation)**:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=qa_platform
export POSTGRES_USER=qa_user
export POSTGRES_PASSWORD=qa_password

./docker/postgres/restore.sh ./qa_platform_20260601_020000.dump
```

**Non-interactive / automated**:

```bash
RESTORE_FORCE=true \
RESTORE_FILE=/backups/qa_platform_20260601_020000.dump \
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_DB=qa_platform \
POSTGRES_USER=qa_user \
POSTGRES_PASSWORD=qa_password \
./docker/postgres/restore.sh
```

**From inside a Docker container** (using the backups volume directly):

```bash
docker run --rm \
  --network qa-platform-network \
  -v websitetester_backups:/backups \
  -v "$(pwd)/docker/postgres/restore.sh:/usr/local/bin/restore.sh" \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=qa_platform \
  -e POSTGRES_USER=qa_user \
  -e POSTGRES_PASSWORD=qa_password \
  -e RESTORE_FILE=/backups/qa_platform_20260601_020000.dump \
  -e RESTORE_FORCE=true \
  postgres:16-alpine \
  /bin/sh -c "chmod +x /usr/local/bin/restore.sh && /usr/local/bin/restore.sh"
```

### Step 4 — Verify the restore

```bash
psql \
  --host=localhost \
  --port=5432 \
  --username=qa_user \
  --dbname=qa_platform \
  --command="\dt public.*"
```

Confirm the expected tables are present and row counts look reasonable:

```bash
psql \
  --host=localhost \
  --port=5432 \
  --username=qa_user \
  --dbname=qa_platform \
  --command="SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
```

---

## 8. Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| `POSTGRES_PASSWORD is not set. Aborting.` | Password env var missing | Set `POSTGRES_PASSWORD` in the env or `.env` file |
| `Cannot reach PostgreSQL at ...` | DB container not running or not yet healthy | Run `docker compose up postgres -d` and wait for healthcheck to pass |
| `pg_restore --list reported errors` | Backup file corrupt or truncated | Disk was full during write, or the run was interrupted; delete the file and re-run |
| `No backup file specified` | Missing argument to restore.sh | Pass the file as `$1` or set `RESTORE_FILE` env var |
| `Running in non-interactive mode but RESTORE_FORCE is not 'true'` | Piped/scripted restore without force flag | Add `RESTORE_FORCE=true` to the environment |
| Low disk space warning in backup log | Less than 500 MB free on backup volume | Prune old backups or expand storage; reduce `BACKUP_RETENTION_DAYS` temporarily |
| launchd agent not firing | Plist not loaded or Docker not running | Run `launchctl list \| grep qa-platform`; ensure Docker Desktop is set to start at login |
