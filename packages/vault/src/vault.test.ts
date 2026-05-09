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

// Use vi.hoisted so these variables are available inside vi.mock factory
const { mockClientQuery, mockClientRelease } = vi.hoisted(() => ({
  mockClientQuery: vi.fn(),
  mockClientRelease: vi.fn(),
}));

// Mock the db module
vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcScalar: vi.fn(),
  getClient: vi.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
  }),
}));

// Mock the registry
vi.mock('./registry', () => ({
  default: {
    register: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    generateUnlockToken: vi.fn().mockReturnValue('mock-unlock-token'),
  },
}));

describe('vault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientQuery.mockReset();
    mockClientRelease.mockReset();
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
      // Capture the salt, nonce, and wrapped_rvk that bootstrap stores, so unlock can use them
      let capturedSalt: Buffer | null = null;
      let capturedNonce: Buffer | null = null;
      let capturedWrappedRvk: Buffer | null = null;
      let capturedAad: string | null = null;

      // 1. getVaultState() → not bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([]);

      // 2. invokeProcScalar('sp_vault_bootstrap') → capture args and return success
      vi.mocked(invokeProcScalar).mockImplementationOnce(async (_proc, params: Record<string, unknown> = {}) => {
        capturedSalt = params.i_salt as Buffer;
        capturedNonce = params.i_nonce as Buffer;
        capturedWrappedRvk = params.i_wrapped_rvk as Buffer;
        capturedAad = params.i_aad as string;
        return { o_success: true };
      });

      // 3. unlockVault → getVaultState() → bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: new Date().toISOString(),
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
        },
      ]);

      // 4. unlockVault → invokeProc('sp_vault_state_get_crypto') → return captured vault data
      // Must use mockImplementationOnce so captured values are read at call-time (after bootstrap populates them)
      vi.mocked(invokeProc).mockImplementationOnce(async () => [
        {
          o_salt: capturedSalt,
          o_nonce: capturedNonce,
          o_wrapped_rvk: capturedWrappedRvk,
          o_aad: capturedAad,
        },
      ]);

      // 5. unlockVault → invokeProcScalar('sp_vault_unlock_session_create') → success
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'unlock-token' });

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
      // First, generate real crypto material so unlock can decrypt
      const { generateSalt, deriveKEK, generateRVK, generateNonce, wrapKey } = await import('./crypto');
      const salt = generateSalt(16);
      const nonce = generateNonce();
      const rvk = generateRVK();
      const kek = await deriveKEK('master-password-123', salt);
      const aad = Buffer.from('qa-platform-vault-v1', 'utf8');
      const wrappedRvk = await wrapKey(rvk, kek, nonce, aad);

      // 1. getVaultState() → bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: new Date().toISOString(),
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
        },
      ]);

      // 2. invokeProc('sp_vault_state_get_crypto') → vault row
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_salt: salt,
          o_nonce: nonce,
          o_wrapped_rvk: wrappedRvk,
          o_aad: 'qa-platform-vault-v1',
        },
      ]);

      // 3. invokeProcScalar('sp_vault_unlock_session_create') → success
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'unlock-token-456' });

      const result = await unlockVault('master-password-123', 1, 1);

      expect(result.success).toBe(true);
      expect(result.unlockToken).toBeDefined();
    });

    it('should fail with incorrect master password', async () => {
      // Generate crypto material with one password
      const { generateSalt, deriveKEK, generateRVK, generateNonce, wrapKey } = await import('./crypto');
      const salt = generateSalt(16);
      const nonce = generateNonce();
      const rvk = generateRVK();
      const kek = await deriveKEK('correct-password', salt);
      const aad = Buffer.from('qa-platform-vault-v1', 'utf8');
      const wrappedRvk = await wrapKey(rvk, kek, nonce, aad);

      // 1. getVaultState() → bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: new Date().toISOString(),
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
        },
      ]);

      // 2. invokeProc('sp_vault_state_get_crypto') → vault row
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_salt: salt,
          o_nonce: nonce,
          o_wrapped_rvk: wrappedRvk,
          o_aad: 'qa-platform-vault-v1',
        },
      ]);

      // Try to unlock with wrong password — unwrapKey will throw
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
        encrypted.wrappedDek,
        encrypted.wrapNonce,
      );

      expect(decrypted.toString('utf8')).toBe('secret-data');
    });
  });

  describe('vault lifecycle integration', () => {
    it('should complete full lifecycle: bootstrap → unlock → encrypt → decrypt → lock → access denied', async () => {
      const { generateSalt, deriveKEK, generateRVK, generateNonce, wrapKey } = await import('./crypto');

      // Pre-generate crypto material for consistent bootstrap → unlock chain
      const salt = generateSalt(16);
      const nonce = generateNonce();
      const rvk = generateRVK();
      const kek = await deriveKEK('master-password', salt);
      const aad = Buffer.from('qa-platform-vault-v1', 'utf8');
      const wrappedRvk = await wrapKey(rvk, kek, nonce, aad);

      // 1. Bootstrap
      // getVaultState → not bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([]);
      // sp_vault_bootstrap → success
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_success: true });
      // auto-unlock → getVaultState → bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: new Date().toISOString(),
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
        },
      ]);
      // auto-unlock → invokeProc('sp_vault_state_get_crypto') — BUT bootstrap generates
      // its own crypto material, so unlockVault will use different salt/nonce than our
      // pre-generated ones. The simplest approach: skip auto-unlock by returning no rows,
      // then manually unlock with our known crypto material.
      vi.mocked(invokeProc).mockResolvedValueOnce([]);

      await bootstrapVault('master-password', 1, 1);
      // Bootstrap SP succeeded, but auto-unlock failed (no vault data in mock DB)
      // That's OK — we'll unlock manually below
      expect(invokeProcScalar).toHaveBeenCalledWith(
        'sp_vault_bootstrap',
        expect.objectContaining({ i_bootstrap_operator_id: 1 })
      );

      // 2. Unlock (manual, with known crypto material)
      // getVaultState() → bootstrapped
      vi.mocked(invokeProc).mockResolvedValueOnce([
        {
          o_is_bootstrapped: true,
          o_bootstrap_date: new Date().toISOString(),
          o_bootstrap_operator_id: 1,
          o_kdf_memory: 65536,
          o_kdf_iterations: 2,
          o_kdf_parallelism: 1,
        },
      ]);
      // invokeProc('sp_vault_state_get_crypto') → vault crypto material
      vi.mocked(invokeProc).mockResolvedValueOnce([
        { o_salt: salt, o_nonce: nonce, o_wrapped_rvk: wrappedRvk, o_aad: 'qa-platform-vault-v1' },
      ]);
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_unlock_token: 'token-2' });

      const unlockResult = await unlockVault('master-password', 1, 1);
      expect(unlockResult.success).toBe(true);
      const unlockToken = unlockResult.unlockToken!;

      // 3. Encrypt — registry.get needs to return session with the real RVK
      // The unlock registered the RVK in the (mocked) registry. Since registry is mocked,
      // we need to set up registry.get to return the session with the actual RVK that
      // was derived during unlock. However, since we're using real crypto in unlock,
      // the RVK was the unwrapped result. We know what it should be because we
      // generated it above.
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken,
        rvk: rvk, // same RVK we generated
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });

      const plaintext = Buffer.from('test-secret', 'utf8');
      const encrypted = await encryptSecret(unlockToken, plaintext);
      expect(encrypted.encryptedPayload).toBeDefined();

      // 4. Decrypt
      vi.mocked(registry.get).mockReturnValueOnce({
        unlockToken,
        rvk: rvk,
        operatorSessionId: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        lastActivityAt: new Date(),
      });
      const decrypted = await decryptSecret(unlockToken, encrypted.encryptedPayload, encrypted.nonce, encrypted.wrappedDek, encrypted.wrapNonce);
      expect(decrypted.toString()).toBe('test-secret');

      // 5. Lock
      vi.mocked(registry.remove).mockReturnValueOnce(true);
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_success: true });
      await lockVault(unlockToken, 1);

      // 6. Access denied
      vi.mocked(registry.get).mockReturnValueOnce(null);
      await expect(encryptSecret(unlockToken, plaintext)).rejects.toThrow('Vault is not unlocked');
    });
  });
});
