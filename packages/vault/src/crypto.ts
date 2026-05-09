// Cryptographic utilities for vault
// Argon2id KDF and AES-256-GCM encryption/decryption

import { randomBytes } from 'crypto';
import argon2 from 'argon2';
import { getEnv } from '@qa-platform/config';

/**
 * Generate a random salt for KDF
 */
export function generateSalt(length: number = 16): Buffer {
  return randomBytes(length);
}

/**
 * Derive Key Encryption Key (KEK) from master password using Argon2id
 * This is used to wrap/unwrap the Root Vault Key (RVK)
 */
export async function deriveKEK(
  masterPassword: string,
  salt: Buffer
): Promise<Buffer> {
  const env = getEnv();

  const options = {
    type: argon2.argon2id,
    memoryCost: env.VAULT_ARGON2ID_MEMORY || 131072,
    timeCost: env.VAULT_ARGON2ID_ITERATIONS || 3,
    parallelism: env.VAULT_ARGON2ID_PARALLELISM || 2,
    hashLength: 32, // 256-bit KEK
    salt,
  };

  const hash = await argon2.hash(masterPassword, {
    ...options,
    raw: true, // Return raw bytes instead of hex string
  });

  return Buffer.from(hash);

}

/**
 * Generate a random 32-byte Root Vault Key (RVK)
 */
export function generateRVK(): Buffer {
  return randomBytes(32);
}

/**
 * Generate a random 32-byte Data Encryption Key (DEK)
 */
export function generateDEK(): Buffer {
  return randomBytes(32);
}

/**
 * Generate a random 12-byte nonce for AES-256-GCM
 */
export function generateNonce(): Buffer {
  return randomBytes(12);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns ciphertext + auth tag (combined)
 */
export async function encrypt(
  plaintext: Buffer,
  key: Buffer,
  nonce: Buffer,
  aad?: Buffer
): Promise<Buffer> {
  const crypto = await import('crypto');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

  if (aad) {
    cipher.setAAD(aad);
  }

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Return ciphertext + auth tag concatenated
  return Buffer.concat([ciphertext, authTag]);
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Expects ciphertext + auth tag concatenated
 */
export async function decrypt(
  ciphertextWithTag: Buffer,
  key: Buffer,
  nonce: Buffer,
  aad?: Buffer
): Promise<Buffer> {
  const crypto = await import('crypto');

  // Split ciphertext and auth tag (auth tag is last 16 bytes)
  const ciphertext = ciphertextWithTag.subarray(0, -16);
  const authTag = ciphertextWithTag.subarray(-16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);

  if (aad) {
    decipher.setAAD(aad);
  }

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Wrap a key using envelope encryption
 * Encrypts DEK with KEK using AES-256-GCM
 */
export async function wrapKey(
  keyToWrap: Buffer,
  wrappingKey: Buffer,
  nonce: Buffer,
  aad?: Buffer
): Promise<Buffer> {
  return encrypt(keyToWrap, wrappingKey, nonce, aad);
}

/**
 * Unwrap a key using envelope decryption
 * Decrypts DEK with KEK using AES-256-GCM
 */
export async function unwrapKey(
  wrappedKey: Buffer,
  wrappingKey: Buffer,
  nonce: Buffer,
  aad?: Buffer
): Promise<Buffer> {
  return decrypt(wrappedKey, wrappingKey, nonce, aad);
}

/**
 * Securely zeroize a buffer (overwrite with zeros)
 */
export function zeroize(buffer: Buffer): void {
  buffer.fill(0);
}
