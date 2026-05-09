# @qa-platform/vault

Vault package for the QA Automation Platform. Provides secure secret storage using Argon2id KDF and AES-256-GCM envelope encryption.

## Features

- **Argon2id KDF**: Key derivation from master password with configurable parameters
- **AES-256-GCM encryption**: Industry-standard authenticated encryption
- **Envelope encryption**: RVK/KEK/DEK key hierarchy for key rotation
- **In-memory unlock sessions**: RVK held only in memory, never persisted
- **Automatic zeroization**: Sensitive buffers zeroized on lock/session expiry
- **TTL and idle reset**: Unlock sessions expire after TTL or idle timeout
- **Brokered runtime access**: Secrets decrypted only within withUnlocked callback

## Architecture

### Key Hierarchy

1. **Master Password**: User-provided password
2. **KEK (Key Encryption Key)**: Derived from master password using Argon2id
3. **RVK (Root Vault Key)**: Generated at bootstrap, wrapped with KEK, stored in DB
4. **DEK (Data Encryption Key)**: Generated per secret, wrapped with RVK

### Secret Storage Flow

1. Generate DEK (32 bytes)
2. Encrypt secret plaintext with DEK using AES-256-GCM
3. Wrap DEK with RVK using AES-256-GCM
4. Store encrypted payload, nonce, wrapped DEK in database

### Secret Retrieval Flow

1. Retrieve encrypted payload, nonce, wrapped DEK from database
2. Unwrap DEK with RVK using AES-256-GCM
3. Decrypt payload with DEK using AES-256-GCM
4. Zeroize DEK immediately after use

## Usage

### Bootstrap Vault

```typescript
import { bootstrapVault, getVaultState } from '@qa-platform/vault';

// Check if vault is bootstrapped
const state = await getVaultState();
if (!state.isBootstrapped) {
  // Bootstrap with master password
  const result = await bootstrapVault(
    'my-master-password',
    operatorId,
    operatorSessionId
  );
  if (result.success) {
    console.log('Vault bootstrapped and unlocked:', result.unlockToken);
  }
}
```

### Unlock Vault

```typescript
import { unlockVault } from '@qa-platform/vault';

const result = await unlockVault(
  'my-master-password',
  operatorSessionId,
  operatorId
);

if (result.success) {
  console.log('Vault unlocked:', result.unlockToken);
}
```

### Lock Vault

```typescript
import { lockVault } from '@qa-platform/vault';

await lockVault(unlockToken, operatorId);
```

### Encrypt Secret

```typescript
import { encryptSecret } from '@qa-platform/vault';

const plaintext = Buffer.from('my-secret-value', 'utf8');
const { encryptedPayload, nonce, wrappedDek } = await encryptSecret(
  unlockToken,
  plaintext
);

// Store encryptedPayload, nonce, wrappedDek in database via sp_secret_records_insert
```

### Decrypt Secret

```typescript
import { decryptSecret } from '@qa-platform/vault';

// Retrieve encrypted payload from database via sp_secret_records_get_for_use
const plaintext = await decryptSecret(
  unlockToken,
  encryptedPayload,
  nonce,
  wrappedDek,
  aad
);

console.log('Decrypted:', plaintext.toString('utf8'));
```

### Brokered Access with withUnlocked

```typescript
import { withUnlocked } from '@qa-platform/vault';

const result = await withUnlocked(unlockToken, async (rvk) => {
  // RVK is available only within this callback
  // Perform cryptographic operations here
  return someOperation(rvk);
});
```

## Environment Variables

Configure vault parameters via environment variables:

- `VAULT_ARGON2ID_MEMORY`: Memory cost in KiB (default: 131072 = 128 MiB)
- `VAULT_ARGON2ID_ITERATIONS`: Time cost/iterations (default: 3)
- `VAULT_ARGON2ID_PARALLELISM`: Parallelism factor (default: 2)
- `VAULT_ARGON2ID_SALT_LENGTH`: Salt length in bytes (default: 16)
- `VAULT_UNLOCK_TTL_SECONDS`: Unlock session TTL in seconds (default: 1800 = 30 min)
- `VAULT_UNLOCK_IDLE_RESET_SECONDS`: Idle reset timeout in seconds (default: 300 = 5 min)

## Database Dependencies

This package requires the following stored procedures from Phase 1:

- `sp_vault_state_get`
- `sp_vault_bootstrap`
- `sp_vault_unlock_session_create`
- `sp_vault_unlock_session_validate`
- `sp_vault_lock`

## Security Considerations

1. **Master password strength**: Enforce minimum length (default 12 characters) via vault config
2. **RVK never persisted**: RVK is only held in memory within the unlock session registry
3. **Automatic zeroization**: All sensitive buffers are zeroized when no longer needed
4. **Session expiry**: Unlock sessions expire after TTL or idle timeout
5. **Brokered access**: Secrets are only decrypted within the withUnlocked callback scope
6. **Nonce management**: Nonces should be stored alongside encrypted data (future improvement: store in vault_state)

## Future Improvements

- Store nonce in vault_state table instead of deriving from salt
- Add master password rotation (re-wraps RVK only)
- Add KDF parameter upgrade (re-derives KEK and re-wraps RVK)
- Add per-secret rotation (re-encrypts payload under new DEK)
- Add emergency lock-out recovery mechanism
