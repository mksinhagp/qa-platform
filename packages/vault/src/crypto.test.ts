import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  generateRVK,
  generateDEK,
  generateNonce,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
  zeroize,
} from './crypto';

describe('crypto', () => {
  describe('generateSalt', () => {
    it('should generate a salt of default length', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.length).toBe(16);
    });

    it('should generate a salt of custom length', () => {
      const salt = generateSalt(32);
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.length).toBe(32);
    });
  });

  describe('generateRVK', () => {
    it('should generate a 32-byte RVK', () => {
      const rvk = generateRVK();
      expect(rvk).toBeInstanceOf(Buffer);
      expect(rvk.length).toBe(32);
    });

    it('should generate unique RVKs', () => {
      const rvk1 = generateRVK();
      const rvk2 = generateRVK();
      expect(rvk1.equals(rvk2)).toBe(false);
    });
  });

  describe('generateDEK', () => {
    it('should generate a 32-byte DEK', () => {
      const dek = generateDEK();
      expect(dek).toBeInstanceOf(Buffer);
      expect(dek.length).toBe(32);
    });

    it('should generate unique DEKs', () => {
      const dek1 = generateDEK();
      const dek2 = generateDEK();
      expect(dek1.equals(dek2)).toBe(false);
    });
  });

  describe('generateNonce', () => {
    it('should generate a 12-byte nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toBeInstanceOf(Buffer);
      expect(nonce.length).toBe(12);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1.equals(nonce2)).toBe(false);
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt plaintext correctly', async () => {
      const plaintext = Buffer.from('test-secret-data', 'utf8');
      const key = Buffer.alloc(32, 0); // Zero key for testing
      const nonce = generateNonce();

      const ciphertext = await encrypt(plaintext, key, nonce);
      const decrypted = await decrypt(ciphertext, key, nonce);

      expect(decrypted.equals(plaintext)).toBe(true);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = Buffer.from('test-secret-data', 'utf8');
      const key = Buffer.alloc(32, 0);
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      const ciphertext1 = await encrypt(plaintext, key, nonce1);
      const ciphertext2 = await encrypt(plaintext, key, nonce2);

      expect(ciphertext1.equals(ciphertext2)).toBe(false);
    });
  });

  describe('wrapKey/unwrapKey', () => {
    it('should wrap and unwrap a key correctly', async () => {
      const keyToWrap = generateDEK();
      const wrappingKey = Buffer.alloc(32, 0);
      const nonce = generateNonce();

      const wrapped = await wrapKey(keyToWrap, wrappingKey, nonce);
      const unwrapped = await unwrapKey(wrapped, wrappingKey, nonce);

      expect(unwrapped.equals(keyToWrap)).toBe(true);
    });
  });

  describe('zeroize', () => {
    it('should zeroize a buffer', () => {
      const buffer = Buffer.from('sensitive-data', 'utf8');
      zeroize(buffer);

      expect(buffer.toString()).toBe('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');
    });
  });
});
