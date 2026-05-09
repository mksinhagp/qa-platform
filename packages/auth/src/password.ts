// Argon2id password hashing utility
// Configurable via environment variables for memory, iterations, parallelism

import argon2 from 'argon2';
import { getEnv } from '@qa-platform/config';

export interface HashPasswordResult {
  hash: string;
  salt: Buffer;
}

export interface VerifyPasswordResult {
  isValid: boolean;
  needsRehash: boolean;
}

/**
 * Hash a password using Argon2id
 * Parameters configurable via env:
 * - VAULT_ARGON2ID_MEMORY (default: 131072 KiB = 128 MiB)
 * - VAULT_ARGON2ID_ITERATIONS (default: 3)
 * - VAULT_ARGON2ID_PARALLELISM (default: 2)
 */
export async function hashPassword(password: string): Promise<string> {
  const env = getEnv();

  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: env.VAULT_ARGON2ID_MEMORY || 131072,
    timeCost: env.VAULT_ARGON2ID_ITERATIONS || 3,
    parallelism: env.VAULT_ARGON2ID_PARALLELISM || 2,
  });
}

/**
 * Verify a password against a hash
 * Returns whether valid and whether the hash needs rehashing (if parameters changed)
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<VerifyPasswordResult> {
  const env = getEnv();

  const options = {
    type: argon2.argon2id,
    memoryCost: env.VAULT_ARGON2ID_MEMORY || 131072,
    timeCost: env.VAULT_ARGON2ID_ITERATIONS || 3,
    parallelism: env.VAULT_ARGON2ID_PARALLELISM || 2,
  };

  try {
    const isValid = await argon2.verify(hash, password, options);
    const needsRehash = await argon2.needsRehash(hash, options);

    return { isValid, needsRehash };
  } catch (error) {
    return { isValid: false, needsRehash: false };
  }
}
