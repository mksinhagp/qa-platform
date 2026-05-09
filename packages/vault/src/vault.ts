// Vault API: bootstrap, unlock, lock, withUnlocked
// Brokered access to encrypted secrets

import {
  generateSalt,
  deriveKEK,
  generateRVK,
  generateDEK,
  generateNonce,
  wrapKey,
  unwrapKey,
  encrypt,
  decrypt,
  zeroize,
} from './crypto';
import {
  invokeProc,
  invokeProcScalar,
} from '@qa-platform/db';
import { getEnv } from '@qa-platform/config';
import registry from './registry';

export interface VaultState {
  isBootstrapped: boolean;
  bootstrapDate?: Date;
  bootstrapOperatorId?: number;
  kdfMemory: number;
  kdfIterations: number;
  kdfParallelism: number;
}

export interface BootstrapResult {
  success: boolean;
  unlockToken?: string;
}

export interface UnlockResult {
  success: boolean;
  unlockToken?: string;
}

/**
 * Get current vault state
 */
export async function getVaultState(): Promise<VaultState> {
  const result = await invokeProc('sp_vault_state_get', {});

  if (result.length === 0) {
    return {
      isBootstrapped: false,
      kdfMemory: 0,
      kdfIterations: 0,
      kdfParallelism: 0,
    };
  }

  const row = result[0];
  return {
    isBootstrapped: row.o_is_bootstrapped,
    bootstrapDate: row.o_bootstrap_date,
    bootstrapOperatorId: row.o_bootstrap_operator_id,
    kdfMemory: row.o_kdf_memory,
    kdfIterations: row.o_kdf_iterations,
    kdfParallelism: row.o_kdf_parallelism,
  };
}

/**
 * Bootstrap vault with master password
 * Generates RVK, wraps with KEK derived from master password
 */
export async function bootstrapVault(
  masterPassword: string,
  operatorId: number,
  operatorSessionId: number
): Promise<BootstrapResult> {
  const env = getEnv();

  // Check if already bootstrapped
  const state = await getVaultState();
  if (state.isBootstrapped) {
    return { success: false };
  }

  // Generate RVK and salt
  const rvk = generateRVK();
  const salt = generateSalt(env.VAULT_ARGON2ID_SALT_LENGTH || 16);

  // Derive KEK from master password
  const kek = await deriveKEK(masterPassword, salt);

  // Generate nonce and AAD
  const nonce = generateNonce();
  const aad = Buffer.from('qa-platform-vault-v1', 'utf8');

  // Wrap RVK with KEK
  const wrappedRvk = await wrapKey(rvk, kek, nonce, aad);

  // Store in database (include nonce so unlock can retrieve it)
  const result = await invokeProcScalar('sp_vault_bootstrap', {
    i_salt: salt,
    i_nonce: nonce,
    i_kdf_memory: env.VAULT_ARGON2ID_MEMORY || 131072,
    i_kdf_iterations: env.VAULT_ARGON2ID_ITERATIONS || 3,
    i_kdf_parallelism: env.VAULT_ARGON2ID_PARALLELISM || 2,
    i_wrapped_rvk: wrappedRvk,
    i_aad: aad.toString('utf8'),
    i_bootstrap_operator_id: operatorId,
  });

  if (!result.o_success) {
    zeroize(rvk);
    zeroize(kek);
    return { success: false };
  }

  // Zeroize sensitive buffers
  zeroize(rvk);
  zeroize(kek);

  // Auto-unlock after bootstrap
  const unlockResult = await unlockVault(
    masterPassword,
    operatorSessionId,
    operatorId
  );

  return unlockResult;
}

/**
 * Unlock vault with master password
 * Derives KEK, unwraps RVK, stores in in-memory registry
 */
export async function unlockVault(
  masterPassword: string,
  operatorSessionId: number,
  operatorId: number
): Promise<UnlockResult> {
  const env = getEnv();

  // Get vault state
  const state = await getVaultState();
  if (!state.isBootstrapped) {
    return { success: false };
  }

  // Get vault crypto material from DB via stored procedure
  const vaultRows = await invokeProc('sp_vault_state_get_crypto', {});

  if (vaultRows.length === 0) {
    return { success: false };
  }

  const row = vaultRows[0];
  const salt = row.o_salt;
  const wrappedRvk = row.o_wrapped_rvk;
  const aad = row.o_aad ? Buffer.from(row.o_aad, 'utf8') : undefined;
  const nonce = row.o_nonce;

  // Derive KEK from master password
  const kek = await deriveKEK(masterPassword, salt);

  // Unwrap RVK
  let rvk: Buffer;
  try {
    rvk = await unwrapKey(wrappedRvk, kek, nonce, aad);
  } catch {
    // Decryption failed — wrong master password
    zeroize(kek);
    return { success: false };
  }

  // Zeroize KEK
  zeroize(kek);

  // Generate unlock token
  const unlockToken = registry.generateUnlockToken();

  // Register in-memory session
  const ttlSeconds = env.VAULT_UNLOCK_TTL_SECONDS || 1800;
  registry.register(unlockToken, rvk, operatorSessionId, ttlSeconds);

  // Create unlock session in DB
  await invokeProcScalar('sp_vault_unlock_session_create', {
    i_operator_session_id: operatorSessionId,
    i_unlock_token: unlockToken,
    i_ttl_minutes: Math.floor(ttlSeconds / 60),
    i_created_by: operatorId.toString(),
  });

  return { success: true, unlockToken };
}

/**
 * Lock vault (invalidate unlock session)
 */
export async function lockVault(
  unlockToken: string,
  operatorId: number
): Promise<boolean> {
  // Remove from in-memory registry (zeroizes RVK)
  const removed = registry.remove(unlockToken);

  // Invalidate in DB
  await invokeProcScalar('sp_vault_lock', {
    i_unlock_token: unlockToken,
    i_updated_by: operatorId.toString(),
  });

  return removed;
}

/**
 * Validate unlock session
 */
export async function validateUnlockSession(
  unlockToken: string
): Promise<boolean> {
  const env = getEnv();
  const idleResetSeconds = env.VAULT_UNLOCK_IDLE_RESET_SECONDS || 300;

  const session = registry.get(unlockToken, idleResetSeconds);
  return session !== null;
}

/**
 * Execute a callback with the vault unlocked
 * Brokered API: callback receives RVK in memory only
 */
export async function withUnlocked<T>(
  unlockToken: string,
  callback: (rvk: Buffer) => Promise<T>
): Promise<T> {
  const env = getEnv();
  const idleResetSeconds = env.VAULT_UNLOCK_IDLE_RESET_SECONDS || 300;

  const session = registry.get(unlockToken, idleResetSeconds);

  if (!session) {
    throw new Error('Vault is not unlocked or session expired');
  }

  try {
    return await callback(session.rvk);
  } finally {
    // RVK is automatically zeroized when session is removed/locked
    // No need to zeroize here
  }
}

/**
 * Encrypt a secret using RVK
 */
export async function encryptSecret(
  unlockToken: string,
  plaintext: Buffer
): Promise<{ encryptedPayload: Buffer; nonce: Buffer; wrappedDek: Buffer; wrapNonce: Buffer }> {
  return withUnlocked(unlockToken, async (rvk) => {
    const dek = generateDEK();
    const nonce = generateNonce();        // nonce for payload encryption
    const wrapNonce = generateNonce();    // separate nonce for DEK wrapping
    const aad = Buffer.from('qa-platform-secret-v1', 'utf8');

    // Encrypt plaintext with DEK
    const encryptedPayload = await encrypt(plaintext, dek, nonce, aad);

    // Wrap DEK with RVK using a separate nonce
    const wrappedDek = await wrapKey(dek, rvk, wrapNonce, aad);

    // Zeroize DEK
    zeroize(dek);

    return { encryptedPayload, nonce, wrappedDek, wrapNonce };
  });
}

/**
 * Decrypt a secret using RVK
 */
export async function decryptSecret(
  unlockToken: string,
  encryptedPayload: Buffer,
  nonce: Buffer,
  wrappedDek: Buffer,
  wrapNonce: Buffer,
  wrapNonceArg?: Buffer
): Promise<Buffer> {
  return withUnlocked(unlockToken, async (rvk) => {
    const aadBuffer = wrapNonceArg ? wrapNonceArg : Buffer.from('qa-platform-secret-v1', 'utf8');

    // Unwrap DEK with RVK using wrap nonce
    const dek = await unwrapKey(wrappedDek, rvk, wrapNonce, aadBuffer);

    try {
      // Decrypt plaintext with DEK using payload nonce
      return await decrypt(encryptedPayload, dek, nonce, aadBuffer);
    } finally {
      // Zeroize DEK
      zeroize(dek);
    }
  });
}
