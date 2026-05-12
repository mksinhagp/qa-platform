# QA Automation Platform — Troubleshooting Runbook

**Phase 11.3 | Last updated: 2026-05-08**

Audience: Manish Sinha (VP of AI). Assumes full familiarity with the stack. Commands are written for Mac + Docker Desktop. All service names and container names match `docker-compose.yml`.

---

## Table of Contents

1. [Diagnostic Quick Reference](#1-diagnostic-quick-reference)
2. [Docker / Infrastructure Issues](#2-docker--infrastructure-issues)
3. [Database / Migration Issues](#3-database--migration-issues)
4. [Authentication Issues](#4-authentication-issues)
5. [Vault Issues](#5-vault-issues)
6. [Site & Environment Issues](#6-site--environment-issues)
7. [Runner / Playwright Issues](#7-runner--playwright-issues)
8. [Email Validation Issues](#8-email-validation-issues)
9. [LLM / Ollama Issues](#9-llm--ollama-issues)
10. [API Testing Issues](#10-api-testing-issues)
11. [Reporting Issues](#11-reporting-issues)
12. [Artifact Retention / Cleanup Issues](#12-artifact-retention--cleanup-issues)
13. [Performance Issues](#13-performance-issues)
14. [Common Error Messages Reference](#14-common-error-messages-reference)
15. [Escalation Checklist](#15-escalation-checklist)

---

## 1. Diagnostic Quick Reference

| Symptom | Likely Cause | Go To |
|---|---|---|
| Dashboard returns 502 or refuses connection | `dashboard-web` container not running or exited | §2.1 |
| `docker compose up` hangs on migrator | Postgres not healthy yet, or migrator SQL error | §2.6, §3.1 |
| Port 5432 conflict on Mac host | Another local Postgres running; override maps to 5434 | §2.3 |
| Login fails with correct password | Session table empty, cookie domain mismatch, or operator inactive | §4.1 |
| Keeps logging out every few minutes | Session TTL env var too short, or `operator_sessions` row expired | §4.2 |
| "Operator not found" on login page | Operator record missing or `active = false` | §4.3 |
| Vault banner shows "Bootstrap Required" | `vault_state` table has no row with `wrapped_rvk IS NOT NULL` | §5.4 |
| "Master password incorrect" on vault unlock | Wrong password or salt corruption | §5.2 |
| Secret retrieval fails after unlock | Vault unlock session expired mid-request | §5.4 |
| Site not in run wizard dropdown | Site `is_active = false` or no active environments | §6.1 |
| Run stays in `running` status forever | Runner crashed after accepting run, callback never posted | §7.7 |
| Runner returns 409 on new run | Previous run still registered in singleton manager | §7.7 |
| Playwright browser launch fails | Missing browser binaries in runner image | §7.2 |
| Email validation times out | Mailcatcher not running (profile `dev` not enabled) | §8.4 |
| Ollama model not found error | Model not pulled into container | §9.2 |
| API test suite fails with ECONNREFUSED | Target site base URL unreachable from runner container | §10.1 |
| Report shows no data | Run completed but no `run_executions` rows | §11.1 |
| Artifacts not being deleted | Cleanup job not running or file permission error | §12.1 |
| Dashboard response slow | N+1 queries or connection pool exhausted | §13.1 |

---

## 2. Docker / Infrastructure Issues

### 2.1 Container Won't Start

Check which containers are running and their exit codes:

```bash
docker compose ps
docker compose ps -a
```

For a specific service:

```bash
docker compose logs --tail=100 postgres
docker compose logs --tail=100 migrator
docker compose logs --tail=100 dashboard-web
docker compose logs --tail=100 runner
```

**Postgres fails to start**
- Look for `could not create lock file` — indicates a leftover PID file from an unclean shutdown.
- Look for `data directory ... has wrong ownership` — the `pg_data` volume was initialized by a different UID.
- Fix: stop all containers, then reset the volume (see §2.5).

**Migrator exits non-zero**
- The migrator runs once and exits; exit code 0 = success, non-zero = SQL failure.
- Check: `docker compose logs migrator` for the failing SQL statement.
- The migration runner wraps everything in a transaction; on failure it rolls back and throws. The version that failed will not appear in `schema_migrations`.

**Dashboard-web fails to start**
- `DASHBOARD_SESSION_SECRET is required` — the secret is not set in `.env`. Set it to a random string of 32+ characters.
- `ECONNREFUSED 5432` — Postgres is not healthy yet. The `depends_on: condition: service_healthy` check should prevent this, but if you bypassed Compose ordering, restart with:

```bash
docker compose up -d --no-deps postgres
docker compose up -d --no-deps migrator
docker compose up -d dashboard-web
```

**Runner fails to start**
- Check for TypeScript compile errors in the build stage: `docker compose logs runner | grep -i error`.
- The runner Dockerfile uses a multi-stage build; the `runner` user (UID 1001) owns the dist output. File permission errors on mounted volumes in dev override are common — check §2.1 override notes.

### 2.2 Health Check Failures

Postgres health check command: `pg_isready -U qa_user -d qa_platform`. To test it manually:

```bash
docker exec qa-platform-postgres pg_isready -U qa_user -d qa_platform
```

If it fails:
- Container is still initializing — wait 30 seconds and recheck.
- Password mismatch — the `POSTGRES_USER`/`POSTGRES_PASSWORD` env vars don't match what was used when the volume was first initialized. Reset the volume (§2.5).

### 2.3 Port Conflicts

Default port assignments (from `docker-compose.override.yml` for local dev):

| Service | Container Port | Host Port (dev override) |
|---|---|---|
| postgres | 5432 | 5434 |
| dashboard-web | 3000 | 3000 |
| runner | 4000 | 4000 |
| ollama | 11434 | 11434 |
| mailcatcher HTTP | 1080 | 1080 |
| mailcatcher SMTP | 1025 | 1025 |

Postgres maps to 5434 on the host to avoid conflicts with a local Postgres. If you still have a conflict:

```bash
# Find what is using the port
lsof -i :5434
lsof -i :3000
```

To change the host-side port, edit `docker-compose.override.yml`. Do not change the container-side port.

### 2.4 Viewing Logs

Follow logs for a running service:

```bash
docker compose logs -f dashboard-web
docker compose logs -f runner
docker compose logs -f postgres
```

Multiple services at once:

```bash
docker compose logs -f dashboard-web runner
```

One-shot dump (last 200 lines):

```bash
docker compose logs --tail=200 runner
```

### 2.5 Restarting a Single Service

```bash
# Restart without rebuilding
docker compose restart dashboard-web

# Rebuild image and restart
docker compose up -d --build dashboard-web

# Stop, remove container, and recreate
docker compose rm -sf dashboard-web && docker compose up -d dashboard-web
```

### 2.6 pg_data Volume Corruption / Safe Reset

**Warning**: This destroys all data. Only do this in development or when you have a backup.

```bash
# 1. Stop all services
docker compose down

# 2. Remove the named volume
docker volume rm websitetester_pg_data

# 3. Bring everything back up — postgres will re-initialize the volume
docker compose up -d
```

If you only need to reset the database without touching the volume:

```bash
docker exec -it qa-platform-postgres psql -U qa_user -d postgres \
  -c "DROP DATABASE qa_platform;" \
  -c "CREATE DATABASE qa_platform;"
```

Then re-run migrations:

```bash
docker compose restart migrator
docker compose logs -f migrator
```

### 2.7 Migrator Service Fails to Run Migrations

The migrator is a run-once container. Once it exits successfully, `docker compose up` will not re-run it. To force re-run:

```bash
# Remove the completed container and re-create
docker compose rm -f migrator
docker compose up migrator
docker compose logs -f migrator
```

The migrator applies files from `db/migrations/` and `db/procs/` in numerical order. Each version is tracked in `schema_migrations`. A failed migration rolls back the entire transaction and exits non-zero. Fix the SQL, then re-run.

---

## 3. Database / Migration Issues

### 3.1 Migration Fails with "Already Exists"

The migration runner checks `schema_migrations` before executing each file. If a version is present in that table, it is skipped. If you see `ERROR: relation "xxx" already exists`, the schema was created outside the migration runner (manual psql, volume restored from a different state), and the version is not in `schema_migrations`.

**Fix**: Insert the version manually to skip it, then re-run:

```sql
INSERT INTO schema_migrations (version, checksum)
VALUES ('0003', 'manually-skipped');
```

Alternatively, if the migration is truly idempotent (uses `CREATE TABLE IF NOT EXISTS`), the error should not occur — it means the file was partially applied or the `IF NOT EXISTS` guard is missing on one statement.

### 3.2 Stored Procedure Not Found

Symptom: application throws `function sp_xxx_yyy(…) does not exist`.

Causes:
- The proc migration was never applied (check `schema_migrations` for the proc version).
- The proc was applied against a different database than the one the app is connecting to.
- The `search_path` is not set to `public` (unlikely in this stack since all objects are in `public`).

Check applied procs:

```sql
SELECT version, applied_at
FROM schema_migrations
WHERE version::int >= 6  -- procs start at 0006 in the procs directory
ORDER BY version;
```

Check function existence:

```sql
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname LIKE 'sp_%'
ORDER BY proname;
```

To re-apply a specific proc, delete its entry from `schema_migrations` and re-run the migrator:

```sql
DELETE FROM schema_migrations WHERE version = '0031';
```

```bash
docker compose rm -f migrator && docker compose up migrator
```

### 3.3 Connection Pool Exhaustion

Symptoms: `Error: timeout exceeded when trying to connect`, `remaining connection slots are reserved`, slow responses under load.

The pool defaults (in `packages/db/src/client.ts`):
- `max: 20` connections per process
- `idleTimeoutMillis: 30000`
- `connectionTimeoutMillis: 2000`

Check active connections:

```sql
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = 'qa_platform'
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;
```

Check connections per application:

```sql
SELECT application_name, count(*), state
FROM pg_stat_activity
WHERE datname = 'qa_platform'
GROUP BY application_name, state
ORDER BY count DESC;
```

Fix options:
- Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND datname = 'qa_platform';`
- Restart the offending service: `docker compose restart dashboard-web`
- Reduce `RUNNER_CONCURRENCY` if the runner is spawning too many parallel executions.

### 3.4 Checking Applied Migrations

```sql
SELECT version, applied_at, checksum
FROM schema_migrations
ORDER BY version;
```

To see the highest applied version:

```sql
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;
```

### 3.5 Manually Applying a Migration

If you need to apply a single migration file out of band (use only in emergencies — prefer re-running the migrator container):

```bash
# Copy the file into the postgres container and run it
docker cp db/migrations/0017_admin_test_tables.sql qa-platform-postgres:/tmp/
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform -f /tmp/0017_admin_test_tables.sql
```

Then record it in `schema_migrations`:

```sql
INSERT INTO schema_migrations (version, checksum)
VALUES ('0017', 'manual');
```

### 3.6 Connecting to the Database Directly

```bash
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform
```

From the host (using the override-mapped port 5434):

```bash
psql -h localhost -p 5434 -U qa_user -d qa_platform
```

Useful psql shortcuts:
- `\dt` — list tables
- `\df sp_*` — list stored procedures matching pattern
- `\d artifacts` — describe table
- `\q` — quit

---

## 4. Authentication Issues

### 4.1 Login Fails with Correct Credentials

The login flow calls `sp_operators_get_by_login` to retrieve the operator record, then validates the Argon2id hash, then calls `sp_operator_sessions_create` to insert a session row.

Diagnostic steps:

```bash
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform
```

```sql
-- Verify the operator record exists and is active
SELECT id, login, active, created_date FROM operators WHERE login = 'your-login';

-- Check for recent failed sessions (audit log)
SELECT action, status, error_message, created_date
FROM audit_logs
WHERE action = 'login' AND actor_id = 'your-login'
ORDER BY created_date DESC
LIMIT 10;
```

If `active = false`, re-enable the operator:

```sql
UPDATE operators SET active = true, updated_date = NOW() WHERE login = 'your-login';
```

If the operator row does not exist at all, see §4.5 (reset password) for how to create one via SQL.

Cookie issues: the dashboard session cookie is HTTP-only and scoped to the domain. If you are running on `localhost:3000` and the cookie is not being set, check browser developer tools (Application → Cookies). Ensure `DASHBOARD_SESSION_SECRET` is consistent across restarts (it is not used to encrypt cookies directly, but session invalidation after a secret rotation will log everyone out).

### 4.2 Session Expired / Keeps Logging Out

Session records live in `operator_sessions`. Each row has an `expires_date` and `last_activity_date`. The platform validates sessions via `sp_operator_sessions_validate`.

Check your current sessions:

```sql
SELECT id, operator_id, created_date, last_activity_date, expires_date, is_active
FROM operator_sessions
WHERE is_active = true
ORDER BY created_date DESC
LIMIT 10;
```

Idle timeout is controlled by `AUTH_SESSION_IDLE_TIMEOUT_SECONDS` (default 28800 = 8 hours). Absolute timeout is `AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS` (default 2592000 = 30 days). Ensure these are set correctly in your `.env`.

If sessions are expiring immediately, `expires_date` may be in the past — this indicates a clock skew between the application container and Postgres. Check:

```bash
docker exec qa-platform-dashboard date
docker exec qa-platform-postgres date
```

### 4.3 "Operator Not Found" Error

The `sp_operators_get_by_login` function returns an empty result set if the login does not match (case-sensitive) or the row does not exist.

```sql
-- Confirm exact login value (case-sensitive)
SELECT login FROM operators;
```

If no operators exist at all, the database was reset without re-seeding. Create the first operator via SQL (see §4.5).

### 4.4 Vault Locked — How to Unlock

Navigate to `/dashboard/settings/vault`. If the vault is locked (no active `vault_unlock_sessions` row for your session), click "Unlock Vault" and enter the master password.

If the UI is inaccessible, check the vault state from the DB:

```sql
SELECT * FROM vault_state;
```

If `wrapped_rvk` is NULL, the vault has never been bootstrapped. See §5.4.

### 4.5 Reset an Operator Password

The `operators` table stores an Argon2id hash in `password_hash`. You cannot reset it directly in SQL without knowing the hash format. The correct procedure is to generate the hash programmatically, then update it.

**Via the dashboard (preferred):** `/dashboard/settings/operators` → select operator → "Change Password".

**Via SQL (emergency):** Generate an Argon2id hash using Node.js in the runner or dashboard container, then update:

```bash
docker exec -it qa-platform-dashboard node -e "
const { hash } = require('argon2');
hash('NewPassword123!').then(h => console.log(h));
"
```

Then apply the hash:

```sql
UPDATE operators
SET password_hash = '$argon2id$v=19$...<paste hash here>...',
    updated_date = NOW(),
    updated_by = 'manual-reset'
WHERE login = 'your-login';
```

To create a new operator row entirely (for initial seeding):

```sql
-- First generate a hash as shown above, then:
SELECT * FROM sp_operators_insert(
    'new-login',
    '$argon2id$v=19$...<paste hash>...',
    'Full Name',
    'email@example.com',
    true,
    'system'
);
```

---

## 5. Vault Issues

### 5.1 Vault Bootstrap Fails (Already Bootstrapped)

`sp_vault_bootstrap` uses an advisory lock and checks `WHERE wrapped_rvk IS NOT NULL`. If it returns `o_success = false`, the vault is already bootstrapped.

```sql
SELECT id, is_bootstrapped, bootstrap_date, (wrapped_rvk IS NOT NULL) AS has_rvk
FROM vault_state;
```

If you need to re-bootstrap (development only — destroys all secrets), delete the `vault_state` row and all `secret_records`:

```sql
-- WARNING: deletes all stored secrets
DELETE FROM secret_records;
DELETE FROM vault_state;
```

Then navigate to `/dashboard/settings/vault/bootstrap` to run the bootstrap wizard again.

### 5.2 "Master Password Incorrect" on Unlock

The unlock flow derives a key from the master password + the KDF salt stored in `vault_state` using Argon2id, then attempts to unwrap the root vault key using AES-256-GCM. An auth tag mismatch means the password is wrong.

- Verify you are using the exact password set during bootstrap (case-sensitive, no leading/trailing spaces).
- If the password is genuinely forgotten, there is no recovery path — the vault must be reset (§5.1), which destroys all secrets. Re-enter all secrets after reset.

Check the KDF parameters stored (for debugging — not the password):

```sql
SELECT kdf_algorithm, kdf_memory, kdf_iterations, kdf_parallelism,
       length(kdf_salt) AS salt_bytes,
       length(wrapped_rvk) AS rvk_bytes
FROM vault_state;
```

### 5.3 Secret Retrieval Fails After Vault Unlock

Symptoms: API calls that need secrets return 401 or a vault-related error even though the UI shows the vault as unlocked.

The vault unlock session is stored in `vault_unlock_sessions`. Each row has an `expires_date` (default TTL: `VAULT_UNLOCK_TTL_SECONDS`, default 1800 seconds) and resets on activity (`VAULT_UNLOCK_IDLE_RESET_SECONDS`, default 300 seconds).

```sql
SELECT id, operator_session_id, created_date, last_activity_date, expires_date, is_active
FROM vault_unlock_sessions
WHERE is_active = true
ORDER BY created_date DESC;
```

If the row is expired or absent, unlock the vault again at `/dashboard/settings/vault`.

### 5.4 Vault Bootstrap Required Error

Symptom: UI shows a banner saying vault bootstrap is required, or API calls return a "vault not bootstrapped" error.

```sql
SELECT (wrapped_rvk IS NOT NULL) AS bootstrapped FROM vault_state LIMIT 1;
```

If the query returns no rows, or `bootstrapped = false`, navigate to `/dashboard/settings/vault/bootstrap` and complete the wizard.

### 5.5 Verify Vault State in DB

```sql
SELECT
    id,
    is_bootstrapped,
    bootstrap_date,
    bootstrap_operator_id,
    kdf_algorithm,
    kdf_memory,
    kdf_iterations,
    kdf_parallelism,
    (kdf_salt IS NOT NULL)    AS has_salt,
    (wrapped_rvk IS NOT NULL) AS has_wrapped_rvk,
    (nonce IS NOT NULL)       AS has_nonce,
    master_password_last_changed
FROM vault_state;
```

Full stored procedure call (returns the same but only non-sensitive fields):

```sql
SELECT * FROM sp_vault_state_get();
```

---

## 6. Site & Environment Issues

### 6.1 Site Not Appearing in Run Wizard

The run wizard only shows sites where `is_active = true` and at least one `site_environments` row with `is_active = true` exists.

```sql
-- Check site status
SELECT id, name, is_active FROM sites ORDER BY name;

-- Check environments for a site
SELECT se.id, se.name, se.base_url, se.is_active
FROM site_environments se
JOIN sites s ON s.id = se.site_id
WHERE s.name = 'Your Site Name';
```

Fix inactive site:

```sql
UPDATE sites SET is_active = true, updated_date = NOW() WHERE name = 'Your Site Name';
```

Fix inactive environment:

```sql
UPDATE site_environments SET is_active = true, updated_date = NOW() WHERE id = <env_id>;
```

### 6.2 Environment Base URL Mismatch Errors

The `base_url` in `site_environments` is passed directly to the runner as the root URL for Playwright navigation. Common issues:

- Trailing slash inconsistency: the runner constructs paths by appending to `base_url`. Ensure the stored URL does not have a trailing slash unless the site requires it.
- Protocol mismatch: `http://` vs `https://` — Playwright will follow the URL as given.
- Internal Docker network resolution: when running inside Docker, the runner uses the URL stored in the DB. If that URL is a public hostname (`https://staging.example.com`), the runner container must be able to reach it. If the target is another container, use the Docker network service name (e.g., `http://my-app:3001`).

```sql
SELECT name, base_url FROM site_environments WHERE site_id = <site_id>;
```

### 6.3 Credential Binding Missing

Symptoms: runner logs show "no credential found for role" or a flow step fails at login because credentials are not injected.

Credential bindings are stored in `site_credentials`. Each row maps `(site_id, site_environment_id, role_name)` to a `secret_id`.

```sql
-- List all credential bindings for a site/environment
SELECT sc.id, sc.role_name, sc.is_active, sr.name AS secret_name
FROM site_credentials sc
JOIN secret_records sr ON sr.id = sc.secret_id
WHERE sc.site_id = <site_id>
  AND sc.site_environment_id = <env_id>;
```

If the binding is missing, add it via `/dashboard/sites/<id>/credentials` or directly:

```sql
SELECT * FROM sp_site_credentials_insert(
    <site_id>,
    <env_id>,
    'registrant',
    <secret_id>,
    'Test registrant credentials',
    'system'
);
```

If `is_active = false`, re-enable:

```sql
UPDATE site_credentials SET is_active = true, updated_date = NOW() WHERE id = <id>;
```

### 6.4 Email Inbox Not Bound to Environment

Email validation requires a binding in `site_env_email_bindings`.

```sql
SELECT seeb.id, seeb.role_tag, seeb.is_active, ei.name AS inbox_name, ei.host, ei.port
FROM site_env_email_bindings seeb
JOIN email_inboxes ei ON ei.id = seeb.email_inbox_id
WHERE seeb.site_id = <site_id>
  AND seeb.site_environment_id = <env_id>;
```

If no binding exists, create it via `/dashboard/settings/email-inboxes` → "Bind to Environment", or:

```sql
SELECT * FROM sp_site_env_email_bindings_insert(
    <site_id>, <env_id>, <inbox_id>, 'email_validator', 'Description', 'system'
);
```

---

## 7. Runner / Playwright Issues

### 7.1 Runner Container Not Reachable from Dashboard

The dashboard calls the runner at `RUNNER_API_BASE_URL` (default `http://runner:4000`). Both containers must be on `qa-platform-network`.

```bash
# Test from dashboard container
docker exec qa-platform-dashboard curl -s http://runner:4000/health

# Test from host
curl -s http://localhost:4000/health
```

Expected response:

```json
{"status":"healthy","service":"runner","busy":false,"active_run_id":null}
```

If the runner is not reachable from the dashboard container:
- Verify both containers are on the same network: `docker network inspect qa-platform-network`
- Verify `RUNNER_API_BASE_URL` in the dashboard env uses the internal service name (`runner`), not `localhost`.

### 7.2 Playwright Browser Launch Fails

Symptom: runner logs show `browserType.launch: Executable doesn't exist at ...` or `Error: spawn /usr/bin/... ENOENT`.

The runner Dockerfile uses `mcr.microsoft.com/playwright:v1.48.0-jammy` as base, which includes all three browser binaries (Chromium, Firefox, WebKit). If you see a binary missing error, the most likely causes are:

- The image was built from a cache layer before the Playwright base image was used, or a different base was set. Rebuild cleanly:

```bash
docker compose build --no-cache runner
docker compose up -d runner
```

- The runner binary was copied from the build stage but the browser dependencies were not (only occurs if the Dockerfile was modified to use a non-Playwright base for the final stage). Do not change the base image.

Verify installed browsers inside the container:

```bash
docker exec qa-platform-runner npx playwright --version
docker exec qa-platform-runner ls /ms-playwright/
```

### 7.3 Flow Times Out (Selector Not Found)

Symptoms: runner logs show `Timeout: Locator.click: Timeout 30000ms exceeded`, or a step is recorded as `failed` with an element selector error.

Diagnosis:
1. Check the site rules file `sites/<site_id>/flows/index.ts` — verify the selectors match the current live site markup.
2. Check if the base URL environment points to the correct environment (staging vs production URLs can differ in UI structure).
3. Check network throttling: if the persona uses a `network_profile` with very low bandwidth (e.g., "2G Slow"), page load may exceed the default Playwright timeout. Adjust the timeout in the flow definition or reduce throttling.

```sql
-- Check what network profile was used for the failing execution
SELECT re.id, re.browser, np.name AS network_profile, np.download_throughput, re.error_message
FROM run_executions re
JOIN network_profiles np ON np.id = re.network_profile_id
WHERE re.run_id = <run_id>
  AND re.status = 'failed';
```

### 7.4 Selector Healing Triggered

When selector healing fires (LLM `task_type = 'selector_healing'`), it means the runner could not find an element with the stored selector and the Ollama LLM suggested an alternative. This is a signal that the site's markup has changed.

```sql
SELECT lar.id, lar.status, lar.model_used, lar.result_json, lar.duration_ms
FROM llm_analysis_results lar
JOIN run_executions re ON re.id = lar.run_execution_id
WHERE lar.task_type = 'selector_healing'
  AND re.run_id = <run_id>;
```

Review the `result_json` to see the suggested replacement selector. Update the site rules file with the new selector and commit. The runner cache TTL is 5 minutes in production — flows will be picked up without a restart.

### 7.5 Persona-Driven Behavior Unexpected

The persona engine (in `@qa-platform/playwright-core`) drives typing speed, hesitation delays, and network throttling. If a flow behaves unexpectedly slowly or triggers friction signals:

- Check which persona was used: `SELECT persona_id FROM run_executions WHERE id = <exec_id>;`
- Review persona definitions in `packages/personas/src/` — each persona has typing delay, hesitation probability, and network throttle parameters.
- Friction signals for the execution:

```sql
SELECT signal_type, step_name, occurred_at, metadata
FROM friction_signals
WHERE run_execution_id = <exec_id>
ORDER BY occurred_at;
```

### 7.6 Callback Token Expired or Invalid

Each execution receives a one-time `callback_token` stored in `run_executions.callback_token`. The runner includes this token in its POST to the dashboard callback URL. The dashboard validates it via the procedure.

If the dashboard rejects the callback:
- The token may have been used already (each callback that succeeds clears or marks the token).
- The run was aborted, invalidating the token.
- The callback URL contains the wrong host (check `RUNNER_API_BASE_URL` and callback URL construction in the dashboard run start action).

```sql
SELECT id, status, callback_token IS NOT NULL AS has_token
FROM run_executions
WHERE run_id = <run_id>
ORDER BY id;
```

### 7.7 Run Stays in "Running" Status Indefinitely — How to Abort

The runner exposes a `POST /abort` endpoint. If the runner is still alive:

```bash
# Get active run id from runner status
curl -s http://localhost:4000/status | jq .

# Abort it
curl -s -X POST http://localhost:4000/abort \
  -H "Content-Type: application/json" \
  -d '{"run_id": <run_id>}'
```

If the runner container crashed (no response on port 4000), the run will remain in `running` status in the DB. Manually mark it aborted:

```sql
-- Mark the parent run aborted
UPDATE runs
SET status = 'aborted',
    completed_at = NOW(),
    updated_date = NOW(),
    updated_by = 'manual-abort'
WHERE id = <run_id> AND status = 'running';

-- Mark any queued or running executions aborted
UPDATE run_executions
SET status = 'aborted',
    completed_at = NOW(),
    updated_date = NOW(),
    updated_by = 'manual-abort'
WHERE run_id = <run_id>
  AND status IN ('queued', 'running');
```

Then restart the runner:

```bash
docker compose restart runner
```

---

## 8. Email Validation Issues

### 8.1 Email Not Received Within Timeout

The email validation waiter polls the IMAP inbox up to `wait_timeout_ms` (configurable per run). If it times out:

```sql
SELECT id, status, correlation_token, wait_until, poll_count, received_at, error_message
FROM email_validation_runs
WHERE run_execution_id = <exec_id>;
```

Check steps:
1. Was the email actually sent by the site? Check the site's SMTP logs or outbox.
2. Is the correlation token embedded correctly in the test email address? The runner constructs the address as `<base>+<correlation_token>@<domain>`.
3. Is the IMAP inbox reachable from the runner container (§8.2)?
4. Is Mailcatcher running if using dev profile (§8.4)?

### 8.2 IMAP Connection Refused or Auth Failure

```bash
# Test IMAP reachability from runner container
docker exec qa-platform-runner nc -zv <imap_host> <imap_port>

# For Mailcatcher (port 1080 is HTTP UI, 1025 is SMTP only)
# Mailcatcher provides no IMAP — use port 1080 HTTP API for inspection
curl http://localhost:1080/messages
```

For a real IMAP inbox, auth failures usually mean:
- Password stored in vault is incorrect.
- Gmail/Outlook requires an app-specific password rather than account password.
- TLS mismatch: `use_tls = true` but server expects STARTTLS (or vice versa).

Check inbox config:

```sql
SELECT name, host, port, use_tls, username FROM email_inboxes WHERE id = <inbox_id>;
```

### 8.3 Email Matched Wrong Run (Correlation Token Missing)

Each email validation run generates a unique `correlation_token` stored in `email_validation_runs`. This token is appended to the test email address so the platform can match replies to the correct execution.

If emails are being matched to the wrong run or not matched at all:
- Verify the flow is passing the correlation token to the form's email field.
- Verify the IMAP filter in the `@qa-platform/email` package is filtering by the `+token` suffix correctly.
- Check `email_validation_runs.correlation_token` for the failing execution and search your inbox manually for that token.

### 8.4 Mailcatcher Not Running (Profile Not Enabled)

Mailcatcher is only started when the `dev` profile is active.

```bash
# Start mailcatcher
docker compose --profile dev up -d mailcatcher

# Verify it's running
docker compose ps mailcatcher

# Browse captured emails (HTTP API)
curl http://localhost:1080/messages
```

The Mailcatcher web UI is at `http://localhost:1080`. SMTP port is 1025 (no auth, no TLS). Email inboxes configured for Mailcatcher should use `host: mailcatcher` (Docker service name) and `port: 1025` from within the Docker network.

### 8.5 Testing IMAP Connection Manually

```bash
# From inside the runner container, using openssl for TLS
docker exec -it qa-platform-runner openssl s_client -connect <imap_host>:993

# Non-TLS (port 143)
docker exec -it qa-platform-runner nc -v <imap_host> 143

# After connecting, send IMAP LOGIN command:
# A001 LOGIN username password
# A002 LIST "" "*"
# A003 LOGOUT
```

---

## 9. LLM / Ollama Issues

### 9.1 Ollama Not Reachable

Ollama is only started when the `llm` profile is active.

```bash
# Start Ollama
docker compose --profile llm up -d ollama

# Verify the API is up
curl http://localhost:11434/api/tags
```

From inside another container (using internal network):

```bash
docker exec qa-platform-runner curl -s http://ollama:11434/api/tags
```

If `OLLAMA_ENABLED=false` in `.env`, the LLM integration is disabled regardless of whether the container is running. Set `OLLAMA_ENABLED=true` and `OLLAMA_BASE_URL=http://ollama:11434` to enable it.

### 9.2 Model Not Downloaded

Models are stored in the `ollama_models` named volume. If the container was rebuilt or the volume was recreated, models must be re-pulled.

```bash
# Pull the fast model (used for selector healing)
docker exec qa-platform-ollama ollama pull llama3.1:8b

# Pull the rich model (used for failure summarization)
docker exec qa-platform-ollama ollama pull qwen2.5:14b

# List currently available models
docker exec qa-platform-ollama ollama list
```

Models configured via `.env`:
- `OLLAMA_FAST_MODEL` — used for selector healing (latency-sensitive)
- `OLLAMA_RICH_MODEL` — used for failure summarization (quality-sensitive)

### 9.3 Analysis Timeout — Model Too Slow for Hardware

Symptoms: `llm_analysis_results` rows with `status = 'error'` and `error_message` containing a timeout.

The LLM calls are non-blocking — they do not affect execution status. However, slow models increase overall run completion time.

```sql
SELECT model_used, task_type, status, duration_ms, error_message
FROM llm_analysis_results
WHERE status IN ('error', 'completed')
ORDER BY created_date DESC
LIMIT 20;
```

Mitigation options:
- Switch to a smaller fast model: set `OLLAMA_FAST_MODEL=llama3.2:3b` for lower-end hardware.
- Run a benchmark to measure latency:

```bash
# Via dashboard: /dashboard/settings/llm → "Run Benchmark"
# Results will appear in llm_benchmark_results
```

### 9.4 Interpreting Benchmark Results

```sql
SELECT run_at, model_id, task_type, available, latency_ms, response_parseable, quality_score, error_message
FROM llm_benchmark_results
ORDER BY run_at DESC, model_id, task_type;
```

- `quality_score` is 0–1. Scores below 0.5 indicate the model's output is not reliably parseable for the given task type — consider a different model.
- `latency_ms` above 30000 for selector healing indicates the model is too slow for interactive use. Failure summarization can tolerate higher latency.

---

## 10. API Testing Issues

### 10.1 API Test Suite Fails with Connection Refused

The runner executes API tests against the site's `base_url` after the browser flow completes. If the target site is unreachable from the runner container:

```bash
docker exec qa-platform-runner curl -s -o /dev/null -w "%{http_code}" <base_url>/health
```

Causes:
- The site is down in the target environment.
- The `base_url` in `site_environments` points to `localhost` or a Mac host address — use `host.docker.internal` if the site runs on the host:

```sql
UPDATE site_environments
SET base_url = 'http://host.docker.internal:<port>',
    updated_date = NOW()
WHERE id = <env_id>;
```

Check the failing suite and assertions:

```sql
SELECT ats.suite_type, ats.status, ats.error_message,
       ata.assertion_name, ata.status, ata.response_status, ata.error_message
FROM api_test_suites ats
JOIN api_test_assertions ata ON ata.api_test_suite_id = ats.id
WHERE ats.run_execution_id = <exec_id>
ORDER BY ats.suite_type, ata.id;
```

### 10.2 Schema Validation Mismatch

Symptom: `api_test_assertions` rows with `status = 'failed'`, `assertion_name` ending in `_schema_valid`, and `actual_value` showing unexpected fields.

The API endpoints file at `sites/<site_id>/api-endpoints.ts` defines expected response shapes. If the site's API response structure changed:

- Update `sites/<site_id>/api-endpoints.ts` with the corrected schema definition.
- The runner picks up the new file within the cache TTL (5 minutes in production, 30 seconds in development).
- No restart required.

### 10.3 Business Rule Assertion Failures

Business rule assertions reference values defined in `sites/<site_id>/rules.ts`. If an assertion fails because the expected business constraint no longer matches the site's actual behavior, update the rules file:

- Edit `sites/<site_id>/rules.ts` with the corrected values.
- Commit the change.
- Re-run the affected run or trigger a new run.

The `rules` package (`packages/rules/`) loads site rules from the `sites/` directory. Changes are picked up within the cache TTL without a runner restart.

---

## 11. Reporting Issues

### 11.1 Report Shows No Data

Symptoms: the report page for a run shows empty charts or "no executions found".

```sql
-- Verify the run completed and has executions
SELECT r.id, r.status, r.total_executions, r.successful_executions, r.failed_executions,
       count(re.id) AS actual_exec_count
FROM runs r
LEFT JOIN run_executions re ON re.run_id = r.id
WHERE r.id = <run_id>
GROUP BY r.id, r.status, r.total_executions, r.successful_executions, r.failed_executions;
```

If `actual_exec_count = 0`, the run was created but executions were never materialized (dashboard failed before calling the runner, or the run was aborted at creation).

If `status = 'running'`, the run has not completed — see §7.7 to determine if it needs to be manually aborted.

### 11.2 Narrative Report Missing Sections

The narrative report is generated by `@qa-platform/reporting` and uses Ollama for LLM-generated summaries. If sections are empty:

- **LLM summary section empty**: `OLLAMA_ENABLED=false` or Ollama container not running (§9.1). Enable Ollama and re-trigger report generation.
- **Failures section missing**: No executions have `status = 'failed'` in this run. Only failed executions generate failure narratives.
- **Step detail section missing**: `run_steps` rows were not written (runner callback failed mid-run). Check runner logs for callback errors.

```sql
SELECT status, count(*) FROM run_executions WHERE run_id = <run_id> GROUP BY status;
SELECT count(*) FROM run_steps WHERE run_execution_id IN (
    SELECT id FROM run_executions WHERE run_id = <run_id>
);
```

### 11.3 Accessibility Summary Empty

Accessibility checks run as part of each flow step via `runner.checkAccessibility()`. Results are stored in `run_steps.details` as JSON.

If the accessibility summary is empty:
- Verify the flow definitions call `checkAccessibility()`.
- Check `run_steps` for the execution to see if steps recorded accessibility data:

```sql
SELECT step_name, status, details
FROM run_steps
WHERE run_execution_id = <exec_id>
  AND details IS NOT NULL
ORDER BY step_order;
```

The `@qa-platform/accessibility` package aggregates ARIA violations. If `details` is empty for all steps, the accessibility checks are either not wired into the flow or silently failing.

---

## 12. Artifact Retention / Cleanup Issues

### 12.1 Expired Artifacts Not Being Cleaned Up

The cleanup job lives at `apps/runner/src/cleanup-job.ts`. It queries the `artifacts` table for rows where `retention_date < NOW()` and deletes the files from disk, then removes the DB row.

Verify there are expired artifacts in the DB:

```sql
SELECT id, artifact_type, file_path, retention_date, file_size_bytes
FROM artifacts
WHERE retention_date < NOW()
ORDER BY retention_date
LIMIT 20;
```

If expired rows exist but files are not being deleted, the cleanup job is not running. Check runner logs:

```bash
docker compose logs --tail=200 runner | grep -i cleanup
```

Retention periods are configured via env vars (defaults from `.env.example`):

| Env Var | Default |
|---|---|
| `ARTIFACT_RETENTION_TRACE_DAYS` | 30 |
| `ARTIFACT_RETENTION_VIDEO_DAYS` | 30 |
| `ARTIFACT_RETENTION_SCREENSHOT_DAYS` | 90 |
| `ARTIFACT_RETENTION_HAR_DAYS` | 30 |
| `ARTIFACT_RETENTION_LOG_DAYS` | 90 |
| `ARTIFACT_RETENTION_MP4_DAYS` | 180 |
| `ARTIFACT_RETENTION_RECORD_DAYS` | 365 |

### 12.2 Cleanup Job Errors — File Permission / Already Deleted

If the cleanup job logs `ENOENT` (file not found) or `EACCES` (permission denied):

- **ENOENT**: The artifact file was already deleted from disk (manual cleanup, volume reset) but the DB row was not removed. Safe to clean up the orphaned DB rows:

```sql
-- Identify orphaned rows (files that no longer exist)
-- Manual step: compare file_path column values against what's on disk
-- Then remove specific orphaned rows:
DELETE FROM artifacts WHERE id IN (<list of orphaned ids>);
```

- **EACCES**: The runner container user (UID 1001) does not have write permission on the artifacts directory. Check the volume mount:

```bash
docker exec qa-platform-runner ls -la /artifacts
```

The `artifacts/` directory in the repo root is mounted into the runner. Ensure it is owned or writable by UID 1001, or change the mount permissions.

### 12.3 Manually Triggering Cleanup

There is no HTTP endpoint to trigger cleanup on demand. To run it manually:

```bash
# Execute a one-off node command in the runner container
docker exec qa-platform-runner node -e "
  require('./dist/cleanup-job.js').runCleanup().then(() => console.log('done'));
"
```

If the cleanup job module is not directly importable this way, restart the runner — the cleanup job runs on startup or on its scheduled interval.

### 12.4 Verify Retention Config in DB

Retention dates are written to `artifacts.retention_date` at insertion time based on the env var values active when the artifact was stored.

```sql
-- Overview of artifact counts and upcoming expirations
SELECT artifact_type,
       count(*) AS total,
       count(*) FILTER (WHERE retention_date < NOW()) AS expired,
       count(*) FILTER (WHERE retention_date BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS expiring_7d,
       sum(file_size_bytes) AS total_bytes
FROM artifacts
GROUP BY artifact_type
ORDER BY artifact_type;
```

---

## 13. Performance Issues

### 13.1 Dashboard Slow to Load

Symptoms: page load times > 2 seconds for list pages (runs, sites, executions).

First check: is it the database or the Next.js SSR?

```bash
# Time a DB query directly
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform \
  -c "EXPLAIN ANALYZE SELECT * FROM sp_sites_list_with_counts();"
```

Common causes:
- **N+1 queries**: The dashboard fetches a list, then calls a proc for each item. Look for repeated calls to `sp_runs_get_by_id` or similar in the Postgres query log.
- **Missing index**: Check `pg_stat_user_indexes` for low `idx_scan` counts on tables you query frequently.
- **Large JSONB columns**: `runs.config` is a JSONB column. If you are selecting `*` across many run rows, the config blob inflates payload size. Select only needed columns.

Enable Postgres slow query logging temporarily:

```sql
-- Set inside the session (does not persist)
SET log_min_duration_statement = 500; -- log queries over 500ms
```

Then tail Postgres logs:

```bash
docker compose logs -f postgres
```

### 13.2 Runner Memory Usage High

The runner enforces a concurrency cap via `RUNNER_CONCURRENCY` (default 4, from `parseConcurrencyCap()` in `execution-manager.ts`). Each parallel execution launches a browser instance. On Mac with Docker Desktop, the default memory limit for Docker may be too low.

Check current memory:

```bash
docker stats qa-platform-runner --no-stream
```

Options:
- Reduce concurrency: set `RUNNER_CONCURRENCY=2` in `.env` and restart runner.
- Increase Docker Desktop memory allocation: Docker Desktop → Settings → Resources → Memory.
- If using `webkit` browser, note it is the heaviest in memory. Exclude it from run configs if memory is constrained.

### 13.3 Checking Active DB Connections

```sql
-- Total connections by state
SELECT state, count(*)
FROM pg_stat_activity
WHERE datname = 'qa_platform'
GROUP BY state;

-- Long-running queries (over 5 seconds)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE datname = 'qa_platform'
  AND (now() - pg_stat_activity.query_start) > INTERVAL '5 seconds'
ORDER BY duration DESC;

-- Kill a specific connection
SELECT pg_terminate_backend(<pid>);
```

---

## 14. Common Error Messages Reference

| Error Message | Service | Meaning | Fix |
|---|---|---|---|
| `DASHBOARD_SESSION_SECRET is required` | dashboard-web | Missing required env var at startup | Set `DASHBOARD_SESSION_SECRET` in `.env` (min 32 chars) |
| `function sp_xxx_yyy does not exist` | dashboard-web / runner | Stored procedure not applied | Re-run migrator; check `schema_migrations` |
| `remaining connection slots are reserved` | postgres | Connection pool exhausted | Restart services; lower `RUNNER_CONCURRENCY` |
| `Error: timeout exceeded when trying to connect` | any → postgres | Pool connection timeout (2s default) | Restart postgres; check connection counts |
| `relation "xxx" already exists` | migrator | Schema created outside migration runner | Insert version into `schema_migrations` and skip |
| `pg_isready: no response` | postgres healthcheck | Postgres not yet initialized or crashed | Check `docker compose logs postgres`; reset volume if corrupted |
| `A run is already in progress` (HTTP 409) | runner `/run` | Runner singleton is busy | Wait for current run to finish; or abort via `POST /abort` |
| `No active run to abort` (HTTP 404) | runner `/abort` | No run in progress when abort was sent | Run already completed or was never started |
| `Invalid site ID: "..."` | runner | Site ID failed alphanumeric validation | Fix site ID — only `a-z`, `0-9`, hyphens, underscores allowed |
| `Path traversal detected` | runner | Site ID contains `..` or similar | Fix site ID in run request |
| `browserType.launch: Executable doesn't exist` | runner | Playwright browser binary not found in image | Rebuild runner image with `--no-cache` |
| `Vault not bootstrapped` | dashboard-web | `vault_state` has no bootstrapped row | Navigate to `/dashboard/settings/vault/bootstrap` |
| `Master password incorrect` | dashboard-web | Argon2id key derivation mismatch | Use correct master password; no recovery if forgotten |
| `Vault unlock session expired` | dashboard-web | `vault_unlock_sessions` row past `expires_date` | Unlock vault again at `/dashboard/settings/vault` |
| `Callback token invalid` | dashboard-web (callback) | Runner posted with expired or missing token | Check `run_executions.callback_token`; restart run |
| `ECONNREFUSED` (API test) | runner | Target site unreachable from runner container | Fix `base_url`; use `host.docker.internal` for host-local services |
| `ENOENT` (cleanup job) | runner | Artifact file missing from disk | Delete orphaned `artifacts` DB row |
| `EACCES` (cleanup job) | runner | Artifacts directory not writable by runner UID | Fix volume permissions for UID 1001 |
| `ollama: model not found` | runner | Model not pulled into Ollama container | Run `docker exec qa-platform-ollama ollama pull <model>` |

---

## 15. Escalation Checklist

Before escalating an issue, capture all of the following:

### Logs

```bash
# All relevant services — last 500 lines each
docker compose logs --tail=500 postgres     > logs-postgres.txt
docker compose logs --tail=500 migrator     > logs-migrator.txt
docker compose logs --tail=500 dashboard-web > logs-dashboard.txt
docker compose logs --tail=500 runner       > logs-runner.txt

# If Ollama or Mailcatcher is involved
docker compose --profile llm logs --tail=200 ollama > logs-ollama.txt
docker compose --profile dev logs --tail=200 mailcatcher > logs-mailcatcher.txt
```

### DB State

```bash
docker exec -it qa-platform-postgres psql -U qa_user -d qa_platform <<'EOF'
-- Applied migrations
SELECT version, applied_at FROM schema_migrations ORDER BY version;

-- Vault state
SELECT id, is_bootstrapped, (wrapped_rvk IS NOT NULL) AS has_rvk FROM vault_state;

-- Active sessions
SELECT count(*) AS active_operator_sessions FROM operator_sessions WHERE is_active = true;
SELECT count(*) AS active_vault_sessions FROM vault_unlock_sessions WHERE is_active = true;

-- Active connections
SELECT state, count(*) FROM pg_stat_activity WHERE datname='qa_platform' GROUP BY state;

-- Recent runs
SELECT id, status, started_at, completed_at FROM runs ORDER BY id DESC LIMIT 5;
EOF
```

### Container State

```bash
docker compose ps -a
docker stats --no-stream
docker volume ls | grep qa-platform
docker network inspect qa-platform-network
```

### Environment Variables

```bash
# Redact secrets before sharing — show only keys with non-empty values
docker compose exec dashboard-web env | grep -v PASSWORD | grep -v SECRET | grep -v HASH | sort
```

### Reproduction Steps

Include the following in the escalation:

1. Exact sequence of actions taken (run ID, site ID, environment, persona, browser).
2. Exact error message and which UI page or API call produced it.
3. Timestamp of the failure (UTC preferred).
4. Whether the issue is reproducible consistently or intermittent.
5. Any recent changes to: `.env`, `docker-compose.yml`, site flow files, migration files, or platform code.
6. Docker Desktop version and available RAM/CPU allocation.

### Key IDs to Capture

```sql
-- For a failing run
SELECT r.id AS run_id, r.status, re.id AS exec_id, re.status AS exec_status,
       re.persona_id, re.browser, re.flow_name, re.error_message
FROM runs r
JOIN run_executions re ON re.run_id = r.id
WHERE r.id = <run_id>
ORDER BY re.id;
```
