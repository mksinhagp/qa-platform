import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getVaultState,
  bootstrapVault,
  unlockVault,
  lockVault,
  validateUnlockSession,
  withUnlocked,
  encryptSecret,
  decryptSecret,
} from './vault';
import { invokeProc, invokeProcScalar } from '@qa-platform/db';
import registry from './registry';

// Mock the db module
vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcScalar: vi.fn(),
}));

// Mock the registry
vi.mock('./registry', () => ({
  default: {
    register: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

describe('vault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVaultState', () => {
    it('should return bootstrapped state when vault exists', async () => {
      const mockResult = [
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: '2024-01-01T00:00:00Z',
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 131072,
          o_kdf_iterations: 3,
          o_kdf_parallelism: 2,
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockResult);

      const result = await getVaultState();

      expect(result.isBootstrapped).toBe(true);
      expect(result.bootstrapOperatorId).toBe(1);
      expect(result.kdfMemory).toBe(131072);
    });

    it('should return non-bootstrapped state when vault does not exist', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([]);

      const result = await getVaultState();

      expect(result.isBootstrapped).toBe(false);
      expect(result.kdfMemory).toBe(0);
    });
  });

  describe('bootstrapVault', () => {
    it('should bootstrap vault with master password', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([]); // getVaultState check
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'unlock-token-123' });

      const result = await bootstrapVault('master-password-123', 1, 1);

      expect(result.success).toBe(true);
      expect(result.unlockToken).toBeDefined();
    });

    it('should fail if vault already bootstrapped', async () => {
      const mockResult = [
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: '2024-01-01T00:00:00Z',
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 131072,
          o_kdf_iterations: 3,
          o_kdf_parallelism: 2,
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockResult);

      const result = await bootstrapVault('master-password-123', 1, 1);

      expect(result.success).toBe(false);
    });
  });

  describe('unlockVault', () => {
    it('should unlock vault with correct master password', async () => {
      const mockVaultState = [
        {
          o_salt: Buffer.from('test-salt-16-bytes'),
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
          o_wrapped_rvk: Buffer.from('wrapped-rvk-data'),
          o_nonce: Buffer.from('nonce-12-bytes'),
          o_aad: Buffer.from('qa-platform-vault-v1'),
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockVaultState);
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'unlock-token-456' });

      const result = await unlockVault('master-password-123', 1, 1);

      expect(result.success).toBe(true);
      expect(result.unlockToken).toBeDefined();
    });

    it('should fail with incorrect master password', async () => {
      const mockVaultState = [
        {
          o_salt: Buffer.from('test-salt-16-bytes'),
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
          o_wrapped_rvk: Buffer.from('wrapped-rvk-data'),
          o_nonce: Buffer.from('nonce-12-bytes'),
          o_aad: Buffer.from('qa-platform-vault-v1'),
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockVaultState);
      // Simulate decryption failure with wrong password
      vi.mocked(invokeProcScalar).mockRejectedValueOnce(new Error('Decryption failed'));

      const result = await unlockVault('wrong-password', 1, 1);

      expect(result.success).toBe(false);
    });
  });

  describe('lockVault', () => {
    it('should lock vault and remove session', async () => {
      vi.mocked(registry.remove).mockReturnValueOnce(true);
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_success: true });

      const result = await lockVault('unlock-token-123', 1);

      expect(result).toBe(true);
      expect(registry.remove).toHaveBeenCalledWith('unlock-token-123');
    });
  });

  describe('validateUnlockSession', () => {
    it('should return true for valid session', async () => {
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'valid-token',
        rvk: Buffer.alloc(32),
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const result = await validateUnlockSession('valid-token');

      expect(result).toBe(true);
    });

    it('should return false for invalid session', async () => {
      vi.mocked(registry.get).mockReturnValueOnce(null);

      const result = await validateUnlockSession('invalid-token');

      expect(result).toBe(false);
    });
  });

  describe('withUnlocked', () => {
    it('should execute callback with RVK when unlocked', async () => {
      const mockRVK = Buffer.alloc(32, 1);
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'valid-token',
        rvk: mockRVK,
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const callback = vi.fn().mockResolvedValue('callback-result');
      const result = await withUnlocked('valid-token', callback);

      expect(result).toBe('callback-result');
      expect(callback).toHaveBeenCalledWith(mockRVK);
    });

    it('should throw error when vault is locked', async () => {
      vi.mocked(registry.get).mockReturnValueOnce(null);

      const callback = vi.fn();
      
      await expect(withUnlocked('invalid-token', callback)).rejects.toThrow('Vault is not unlocked');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('encryptSecret', () => {
    it('should encrypt plaintext using RVK', async () => {
      const mockRVK = Buffer.alloc(32, 1);
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'valid-token',
        rvk: mockRVK,
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const plaintext = Buffer.from('secret-data', 'utf8');
      const result = await encryptSecret('valid-token', plaintext);

      expect(result.encryptedPayload).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(result.wrappedDek).toBeDefined();
    });
  });

  describe('decryptSecret', () => {
    it('should decrypt ciphertext using RVK', async () => {
      // First encrypt, then decrypt
      const mockRVK = Buffer.alloc(32, 1);
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'valid-token',
        rvk: mockRVK,
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const plaintext = Buffer.from('secret-data', 'utf8');
      const encrypted = await encryptSecret('valid-token', plaintext);

      // Reset mock for decrypt
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'valid-token',
        rvk: mockRVK,
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const decrypted = await decryptSecret(
        'valid-token',
        encrypted.encryptedPayload,
        encrypted.nonce,
        encrypted.wrappedDek
      );

      expect(decrypted.toString('utf8')).toBe('secret-data');
    });
  });

  describe('vault lifecycle integration', () => {
    it('should complete full lifecycle: bootstrap → unlock → encrypt → decrypt → lock → access denied', async () => {
      // 1. Bootstrap
      vi.mocked(invokeProc).mockResolvedValueOnce([]); // Not bootstrapped
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'token-1' });
      
      const bootstrapResult = await bootstrapVault('master-password', 1, 1);
      expect(bootstrapResult.success).toBe(true);

      // 2. Unlock
      const mockVaultState = [
        {
          o_salt: Buffer.from('test-salt-16-bytes'),
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
          o_wrapped_rvk: Buffer.from('wrapped-rvk-data'),
          o_nonce: Buffer.from('nonce-12-bytes'),
          o_aad: Buffer.from('qa-platform-vault-v1'),
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockVaultState);
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'token-2' });
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'token-2',
        rvk: Buffer.alloc(32, 2),
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const unlockResult = await unlockVault('master-password', 1, 1);
      expect(unlockResult.success).toBe(true);

      // 3. Encrypt
      const plaintext = Buffer.from('test-secret', 'utf8');
      const encrypted = await encryptSecret('token-2', plaintext);
      expect(encrypted.encryptedPayload).toBeDefined();

      // 4. Decrypt
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken: 'token-2',
        rvk: Buffer.alloc(32, 2),
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });
      const decrypted = await decryptSecret('token-2', encrypted.encryptedPayload, encrypted.nonce, encrypted.wrappedDek);
      expect(decrypted.toString()).toBe('test-secret');

      // 5. Lock
      vi.mocked(registry.remove).mockReturnValueOnce(true);
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_success: true });
      await lockVault('token-2', 1);

      // 6. Access denied
      vi.mocked(registry.get).mockReturnValueOnce(null);
      await expect(encryptSecret('token-2', plaintext)).rejects.toThrow('Vault is not unlocked');
    });
  });
});
