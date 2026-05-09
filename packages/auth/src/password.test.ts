import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  beforeEach(() => {
    // Set minimal env vars for tests
    process.env.VAULT_ARGON2ID_MEMORY = '65536';
    process.env.VAULT_ARGON2ID_ITERATIONS = '2';
    process.env.VAULT_ARGON2ID_PARALLELISM = '1';
  });

  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same password (due to salt)', async () => {
      const password = 'test-password-123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const password = '';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const password = 'test-password-123';
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);

      expect(result.isValid).toBe(true);
      expect(result.needsRehash).toBe(false);
    });

    it('should reject an incorrect password', async () => {
      const password = 'test-password-123';
      const wrongPassword = 'wrong-password-456';
      const hash = await hashPassword(password);

      const result = await verifyPassword(wrongPassword, hash);

      expect(result.isValid).toBe(false);
      expect(result.needsRehash).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const password = 'test-password-123';
      const invalidHash = 'invalid-hash-format';

      const result = await verifyPassword(password, invalidHash);

      expect(result.isValid).toBe(false);
      expect(result.needsRehash).toBe(false);
    });
  });
});
