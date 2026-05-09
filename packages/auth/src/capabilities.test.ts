import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCapabilitiesForOperator, hasCapability, hasAnyCapability, hasAllCapabilities } from './capabilities';
import { invokeProc } from '@qa-platform/db';

// Mock the db module
vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
}));

describe('capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCapabilitiesForOperator', () => {
    it('should return all capabilities for an operator', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
        { o_capability_name: 'vault.unlock' },
        { o_capability_name: 'secret.reveal' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await getCapabilitiesForOperator(1);

      expect(result).toEqual(['operator.manage', 'vault.unlock', 'secret.reveal']);
      expect(invokeProc).toHaveBeenCalledWith('sp_capabilities_for_operator', {
        i_operator_id: 1,
      });
    });

    it('should return empty array for operator with no capabilities', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([]);

      const result = await getCapabilitiesForOperator(999);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(getCapabilitiesForOperator(1)).rejects.toThrow('DB connection failed');
    });
  });

  describe('hasCapability', () => {
    it('should return true when operator has capability', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
        { o_capability_name: 'vault.unlock' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasCapability(1, 'vault.unlock');

      expect(result).toBe(true);
    });

    it('should return false when operator does not have capability', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasCapability(1, 'vault.administer');

      expect(result).toBe(false);
    });

    it('should be case sensitive', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasCapability(1, 'Operator.Manage');

      expect(result).toBe(false);
    });
  });

  describe('hasAnyCapability', () => {
    it('should return true when operator has at least one capability', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
        { o_capability_name: 'vault.unlock' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasAnyCapability(1, ['vault.administer', 'vault.unlock', 'secret.manage']);

      expect(result).toBe(true);
    });

    it('should return false when operator has none of the capabilities', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasAnyCapability(1, ['vault.administer', 'secret.manage']);

      expect(result).toBe(false);
    });

    it('should return false for empty capability list', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([{ o_capability_name: 'operator.manage' }]);

      const result = await hasAnyCapability(1, []);

      expect(result).toBe(false);
    });
  });

  describe('hasAllCapabilities', () => {
    it('should return true when operator has all capabilities', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
        { o_capability_name: 'vault.unlock' },
        { o_capability_name: 'secret.reveal' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasAllCapabilities(1, ['operator.manage', 'vault.unlock']);

      expect(result).toBe(true);
    });

    it('should return false when operator is missing one capability', async () => {
      const mockCapabilities = [
        { o_capability_name: 'operator.manage' },
        { o_capability_name: 'vault.unlock' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockCapabilities);

      const result = await hasAllCapabilities(1, ['operator.manage', 'vault.unlock', 'secret.manage']);

      expect(result).toBe(false);
    });

    it('should return true for empty capability list', async () => {
      vi.mocked(invokeProc).mockResolvedValueOnce([{ o_capability_name: 'operator.manage' }]);

      const result = await hasAllCapabilities(1, []);

      expect(result).toBe(true);
    });
  });

  describe('capability families', () => {
    it('should handle super_admin with all capabilities', async () => {
      const allCapabilities = [
        { o_capability_name: 'operator.manage' },
        { o_capability_name: 'role.manage' },
        { o_capability_name: 'capability.manage' },
        { o_capability_name: 'site.manage' },
        { o_capability_name: 'site_credentials.manage' },
        { o_capability_name: 'vault.administer' },
        { o_capability_name: 'vault.unlock' },
        { o_capability_name: 'secret.manage' },
        { o_capability_name: 'secret.reveal' },
        { o_capability_name: 'run.execute' },
        { o_capability_name: 'run.read' },
        { o_capability_name: 'approval.decide' },
        { o_capability_name: 'approval.read' },
        { o_capability_name: 'artifact.read' },
        { o_capability_name: 'audit.read' },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(allCapabilities);

      const result = await getCapabilitiesForOperator(1);

      expect(result).toContain('vault.administer');
      expect(result).toContain('secret.reveal');
      expect(result).toContain('audit.read');
    });
  });
});
