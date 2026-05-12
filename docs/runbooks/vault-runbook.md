# Vault Operations Runbook

**System:** QA Automation Platform  
**Component:** `@qa-platform/vault`  
**Last Updated:** 2025-07-12  
**ADR References:** [ADR 003 — Vault Cryptography](../decisions/003-vault-cryptography.md), [ADR 007 — Vault Operations Policy](../decisions/007-vault-operations-policy.md)

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [First-Time Bootstrap Procedure](#2-first-time-bootstrap-procedure)
3. [Daily Unlock Procedure](#3-daily-unlock-procedure)
4. [Manual Lock Procedure](#4-manual-lock-procedure)
5. [Master Password Rotation](#5-master-password-rotation)
6. [KDF Parameter Upgrade](#6-kdf-parameter-upgrade)
7. [Emergency Lock-Out Recovery](#7-emergency-lock-out-recovery)
8. [Secret Management Operations](#8-secret-management-operations)
9. [Monitoring & Alerting](#9-monitoring--alerting)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview & Architecture

The vault secures all sensitive credentials (API keys, passwords, payment tokens) stored for test site automation by encrypting them at rest with a key hierarchy derived from a master password that is never stored anywhere. At runtime, an operator unlocks the vault by supplying the master password, which reconstructs the in-memory root key that test runners use — via a brokered call — to decrypt individual secrets on demand.

### Key Components

| Component | Implementation | Location |
|---|---|---|
| Key Derivation Function (KDF) | Argon2id | `packages/vault/src/crypto.ts` → `deriveKEK()` |
| Symmetric encryption | AES-256-GCM | `packages/vault/src/crypto.ts` → `encrypt()` / `decrypt()` |
| Key wrapping | AES-256-GCM envelope | `packages/vault/src/crypto.ts` → `wrapKey()` / `unwrapKey()` |
| In-memory key registry | `UnlockSessionRegistry` singleton | `packages/vault/src/registry.ts` |
| Vault API surface | `bootstrapVault`, `unlockVault`, `lockVault`, `encryptSecret`, `decryptSecret` | `packages/vault/src/vault.ts` |
| Server Actions (UI layer) | `bootstrapVaultAction`, `unlockVaultAction`, `lockVaultAction` | `apps/dashboard-web/app/actions/vault.ts` |

### Key Hierarchy

```
Master Password (never stored)
        │
        ▼  Argon2id KDF  (salt stored in vault_state.kdf_salt)
        │
  Key Encryption Key (KEK, 256-bit)   ← ephemeral, zeroized immediately after use
        │
        ▼  AES-256-GCM wrap  (nonce + ciphertext stored in vault_state)
        │
  Root Vault Key (RVK, 256-bit)       ← held in process memory only, in UnlockSessionRegistry
        │
        ├──▼  AES-256-GCM wrap  (per-secret wrap_nonce + wrapped_dek in secret_records)
        │
        │   Data Encryption Key (DEK, 256-bit, one per secret)  ← ephemeral, zeroized after use
        │         │
        │         ▼  AES-256-GCM encrypt  (nonce + encrypted_payload in secret_records)
        │
        └──▶  Encrypted secret ciphertext
```

### What Lives Where

| Data | Storage Location | Notes |
|---|---|---|
| `kdf_salt` (16 bytes) | `vault_state.kdf_salt` (DB) | Needed to re-derive KEK on unlock |
| `nonce` (12 bytes) | `vault_state.nonce` (DB) | Nonce used when wrapping the RVK |
| `wrapped_rvk` (48 bytes) | `vault_state.wrapped_rvk` (DB) | AES-256-GCM ciphertext + 16-byte auth tag |
| `aad` | `vault_state.aad` (DB) | Fixed string `qa-platform-vault-v1` |
| KDF parameters | `vault_state.kdf_memory/iterations/parallelism` (DB) | Used to reproduce exact KEK on unlock |
| RVK (plaintext) | Process memory only, `UnlockSessionRegistry` | **Never written to disk** |
| KEK (plaintext) | Process memory only, `deriveKEK()` return value | Zeroized immediately after wrapping/unwrapping RVK |
| DEK (plaintext) | Process memory only, inside `encryptSecret()`/`decryptSecret()` callbacks | Zeroized via `zeroize()` in `finally` block |
| Master password (plaintext) | Never stored anywhere | Not logged, not persisted |
| Secret ciphertext | `secret_records.encrypted_payload` (DB) | Always encrypted; plaintext never stored |
| Secret DEK (wrapped) | `secret_records.wrapped_dek` (DB) | Wrapped with RVK; useless without in-memory RVK |

### Security Invariants

These properties are guaranteed by the code and must never be violated by operational changes:

- **The master password is never stored** — not in the database, not in logs, not in environment variables.
- **The RVK is never written to disk** — it exists only in the `UnlockSessionRegistry` Map in the Node.js process heap.
- **The KEK is ephemeral** — derived in `deriveKEK()`, used immediately, and zeroized via `zeroize(kek)` before `unlockVault()` returns.
- **Per-secret DEKs are ephemeral** — generated in `encryptSecret()` and zeroized in the `finally` block of `decryptSecret()`.
- **Plaintext secrets are never stored** — `secret_records.encrypted_payload` contains only AES-256-GCM ciphertext.
- **Every secret access is logged** — decrypt-for-run events write to `secret_access_logs`.

---

## 2. First-Time Bootstrap Procedure

Bootstrap is a one-time, irreversible operation that initializes the vault. It can only be performed once per database; attempting it a second time returns `{ success: false }` immediately (enforced by `sp_vault_bootstrap` advisory lock on `vault_bootstrap`).

### Prerequisites

- At least one operator account must exist in the `operators` table.
- The operator performing bootstrap must be authenticated (active session in `operator_sessions`).
- The `@qa-platform/vault` package must be reachable from the dashboard-web process.
- The database must be migrated through at minimum `0002_system_vault_audit_tables.sql` and `0032_sp_vault_bootstrap.sql`.

### Procedure

**Step 1 — Verify vault is not already bootstrapped**

```sql
SELECT * FROM sp_vault_state_get();
-- o_is_bootstrapped must be FALSE. If TRUE, stop — perform password rotation instead.
```

**Step 2 — Navigate to the bootstrap page**

Open a browser and go to:
```
/dashboard/settings/vault/bootstrap
```

The page checks `getVaultStateAction()` on load and redirects to `/dashboard/settings/vault` if the vault is already bootstrapped. If you are redirected, do not re-bootstrap — rotate the password instead (see Section 5).

**Step 3 — Choose a strong master password**

Requirements enforced by the UI and `bootstrapVaultAction()`:
- Minimum length: **12 characters** (`VAULT_MASTER_PASSWORD_MIN_LENGTH`, default `12`).
- Use a passphrase of 4+ random words, or a random 20+ character string with mixed case, digits, and symbols.
- Do not use a password used for any other system.
- Do not use personal information (names, dates, addresses).

Recommendations:
- Use a hardware password manager (e.g., 1Password, Bitwarden) to generate and store the password.
- A physical backup (written on paper, stored in a fireproof safe) is strongly recommended in addition to the digital copy.

**Step 4 — Enter and confirm the password, then click "Bootstrap Vault"**

The form submits to `bootstrapVaultAction(masterPassword, confirmPassword)`, which calls `bootstrapVault(masterPassword, operatorId, sessionId)` from `@qa-platform/vault`.

**What happens internally during bootstrap** (`bootstrapVault()` in `vault.ts`):

1. Calls `sp_vault_state_get()` — confirms vault is not yet bootstrapped.
2. Calls `generateRVK()` — generates 32 cryptographically random bytes (the Root Vault Key).
3. Calls `generateSalt(VAULT_ARGON2ID_SALT_LENGTH || 16)` — generates 16-byte random KDF salt.
4. Calls `deriveKEK(masterPassword, salt)` — runs Argon2id with the current `VAULT_ARGON2ID_*` parameters to produce the 256-bit KEK.
5. Calls `generateNonce()` — generates a 12-byte random nonce for AES-256-GCM.
6. Sets AAD = `Buffer.from('qa-platform-vault-v1', 'utf8')`.
7. Calls `wrapKey(rvk, kek, nonce, aad)` — encrypts the RVK with the KEK using AES-256-GCM.
8. Calls `sp_vault_bootstrap(i_salt, i_nonce, i_kdf_memory, i_kdf_iterations, i_kdf_parallelism, i_wrapped_rvk, i_aad, i_bootstrap_operator_id)` — writes the wrapped RVK and all metadata to `vault_state` under a PostgreSQL advisory lock (`pg_advisory_xact_lock(hashtext('vault_bootstrap'))`) to prevent TOCTOU races.
9. Calls `zeroize(rvk)` and `zeroize(kek)` — overwrites both keys in memory with zeros.
10. Immediately calls `unlockVault()` to auto-unlock, places the unlock token in an `httpOnly`, `sameSite: strict` cookie named `unlock_token` (30-minute `maxAge`).

**Step 5 — Verify bootstrap succeeded**

After successful bootstrap, the browser redirects to `/dashboard`. Confirm vault state:

```sql
SELECT * FROM sp_vault_state_get();
-- o_is_bootstrapped should be TRUE
-- o_bootstrap_date should be the current timestamp
-- o_bootstrap_operator_id should be your operator ID
-- o_kdf_memory, o_kdf_iterations, o_kdf_parallelism should match your env var values
```

**Step 6 — Secure the master password immediately**

> **Critical:** Bootstrap is not complete until the master password is secured. Loss of the master password results in permanent, unrecoverable loss of all encrypted secrets (see Section 7).

- Store the master password in at least two locations: a password manager and a physical safe.
- Consider designating a secondary operator who also knows the password.
- Document the secure storage location (not the password itself) in your internal IT procedures.

### Expected Output

| Check | Expected Value |
|---|---|
| `sp_vault_state_get()` → `o_is_bootstrapped` | `TRUE` |
| `vault_state.wrapped_rvk` | Non-null BYTEA, 48 bytes |
| `vault_state.kdf_salt` | Non-null BYTEA, 16 bytes |
| Browser cookie `unlock_token` | Set, `httpOnly`, expires in 30 minutes |
| Browser redirect | `/dashboard` |

---

## 3. Daily Unlock Procedure

The vault must be unlocked after every server restart or TTL expiry. The unlock operation reconstructs the in-memory RVK from the wrapped copy in the database by re-deriving the KEK from the master password.

### When Unlock Is Required

- After any dashboard-web process restart (the `UnlockSessionRegistry` is process-local and does not survive restarts).
- After the vault TTL expires (`VAULT_UNLOCK_TTL_SECONDS`, default 1800 seconds / 30 minutes).
- After a manual lock (Section 4).
- After the idle timeout fires (`VAULT_UNLOCK_IDLE_RESET_SECONDS`, default 300 seconds / 5 minutes of inactivity).

### Procedure

**Step 1 — Navigate to the unlock page**

```
/unlock
```

If the vault is not bootstrapped, you will be redirected to the bootstrap page instead.

**Step 2 — Enter the master password and submit**

The form calls `unlockVaultAction(masterPassword)`, which calls `unlockVault(masterPassword, sessionId, operatorId)` from `@qa-platform/vault`.

**What happens internally during unlock** (`unlockVault()` in `vault.ts`):

1. Calls `sp_vault_state_get()` — confirms vault is bootstrapped.
2. Calls `sp_vault_state_get_crypto()` — retrieves `kdf_salt`, `nonce`, `wrapped_rvk`, and `aad` from `vault_state`.
3. Calls `deriveKEK(masterPassword, salt)` — re-runs Argon2id with the **stored** KDF parameters to reproduce the KEK. The parameters used are read from `vault_state.kdf_memory/iterations/parallelism` (set during bootstrap), not from current env vars.
4. Calls `unwrapKey(wrappedRvk, kek, nonce, aad)` — decrypts the wrapped RVK using AES-256-GCM. If decryption fails (wrong password or tampered ciphertext), the GCM auth tag check fails and `unlockVault()` returns `{ success: false }`.
5. Calls `zeroize(kek)` — immediately clears the KEK from memory.
6. Calls `registry.generateUnlockToken()` — generates a 32-byte base64url unlock token.
7. Calls `registry.register(unlockToken, rvk, operatorSessionId, ttlSeconds)` — stores the RVK in the `UnlockSessionRegistry` Map, keyed by unlock token, with:
   - **Absolute TTL:** `VAULT_UNLOCK_TTL_SECONDS` (default `1800` seconds / 30 minutes). Configurable via environment variable.
   - **Idle reset:** `VAULT_UNLOCK_IDLE_RESET_SECONDS` (default `300` seconds / 5 minutes). Any call to `withUnlocked()` or `validateUnlockSession()` resets the idle clock.
8. Calls `sp_vault_unlock_session_create(operatorSessionId, unlockToken, ttlMinutes, createdBy)` — records the unlock session in `vault_unlock_sessions` for audit purposes. The DB row TTL mirrors the in-memory TTL.
9. The `unlock_token` is set as an `httpOnly`, `sameSite: strict` cookie with a 30-minute `maxAge`.

### TTL and Idle Reset Behavior

The registry enforces **two independent timers**:

| Timer | Env Var | Default | Description |
|---|---|---|---|
| Absolute TTL | `VAULT_UNLOCK_TTL_SECONDS` | `1800` (30 min) | Hard wall-clock expiry from the moment of unlock. Cannot be extended without re-unlocking. |
| Idle timeout | `VAULT_UNLOCK_IDLE_RESET_SECONDS` | `300` (5 min) | Resets on every call to `registry.get()`. If no vault activity occurs within this window, the session expires regardless of the absolute TTL. |

> **Warning:** When the vault auto-locks at TTL or idle expiry, in-progress operations that have already called `withUnlocked()` and received the RVK callback are **not interrupted**. However, any new call to `encryptSecret()`, `decryptSecret()`, or `validateUnlockSession()` will fail with `"Vault is not unlocked or session expired"`.

### Successful Unlock Indicators

- Browser redirects to `/dashboard` or the previous page.
- `isVaultUnlocked()` server action returns `true`.
- `unlock_token` cookie is set in the browser.

---

## 4. Manual Lock Procedure

### When to Lock Manually

- Before stepping away from the console or leaving the desk.
- When you suspect the system or session has been compromised.
- Before handing off the workstation to another operator.
- During maintenance windows where vault access is not needed.

### Procedure — Dashboard UI

1. Locate the "Lock Vault" or "Lock Now" button in the dashboard header or the vault settings page (`/dashboard/settings/vault`).
2. Click the button. This calls `lockVaultAction()` on the server.

### Procedure — Direct API

```http
POST /api/vault/lock
Cookie: unlock_token=<current-unlock-token>
```

### What Happens Internally (`lockVault()` in `vault.ts`)

1. Calls `registry.remove(unlockToken)`:
   - Retrieves the session from the in-memory Map.
   - Calls `zeroize(session.rvk)` — overwrites the RVK buffer with zeros.
   - Deletes the entry from the Map.
2. Calls `sp_vault_lock(i_unlock_token, i_updated_by)`:
   - Sets `vault_unlock_sessions.is_active = FALSE` for the matching token.
   - Records `updated_by` and `updated_date`.
3. The `lockVaultAction()` server action deletes the `unlock_token` cookie.

After lock, any call to `withUnlocked()` with the now-invalid token throws `"Vault is not unlocked or session expired"`.

---

## 5. Master Password Rotation

Password rotation changes the master password without re-encrypting individual secrets. Only the RVK wrapping is changed: a new KEK is derived from the new password, and the RVK is re-wrapped with the new KEK. All `secret_records` remain untouched.

### Prerequisites

- The vault must currently be unlocked (you need access to the current master password).
- A full database backup should be taken before rotation (in case the procedure is interrupted mid-write).

### Procedure

**Step 1 — Take a database backup**

```bash
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  --table=vault_state \
  --table=secret_records \
  -F c -f vault_backup_$(date +%Y%m%d_%H%M%S).dump
```

Store the backup in a secure, offline location. Label it with the date and "pre-rotation."

**Step 2 — Navigate to vault settings**

```
/dashboard/settings/vault
```

**Step 3 — Initiate password rotation**

Locate the "Change Master Password" section. The UI will prompt for:
- Current master password (for verification — re-runs `deriveKEK` + `unwrapKey` to confirm access)
- New master password (minimum 12 characters, `VAULT_MASTER_PASSWORD_MIN_LENGTH`)
- Confirm new master password

**Step 4 — What happens internally**

1. `deriveKEK(currentPassword, storedSalt)` → verifies the current password can unwrap the RVK.
2. `generateSalt()` → new 16-byte salt for the new KEK.
3. `deriveKEK(newPassword, newSalt)` → new KEK from new password.
4. `generateNonce()` → new 12-byte nonce.
5. `wrapKey(rvk, newKek, newNonce, aad)` → wraps the in-memory RVK with the new KEK.
6. Database update: `vault_state.kdf_salt`, `vault_state.nonce`, `vault_state.wrapped_rvk`, and `vault_state.master_password_last_changed` are updated atomically.
7. Old KEK and new KEK are both zeroized.

> **Note:** Individual secrets in `secret_records` are **not re-encrypted**. Their `wrapped_dek` values are wrapped with the RVK, not the KEK. Since the RVK does not change during password rotation, all secrets remain valid immediately.

**Step 5 — Test the new password immediately**

1. Lock the vault (Section 4).
2. Unlock with the new password (Section 3).
3. Confirm that secrets are decryptable (attempt to view one credential).

If unlock fails, the old password may still work if the DB update was not committed. Do not discard the old password until the new one is verified.

**Step 6 — Update stored documentation**

- Update the password record in your password manager.
- If a physical backup exists, update or replace it.
- Notify any secondary operators who hold a copy of the password.

### Rollback

There is no automated rollback. Once the `vault_state` row is updated and committed, the old wrapped RVK is gone. Keep the old master password accessible until Step 5 verification is complete.

### What Does NOT Change

- `secret_records` — no rows are modified.
- `secret_access_logs` — no entries are added (rotation is not a secret access event).
- The RVK itself — it is unchanged; only its encrypted wrapper changes.

---

## 6. KDF Parameter Upgrade

Argon2id parameters control the computational cost of key derivation. Higher parameters provide stronger resistance to brute-force attacks at the cost of longer unlock time.

### When to Upgrade

- **Annually** — as a routine security hygiene task.
- **When server hardware improves significantly** — if the server gains substantially more RAM or CPU cores, you can increase parameters proportionally.
- **When OWASP or NIST guidance changes** — monitor [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) annually.
- **If unlock takes less than 1 second** — the parameters are too low for the current hardware.

### Current Default Parameters

These are the v1 defaults, stored in `vault_state` at bootstrap time and readable via `sp_vault_state_get()`:

| Env Var | Default | Schema Source |
|---|---|---|
| `VAULT_ARGON2ID_MEMORY` | `131072` KiB (128 MiB) | `packages/config/src/env.schema.ts:28` |
| `VAULT_ARGON2ID_ITERATIONS` | `3` | `packages/config/src/env.schema.ts:29` |
| `VAULT_ARGON2ID_PARALLELISM` | `2` | `packages/config/src/env.schema.ts:30` |
| `VAULT_ARGON2ID_SALT_LENGTH` | `16` bytes | `packages/config/src/env.schema.ts:31` |

OWASP minimum recommendation (as of 2024): memory ≥ 64 MiB, iterations ≥ 3, parallelism ≥ 1. The platform defaults exceed this by 2×.

### Step 1 — Benchmark New Parameters First

Before committing to new parameters, measure unlock time on production hardware:

```typescript
// Run this in a Node.js REPL or test script on the production server
import argon2 from 'argon2';
import { randomBytes } from 'crypto';

const salt = randomBytes(16);
const newParams = {
  type: argon2.argon2id,
  memoryCost: 262144,   // 256 MiB — candidate value
  timeCost: 4,
  parallelism: 4,
  hashLength: 32,
  salt,
  raw: true,
};

console.time('kdf');
await argon2.hash('test-password', newParams);
console.timeEnd('kdf');
```

**Target:** Unlock should complete in **1–5 seconds** on production hardware. Below 1 second is too fast (parameters too low). Above 5 seconds creates an unacceptable operator experience.

### Step 2 — Update Env Vars

In your `.env` file or container environment:

```env
VAULT_ARGON2ID_MEMORY=262144      # 256 MiB
VAULT_ARGON2ID_ITERATIONS=4
VAULT_ARGON2ID_PARALLELISM=4
```

> **Important:** Changing env vars alone does **not** change the KDF parameters used for the existing wrapped RVK. The `vault_state` row stores the parameters used at bootstrap. A new KEK derived with the new parameters will not unwrap the old wrapped RVK.

### Step 3 — Apply via Password Rotation

New KDF parameters take effect during password rotation (Section 5). When rotation runs:
- `deriveKEK()` reads the current `VAULT_ARGON2ID_*` env vars.
- The new KEK is derived with the new parameters.
- The new parameters are written to `vault_state.kdf_memory/iterations/parallelism`.
- All subsequent unlocks will use the new parameters.

### Step 4 — Verify

After rotation, check `sp_vault_state_get()`:

```sql
SELECT o_kdf_memory, o_kdf_iterations, o_kdf_parallelism FROM sp_vault_state_get();
-- Should reflect new parameter values
```

Perform a full lock/unlock cycle and measure unlock time to confirm it is within the 1–5 second target.

### Rollback Considerations

Once a password rotation with new parameters is committed, the old parameters are overwritten in `vault_state`. To roll back:
1. Restore `vault_state` from the pre-rotation backup.
2. Restore the old `VAULT_ARGON2ID_*` env vars.
3. Restart the dashboard-web process.

This makes all secrets accessible again with the original password and parameters.

---

## 7. Emergency Lock-Out Recovery

> **This section describes the nuclear option. Read it completely before taking any action.**

### There Is No Automated Recovery — This Is by Design

The master password is never stored anywhere in the system. The RVK is encrypted with the KEK, which is derived from the master password via Argon2id (memory=128 MiB, iterations=3, parallelism=2 by default). Without the master password, recovering the KEK by brute force is computationally infeasible at these parameters — this is the security guarantee of the system.

**There is no backdoor, no recovery email, no admin override.**

### Prevention First

Before reading the recovery procedure, confirm whether recovery is truly necessary:

- Check all password managers — personal, shared, and organizational.
- Check physical safes and secure document storage.
- Ask any secondary operators who may have been given the password.
- Check if the password was written in any secure notes or encrypted documents.
- Check email archives for any initial bootstrap notification that may have quoted the password (inadvisable but possible in some setups).

If the password is found, unlock normally (Section 3) and immediately document and store it securely.

### Recovery Procedure (Nuclear Option)

If the master password is irrecoverably lost, all encrypted secrets are permanently unrecoverable. The following procedure re-bootstraps the vault from scratch.

**Step 1 — Stop all services**

```bash
docker compose down
# or equivalent for your deployment
```

Stopping services prevents any in-flight operations from writing additional secrets during the recovery.

**Step 2 — Take a full database backup**

Even though vault secrets are unrecoverable, the backup preserves the audit trail and all other application data:

```bash
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  -F c -f full_backup_lockout_$(date +%Y%m%d_%H%M%S).dump
```

Store this backup offline and label it with "POST-LOCKOUT — VAULT SECRETS UNRECOVERABLE."

**Step 3 — Clear vault state and unlock sessions**

Connect to the database and execute the following. These statements remove the unrecoverable vault state; the `secret_records` rows are retained for audit purposes.

```sql
BEGIN;

-- Remove all vault unlock sessions (no longer valid)
DELETE FROM vault_unlock_sessions;

-- Remove vault state (bootstrap record and wrapped RVK)
-- This enables re-bootstrap
DELETE FROM vault_state;

-- Do NOT delete secret_records — retain for audit trail
-- The encrypted payloads are unrecoverable without the RVK,
-- but the records document what credentials existed.

COMMIT;
```

> **Do not delete `secret_records`.** The encrypted rows are permanently unreadable, but they document what credentials were once stored. Retain them for compliance and audit purposes.

**Step 4 — Restart services**

```bash
docker compose up -d
```

**Step 5 — Re-bootstrap the vault**

Follow Section 2 completely. Choose a new, strong master password and store it in at least two secure locations before doing anything else.

**Step 6 — Re-enter all secrets manually**

All credentials that were previously stored must be re-entered by hand. Reference:
- External systems where the credentials were originally obtained.
- Any out-of-vault documentation (external password managers, physical records).
- Contact owners of external systems (API key issuers, etc.) to issue new credentials if originals are also lost.

There is no automated way to recover secret values. This step may take significant time.

### Contact Log

When a lockout occurs, notify the following parties immediately:

| Role | Reason |
|---|---|
| Platform owner / VP of AI | Authorizes recovery procedure and risk acceptance |
| All operators who stored secrets in the vault | Their credentials are now inaccessible; they must provide new values |
| Security/compliance officer (if applicable) | Data loss event may require reporting under organizational policy |

Log the incident in `audit_logs`:

```sql
INSERT INTO audit_logs (actor_type, actor_id, action, target_type, details, status)
VALUES ('operator', '<your_operator_id>', 'vault.lockout.recovery', 'vault',
        'Master password irrecoverably lost. Vault re-bootstrapped. All prior secrets unrecoverable.',
        'success');
```

---

## 8. Secret Management Operations

All secret operations require an unlocked vault. The vault must be unlocked before performing any of the following.

### Add a New Credential

1. Navigate to `/dashboard/settings/vault` (vault must be unlocked).
2. Click "Add Secret" or "New Credential."
3. Fill in:
   - **Name** — unique identifier within the owner scope (enforced by `UNIQUE(owner_scope, name)` in `secret_records`).
   - **Category** — type of credential (e.g., `api_key`, `password`, `token`).
   - **Owner Scope** — the site or context this credential belongs to.
   - **Description** — optional human-readable note.
   - **Secret Value** — the plaintext credential.
4. Submit. The server action calls `encryptSecret(unlockToken, plaintext)`, which:
   - Generates a per-secret DEK via `generateDEK()`.
   - Encrypts the plaintext with the DEK using AES-256-GCM (`aad = 'qa-platform-secret-v1'`).
   - Wraps the DEK with the RVK using a separate nonce.
   - Calls `sp_secret_records_insert(...)` to store `encrypted_payload`, `nonce`, `aad`, `wrapped_dek`, `wrap_nonce`.
   - Zeroizes the DEK.
5. The plaintext is never stored; it exists in memory only during the `encryptSecret()` call.

### Update a Credential

1. Navigate to `/dashboard/settings/vault`.
2. Select the credential to update and click "Edit."
3. Enter the new secret value.
4. Submit. The server action calls `encryptSecret()` to produce a new payload, then calls `sp_secret_records_update(...)`, which replaces `encrypted_payload`, `nonce`, `wrapped_dek`, and `wrap_nonce` in the existing `secret_records` row.

> Updating re-generates a fresh DEK and nonces. The previous ciphertext is overwritten and unrecoverable.

### Delete (Archive) a Credential

1. Navigate to `/dashboard/settings/vault`.
2. Select the credential.
3. Click "Delete." A confirmation dialog will appear — you must explicitly confirm the deletion.
4. The server calls `sp_secret_records_archive(i_id)`, which sets `is_active = FALSE` on the row. The encrypted payload is retained in the database for audit; it is not physically deleted.
5. The vault must be unlocked to reach the delete UI, but the delete operation itself does not require a decryption step.

### View (Reveal) a Credential

1. Navigate to `/dashboard/settings/vault`.
2. Select the credential and click "Reveal" or "Show."
3. The server calls `decryptSecret(unlockToken, encryptedPayload, nonce, wrappedDek, wrapNonce)`, which:
   - Retrieves the RVK from the `UnlockSessionRegistry`.
   - Calls `unwrapKey(wrappedDek, rvk, wrapNonce, aad)` to recover the DEK.
   - Calls `decrypt(encryptedPayload, dek, nonce, aad)` to recover the plaintext.
   - Zeroizes the DEK.
4. The plaintext is returned to the browser over the HTTPS session. It is **not cached** in browser storage, local storage, or cookies.
5. Every reveal event writes a row to `secret_access_logs` via `sp_secret_access_logs_insert(...)`.

---

## 9. Monitoring & Alerting

### What to Monitor

| Metric | Source | Alert Threshold |
|---|---|---|
| Failed unlock attempts | `audit_logs` where `action = 'vault.unlock'` and `status = 'failure'` | > 5 failures in 60 minutes (possible brute force) |
| Expired vault unlock sessions | `vault_unlock_sessions` where `expires_date < NOW()` and `is_active = TRUE` | Any row in this state for > 5 minutes (cleanup not running) |
| Vault bootstrap state | `sp_vault_state_get()` | `o_is_bootstrapped = FALSE` when it should be `TRUE` (data loss / misconfiguration) |
| Database disk space | OS/container metrics | Thresholds per your infrastructure policy |
| Secret access volume | `secret_access_logs` | Unusual spike (> 2× normal hourly rate) |

### SQL: Check Vault Bootstrap State

```sql
SELECT * FROM sp_vault_state_get();
```

Returns one row when bootstrapped, zero rows when not. `o_is_bootstrapped = TRUE` with a non-null `o_bootstrap_date` is the expected healthy state.

### SQL: Count Active Vault Unlock Sessions

```sql
SELECT COUNT(*) AS active_sessions
FROM vault_unlock_sessions
WHERE is_active = TRUE
  AND expires_date > CURRENT_TIMESTAMP;
```

Under normal operation, there should be 0 or 1 active sessions (one per logged-in operator who has unlocked the vault). Multiple active sessions with different `operator_session_id` values are possible if multiple operators are working concurrently.

### SQL: Failed Unlock Attempts in Last Hour

```sql
SELECT COUNT(*) AS failed_unlocks
FROM audit_logs
WHERE action = 'vault.unlock'
  AND status = 'failure'
  AND created_date >= CURRENT_TIMESTAMP - INTERVAL '1 hour';
```

If this count exceeds 5, investigate immediately. Possible causes: wrong password being entered, misconfigured KDF parameters, or an active brute-force attempt.

### SQL: Recent Secret Access Log

```sql
SELECT
    sal.created_date,
    sal.access_type,
    sal.access_reason,
    sr.name AS secret_name,
    sr.owner_scope,
    sal.operator_id,
    sal.ip_address
FROM secret_access_logs sal
JOIN secret_records sr ON sr.id = sal.secret_id
ORDER BY sal.created_date DESC
LIMIT 50;
```

### Alert: Possible Brute Force

Configure your monitoring system to trigger an alert and optionally call a webhook when the failed-unlock query returns > 5 in any 60-minute rolling window. Recommended response:
1. Lock the vault immediately (Section 4) if not already locked.
2. Review `audit_logs` for the originating IP address.
3. Block the IP at the load balancer or firewall.
4. Rotate the master password after confirming legitimate access is restored.

---

## 10. Troubleshooting

### Common Issues

| Symptom | Likely Cause | Resolution |
|---|---|---|
| `"Vault is not unlocked or session expired"` | TTL expired, idle timeout fired, or vault was manually locked | Unlock the vault at `/unlock` |
| `"Vault is already bootstrapped"` error on bootstrap page | Vault was previously bootstrapped; page redirect did not fire | Do not re-bootstrap. Use password rotation (Section 5) instead |
| Unlock fails with `{ success: false }` despite correct password | KDF parameters in env vars do not match parameters stored in `vault_state` at bootstrap time | Run `sp_vault_state_get()` to read stored params; update env vars or run a rotation with correct params |
| Unlock takes > 5 seconds | `VAULT_ARGON2ID_MEMORY` or `VAULT_ARGON2ID_ITERATIONS` are very high relative to available server memory/CPU | Benchmark new params (Section 6, Step 1); rotate to lower params |
| Unlock takes < 1 second | KDF parameters are too low; insufficient brute-force resistance | Upgrade KDF parameters (Section 6) |
| `"Secret decrypt fails"` / GCM auth tag error | `nonce`/`wrap_nonce`/`wrapped_dek`/`aad` mismatch — possible data corruption | Check `secret_records` for the affected row; compare `kdf_version`; review `audit_logs` for recent updates to that record; restore from backup if corrupted |
| Dashboard redirects to `/dashboard/settings/vault/bootstrap` unexpectedly | `vault_state` table is empty (e.g., after a migration rollback or accidental DELETE) | Confirm with `SELECT COUNT(*) FROM vault_state;`; if 0, vault must be re-bootstrapped (Section 2) |
| `unlock_token` cookie not set after unlock | Server-side cookie write failed; check Next.js server action response | Inspect server logs for `vault unlock error`; ensure `NODE_ENV` and `DASHBOARD_SESSION_SECRET` are set correctly |
| `sp_vault_bootstrap` returns `o_success = FALSE` | Bootstrap was called concurrently; advisory lock serialized the calls and the second lost the race | Harmless — only one bootstrap can succeed; verify the first call completed with `sp_vault_state_get()` |
| Registry shows 0 sessions after restart | `UnlockSessionRegistry` is process-local and does not persist across restarts | Normal behavior — unlock the vault after every process restart |

### Diagnosing Session State

```sql
-- All unlock sessions in the last 24 hours
SELECT
    vus.id,
    vus.operator_session_id,
    vus.created_date,
    vus.expires_date,
    vus.last_activity_date,
    vus.is_active,
    vus.updated_by
FROM vault_unlock_sessions vus
WHERE vus.created_date >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY vus.created_date DESC;
```

### Log Locations

| Log Type | Location |
|---|---|
| Vault operation errors | `console.error` in `apps/dashboard-web/app/actions/vault.ts`; captured by container logging (stdout/stderr) |
| Secret access events | `secret_access_logs` table, queryable via the SQL above |
| Vault unlock/lock events | `audit_logs` table where `target_type = 'vault'` |
| KDF errors (wrong password) | No row inserted in `audit_logs` from within `unlockVault()` itself — the calling action must log the failure; check `vault.unlock.failure` rows |
