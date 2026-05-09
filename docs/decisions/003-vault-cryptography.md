# ADR 003: Vault Cryptography

## Status

Accepted

## Context

The QA Automation Platform needs to securely store sensitive credentials (API keys, passwords, payment tokens) for test sites. We need a vault system that:

- Encrypts secrets at rest
- Requires master password to unlock
- Provides brokered runtime access for runner
- Supports key rotation and re-keying
- Zeroizes keys in memory on lock

## Decision

We use **Argon2id KDF + AES-256-GCM envelope encryption** for the vault.

### Cryptographic Design

#### Bootstrap

1. First operator with `vault_admin` capability initializes vault
2. Sets master password (min length, zxcvbn strength check)
3. System generates random 32-byte **Root Vault Key (RVK)**
4. System generates 16-byte salt
5. Runs Argon2id (memory=128 MiB, iterations=3, parallelism=2)
6. Argon2id output is **Key Encryption Key (KEK)**
7. RVK encrypted with KEK using AES-256-GCM (random nonce, AAD = vault id)
8. Wrapped RVK stored in `vault_state.wrapped_rvk`

#### Unlock

1. Operator submits master password
2. Server re-derives KEK using stored salt and KDF params
3. Server decrypts wrapped_rvk to recover RVK
4. Creates `vault_unlock_sessions` row with TTL (default 30 min, idle reset)
5. RVK held only in process memory keyed by unlock-session id
6. On lock, logout, or TTL expiry, in-memory RVK wiped

#### Secret Storage

1. For each secret, generate random 32-byte **Data Encryption Key (DEK)**
2. Encrypt secret plaintext with DEK using AES-256-GCM
3. Wrap DEK with RVK using AES-256-GCM
4. Store encrypted payload, nonce, AAD, wrapped DEK in `secret_records`

#### Brokered Runtime Use

- Runner never receives RVK or master password
- Dashboard-web decrypts inside its own process
- Passes plaintext over internal-only HTTP call with one-time token
- Every decrypt-for-run event writes to `secret_access_logs`

### Parameters

**Argon2id (v1 defaults)**:
- Memory: 128 MiB (131072 KiB)
- Iterations: 3
- Parallelism: 2
- Salt: 16 bytes
- Output: 32 bytes (KEK)

**AES-256-GCM**:
- Key: 32 bytes (RVK or DEK)
- Nonce: 12 bytes (random per encryption)
- AAD: Vault id or secret id
- Tag: 16 bytes (authentication)

## Consequences

### Positive

- Industry-standard KDF (Argon2id) resistant to GPU/ASIC attacks
- Envelope encryption enables per-secret key rotation
- Brokered access limits secret exposure
- Memory-only RVK prevents disk leakage
- Audit trail of all secret access events

### Negative

- Master password loss = data loss (no recovery mechanism)
- Argon2id computationally expensive (intentional for security)
- Requires careful key management and zeroization
- Complex implementation increases attack surface

### Alternatives Considered

- **Hash-based KDF (PBKDF2)**: Rejected - Argon2id more resistant to GPU attacks
- **AWS KMS / HashiCorp Vault**: Rejected - local-first requirement, adds external dependency
- **Single key encryption**: Rejected - no per-secret rotation, single point of compromise
- **Plaintext storage**: Rejected - violates security requirements

## References

- Master Plan §6: Vault Specification
- Master Plan §5.3: Phase 1 Additional Tables
