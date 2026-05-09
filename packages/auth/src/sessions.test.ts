import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSession, validateSession, revokeSession } from './sessions';
import { invokeProc, invokeProcScalar } from '@qa-platform/db';

// Mock the db module
vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcScalar: vi.fn(),
}));

describe('sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with token', async () => {
      const mockResult = {
        o_id: 1,
        o_session_token: 'test-token-123',
        o_created_date: new Date().toISOString(),
        o_expires_date: new Date(Date.now() + 86400000).toISOString(),
      };
      vi.mocked(invokeProcScalar).mockResolvedValueOnce(mockResult);

      const result = await createSession(1, '127.0.0.1', 'Test-Agent', 'testuser');

      expect(result.id).toBe(1);
      expect(result.sessionToken).toBeDefined();
      expect(result.operatorId).toBe(1);
      expect(invokeProcScalar).toHaveBeenCalledWith('sp_operator_sessions_create', {
        i_operator_id: 1,
        i_session_token: expect.any(String),
        i_ip_address: '127.0.0.1',
        i_user_agent: 'Test-Agent',
        i_idle_timeout_hours: 8,
        i_absolute_timeout_days: 30,
        i_created_by: 'testuser',
      });
    });

    it('should generate unique session tokens', async () => {
      const mockResult1 = { o_id: 1, o_session_token: 'token-1', o_created_date: new Date().toISOString(), o_expires_date: new Date().toISOString() };
      const mockResult2 = { o_id: 2, o_session_token: 'token-2', o_created_date: new Date().toISOString(), o_expires_date: new Date().toISOString() };
      
      vi.mocked(invokeProcScalar)
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const result1 = await createSession(1, '127.0.0.1', 'Agent', 'user');
      const result2 = await createSession(1, '127.0.0.1', 'Agent', 'user');

      // Each call generates its own token via randomBytes, so they differ
      expect(result1.sessionToken).not.toBe(result2.sessionToken);
    });
  });

  describe('validateSession', () => {
    it('should validate an active session', async () => {
      const mockResult = [
        {
          o_session_id: 1,
          o_operator_id: 1,
          o_is_valid: true,
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockResult);

      const result = await validateSession('valid-token');

      expect(result.isValid).toBe(true);
      expect(result.operatorId).toBe(1);
      expect(result.sessionId).toBe(1);
    });

    it('should reject invalid session', async () => {
      const mockResult = [
        {
          o_session_id: null,
          o_operator_id: null,
          o_is_valid: false,
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockResult);

      const result = await validateSession('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.operatorId).toBeNull();
    });

    it('should handle expired session', async () => {
      const mockResult = [
        {
          o_session_id: null,
          o_operator_id: null,
          o_is_valid: false,
        },
      ];
      vi.mocked(invokeProc).mockResolvedValueOnce(mockResult);

      const result = await validateSession('expired-token');

      expect(result.isValid).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session', async () => {
      vi.mocked(invokeProcScalar).mockResolvedValueOnce({ o_success: true });

      const result = await revokeSession('valid-token', 'operator');

      expect(result).toBe(true);
      expect(invokeProcScalar).toHaveBeenCalledWith('sp_operator_sessions_revoke', {
        i_session_token: 'valid-token',
        i_updated_by: 'operator',
      });
    });

    it('should handle revoke failure gracefully', async () => {
      vi.mocked(invokeProcScalar).mockRejectedValueOnce(new Error('DB error'));

      await expect(revokeSession('token', 'operator')).rejects.toThrow('DB error');
    });
  });

  describe('session timeout behavior', () => {
    it('should use configured timeout values', async () => {
      const mockResult = {
        o_id: 1,
        o_session_token: 'token',
        o_created_date: new Date().toISOString(),
        o_expires_date: new Date(Date.now() + 2592000000).toISOString(), // 30 days
      };
      vi.mocked(invokeProcScalar).mockResolvedValueOnce(mockResult);

      await createSession(1, '127.0.0.1', 'Agent', 'user');

      // Verify the call used correct timeout values from env
      expect(invokeProcScalar).toHaveBeenCalledWith(
        'sp_operator_sessions_create',
        expect.objectContaining({
          i_idle_timeout_hours: 8, // From vitest.setup.ts
          i_absolute_timeout_days: 30,
        })
      );
    });
  });
});
