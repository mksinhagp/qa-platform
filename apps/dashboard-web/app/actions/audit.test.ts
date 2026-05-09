import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logAudit, queryAuditLogs } from './audit';
import { invokeProc } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';

// Mock dependencies
vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
}));

vi.mock('@qa-platform/auth', () => ({
  requireOperator: vi.fn(),
}));

describe('audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAudit', () => {
    it('should log audit event with operator context', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      vi.mocked(invokeProc).mockResolvedValueOnce([{ o_id: 1 }]);

      await logAudit({
        action: 'vault.unlock',
        target: 'vault',
        status: 'success',
        details: { ip_address: '127.0.0.1' },
      });

      expect(invokeProc).toHaveBeenCalledWith('sp_audit_logs_insert', {
        i_actor_type: 'operator',
        i_actor_id: '1',
        i_action: 'vault.unlock',
        i_target: 'vault',
        i_status: 'success',
        i_details: JSON.stringify({ ip_address: '127.0.0.1' }),
      });
    });

    it('should log audit event without details', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 2,
        sessionId: 2,
        capabilities: [],
      });
      vi.mocked(invokeProc).mockResolvedValueOnce([{ o_id: 2 }]);

      await logAudit({
        action: 'login',
        target: 'operator:2',
        status: 'success',
      });

      expect(invokeProc).toHaveBeenCalledWith(
        'sp_audit_logs_insert',
        expect.objectContaining({
          i_actor_id: '2',
          i_action: 'login',
          i_details: null,
        })
      );
    });

    it('should handle audit log errors gracefully', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      vi.mocked(invokeProc).mockRejectedValueOnce(new Error('DB error'));

      // Should not throw, just log error
      await expect(
        logAudit({
          action: 'test',
          target: 'test',
          status: 'success',
        })
      ).resolves.not.toThrow();
    });

    it('should use system as actor when requireOperator fails', async () => {
      vi.mocked(requireOperator).mockRejectedValueOnce(new Error('Not authenticated'));
      vi.mocked(invokeProc).mockResolvedValueOnce([{ o_id: 1 }]);

      await logAudit({
        action: 'system.event',
        target: 'system',
        status: 'success',
      });

      expect(invokeProc).toHaveBeenCalledWith(
        'sp_audit_logs_insert',
        expect.objectContaining({
          i_actor_id: 'system',
        })
      );
    });
  });

  describe('queryAuditLogs', () => {
    it('should query audit logs without filters', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      const mockLogs = [
        {
          o_id: 1,
          o_actor_type: 'operator',
          o_actor_id: '1',
          o_action: 'login',
          o_target: 'operator:1',
          o_status: 'success',
          o_details: null,
          o_created_date: '2024-01-01T00:00:00Z',
        },
        {
          o_id: 2,
          o_actor_type: 'operator',
          o_actor_id: '1',
          o_action: 'vault.unlock',
          o_target: 'vault',
          o_status: 'success',
          o_details: JSON.stringify({ method: 'password' }),
          o_created_date: '2024-01-01T00:01:00Z',
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockLogs);

      const result = await queryAuditLogs();

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.logs?.[0].action).toBe('login');
      expect(result.logs?.[1].action).toBe('vault.unlock');
    });

    it('should query audit logs with filters', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      vi.mocked(invokeProc).mockResolvedValueOnce([]);

      await queryAuditLogs('1', 'vault.unlock', 'vault', 'success', 50);

      expect(invokeProc).toHaveBeenCalledWith('sp_audit_logs_query', {
        i_actor_id: '1',
        i_action: 'vault.unlock',
        i_target: 'vault',
        i_status: 'success',
        i_limit: 50,
      });
    });

    it('should handle null filters', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      vi.mocked(invokeProc).mockResolvedValueOnce([]);

      await queryAuditLogs(undefined, undefined, undefined, undefined, 100);

      expect(invokeProc).toHaveBeenCalledWith('sp_audit_logs_query', {
        i_actor_id: null,
        i_action: null,
        i_target: null,
        i_status: null,
        i_limit: 100,
      });
    });

    it('should require authentication', async () => {
      vi.mocked(requireOperator).mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await queryAuditLogs();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to query audit logs');
    });

    it('should parse JSON details when present', async () => {
      vi.mocked(requireOperator).mockResolvedValueOnce({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      const mockLogs = [
        {
          o_id: 1,
          o_actor_type: 'operator',
          o_actor_id: '1',
          o_action: 'credential.create',
          o_target: 'credential:123',
          o_status: 'success',
          o_details: JSON.stringify({ site_id: 1, role: 'admin' }),
          o_created_date: '2024-01-01T00:00:00Z',
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockLogs);

      const result = await queryAuditLogs();

      expect(result.success).toBe(true);
      expect(result.logs?.[0].details).toBe(JSON.stringify({ site_id: 1, role: 'admin' }));
    });
  });

  describe('security-sensitive actions audit', () => {
    it('should audit all security-sensitive actions', async () => {
      vi.mocked(requireOperator).mockResolvedValue({
        operatorId: 1,
        sessionId: 1,
        capabilities: [],
      });
      vi.mocked(invokeProc).mockResolvedValue([{ o_id: 1 }]);

      const sensitiveActions = [
        { action: 'vault.bootstrap', target: 'vault' },
        { action: 'vault.unlock', target: 'vault' },
        { action: 'vault.lock', target: 'vault' },
        { action: 'secret.create', target: 'secret:123' },
        { action: 'secret.reveal', target: 'secret:123' },
        { action: 'operator.create', target: 'operator:2' },
        { action: 'login', target: 'operator:1' },
        { action: 'logout', target: 'operator:1' },
      ];

      for (const { action, target } of sensitiveActions) {
        await logAudit({
          action,
          target,
          status: 'success',
        });
      }

      expect(invokeProc).toHaveBeenCalledTimes(sensitiveActions.length);
    });
  });
});
