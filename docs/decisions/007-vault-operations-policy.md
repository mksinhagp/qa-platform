# ADR 007: Vault Operations Policy

## Status

Accepted

## Context

ADR 003 defines the cryptographic design of the vault (Argon2id KDF + AES-256-GCM envelope encryption). That decision establishes the technical security model but does not address the operational procedures required to maintain it securely over time. Without defined operational policy, the following risks are unmitigated:

- The master password is stored insecurely or known only to one person, creating a single point of failure.
- KDF parameters are set at bootstrap and never reviewed, leaving the system vulnerable as hardware improves and brute-force costs drop.
- Vault unlock sessions accumulate without monitoring, making it impossible to detect credential abuse or brute-force attempts.
- There is no defined procedure for incident response when the master password is lost, causing operators to improvise under pressure and make destructive errors.
- There is no defined access control for who may perform bootstrap, reducing the bootstrap operation to a first-come-first-served race rather than a deliberate administrative act.

This ADR establishes the operational policies that govern how the vault is administered in production. It is intentionally separate from ADR 003 to allow cryptographic and operational decisions to evolve independently.

## Decision

### Policy 1: Master Password Governance

**1.1 — Storage**  
The master password must be stored in at least two physically separate locations:
- One digital location: a password manager with access controlled by the platform owner or VP of AI.
- One physical location: a printed record stored in a fireproof safe with access limited to two named individuals.

**1.2 — Knowledge**  
At least two operators must know the master password at all times (the "two-person rule"). The names of those individuals must be documented in internal IT procedures (not in this repository).

**1.3 — First use**  
Bootstrap (Section 2 of the vault runbook) may only be performed by an operator with `vault_admin` capability. The operator performing bootstrap must ensure both copies (digital and physical) are secured before leaving the console.

**1.4 — Rotation frequency**  
The master password must be rotated:
- At minimum **every 12 months**.
- Within **48 hours** of any of the following events:
  - A former operator who knew the password leaves the organization.
  - A suspected or confirmed compromise of the password manager or physical safe.
  - A confirmed security incident affecting the platform host.

**1.5 — No embedding in automation**  
The master password must never be set as an environment variable, written into CI/CD configuration, or passed to any automated script. Unlock is an interactive human operation.

### Policy 2: Vault Unlock Session Management

**2.1 — Default TTL**  
The absolute unlock TTL (`VAULT_UNLOCK_TTL_SECONDS`) defaults to `1800` seconds (30 minutes). This value reflects the balance between operator convenience and exposure window.

**2.2 — Default idle timeout**  
The idle reset timeout (`VAULT_UNLOCK_IDLE_RESET_SECONDS`) defaults to `300` seconds (5 minutes). If no vault operations occur within this window, the session expires regardless of the absolute TTL.

**2.3 — Manual lock requirement**  
Operators must manually lock the vault before leaving the console unattended, regardless of the TTL setting. TTL auto-expiry is a safety net, not a substitute for manual locking.

**2.4 — Shared sessions**  
Each operator manages their own unlock session, keyed by their `operator_session_id`. Multiple concurrent unlock sessions are permitted (one per active operator). A session locked by one operator does not affect another operator's session.

**2.5 — Session monitoring**  
Active unlock sessions must be monitored. Any session active for longer than `VAULT_UNLOCK_TTL_SECONDS + 60` seconds (i.e., a session the in-memory registry should have already expired but the DB row has not been cleaned up) indicates a monitoring or cleanup gap and must be investigated.

### Policy 3: KDF Parameter Review and Upgrade

**3.1 — Annual review**  
KDF parameters (`VAULT_ARGON2ID_MEMORY`, `VAULT_ARGON2ID_ITERATIONS`, `VAULT_ARGON2ID_PARALLELISM`) must be reviewed against current OWASP and NIST recommendations at minimum once per calendar year.

**3.2 — Benchmark requirement**  
Before any parameter change is applied in production, unlock time must be benchmarked on production hardware with the candidate parameters. The target is 1–5 seconds. Parameters producing an unlock time below 1 second on production hardware are considered insufficient.

**3.3 — Application procedure**  
KDF parameter changes take effect only during a master password rotation (Section 5 of the vault runbook). Parameters stored in `vault_state` are authoritative for unlocking the existing wrapped RVK; env var changes alone do not update the in-use parameters.

**3.4 — Current baseline (v1)**  
The v1 baseline parameters — memory=131072 KiB (128 MiB), iterations=3, parallelism=2 — align with or exceed OWASP minimum recommendations as of 2024. These must be the floor for any future review; values below this baseline are not permitted.

### Policy 4: Bootstrap Access Control

**4.1 — Capability requirement**  
Only operators with the `vault_admin` capability may access `/dashboard/settings/vault/bootstrap`. The `bootstrapVaultAction()` server action enforces an active, validated session; UI routing enforces the capability check.

**4.2 — One-time operation**  
Bootstrap can only be performed once per database instance. The `sp_vault_bootstrap` stored procedure enforces this with a PostgreSQL advisory lock (`pg_advisory_xact_lock(hashtext('vault_bootstrap'))`). The only way to re-bootstrap is the emergency recovery procedure (Section 7 of the vault runbook), which requires manual database intervention.

**4.3 — Bootstrap attestation**  
The operator who performed bootstrap is recorded in `vault_state.bootstrap_operator_id` and `vault_state.created_by`. This record is immutable (never overwritten by subsequent rotations) and provides a permanent attestation of who initialized the vault.

### Policy 5: Monitoring and Incident Response Thresholds

**5.1 — Brute-force detection**  
More than 5 failed unlock attempts within any rolling 60-minute window constitutes a potential brute-force attack. The operational response is:
1. Immediately lock the vault manually.
2. Block the originating IP at the network boundary.
3. Rotate the master password.
4. Log the incident in `audit_logs` with `action = 'vault.security.incident'`.

**5.2 — Lockout incident notification**  
If the master password is irrecoverably lost, the platform owner must be notified within 1 hour of the determination. The emergency recovery procedure (Section 7 of the vault runbook) must not be initiated without explicit authorization from the platform owner.

**5.3 — Audit log retention**  
`audit_logs` and `secret_access_logs` must be retained for a minimum of 1 year. These tables are append-only; no delete operations are permitted except as part of a documented data retention policy approved by the platform owner.

**5.4 — Secret access review**  
`secret_access_logs` must be reviewed for anomalies at minimum monthly. Anomalies include: access by an operator who should not have vault access, access volumes significantly above baseline, and `run_execution_id` values not matching known test runs.

### Policy 6: Secret Lifecycle

**6.1 — No plaintext outside the vault**  
Once a credential is stored in the vault, it must not be duplicated in plaintext in any other system (config files, environment variables, code comments, or external documentation).

**6.2 — Archival vs. deletion**  
Secrets are archived (soft-deleted via `sp_secret_records_archive`) rather than physically deleted. The encrypted payload is retained indefinitely for audit. Physical deletion requires explicit platform owner approval and a documented business justification.

**6.3 — Per-secret keys**  
Each secret has its own DEK, generated fresh on every create or update. This design (inherited from ADR 003) enables future per-secret rotation: the DEK can be re-wrapped with a new RVK without re-encrypting the payload if the RVK changes.

## Consequences

### Positive

- The two-person rule for master password knowledge eliminates the single-operator lockout risk as a routine failure mode.
- Defined rotation frequency and KDF review schedule ensures the vault keeps pace with evolving hardware and attack capabilities.
- The five-failures-in-an-hour brute-force threshold provides actionable, specific detection criteria that can be implemented as an automated alert.
- Separation of bootstrap-only access (via `vault_admin` capability) from general vault use reduces the surface for unauthorized re-initialization.
- Audit log retention requirements make `secret_access_logs` a defensible record for any compliance inquiry.

### Negative

- The 12-month password rotation requirement and two-person knowledge rule impose ongoing operational overhead that scales with operator turnover.
- The prohibition on embedding the master password in automation means unlocking the vault requires a human operator after every process restart; there is no unattended startup mode.
- KDF benchmarking before each parameter change adds a step to what might otherwise seem like a simple env var change.
- The "archive not delete" policy for secrets causes `secret_records` to grow over time and requires periodic review of what is genuinely needed.

### Day-to-Day Operational Impact

- **Every server restart** requires an operator to manually unlock the vault before test runs can access credentials.
- **Every 12 months**, an operator must perform a password rotation and verify that at least two people know the new password.
- **Annually**, KDF parameters must be benchmarked and updated if the 1-second floor is breached on current hardware.
- **Monthly**, `secret_access_logs` must be reviewed for anomalies.

## Compliance Alignment

| Standard | Relevant Guidance | Policy Alignment |
|---|---|---|
| OWASP Password Storage Cheat Sheet (2024) | Argon2id minimum: memory ≥ 64 MiB, iterations ≥ 3 | Policy 3.4 sets floor at memory=128 MiB, iterations=3 — exceeds minimum |
| OWASP ASVS v4.0 §2.4 | KDF parameters must be tuned to take at least 1 second on target hardware | Policy 3.2 targets 1–5 seconds on production hardware |
| NIST SP 800-63B §5.1.1 | Memorized secrets must be hashed with a suitable one-way KDF | Argon2id satisfies this requirement |
| NIST SP 800-57 Part 1 | Cryptographic keys should have defined lifetimes; key material should be rotated | Policy 1.4 defines rotation triggers; Policy 3.1 defines annual review |
| NIST SP 800-132 | Key derivation from passwords should use a salt of at least 128 bits | `VAULT_ARGON2ID_SALT_LENGTH` defaults to 16 bytes = 128 bits — meets minimum |
| General audit trail principle | Security-relevant events must be logged and retained | Policy 5.3 requires 1-year retention of `audit_logs` and `secret_access_logs` |

## References

- [ADR 003 — Vault Cryptography](./003-vault-cryptography.md)
- [Vault Operations Runbook](../runbooks/vault-runbook.md)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-63B — Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NIST SP 800-57 Part 1 — Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [NIST SP 800-132 — Recommendation for Password-Based Key Derivation](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- `packages/config/src/env.schema.ts` — canonical list of vault env vars and defaults
- `packages/vault/src/vault.ts` — `bootstrapVault()`, `unlockVault()`, `lockVault()`
- `packages/vault/src/registry.ts` — `UnlockSessionRegistry` TTL and idle-reset logic
- `db/procs/0031_sp_vault_state_get.sql` through `0035_sp_vault_lock.sql` — vault stored procedures
- `db/migrations/0002_system_vault_audit_tables.sql` — `vault_state` and `audit_logs` schemas
- `db/migrations/0006_phase1_auth_vault_tables.sql` — `vault_unlock_sessions` schema
- `db/migrations/0007_secret_tables.sql` — `secret_records` and `secret_access_logs` schemas
