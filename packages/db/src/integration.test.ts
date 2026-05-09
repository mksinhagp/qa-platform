import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock pg before importing modules that use it
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});
const mockEnd = vi.fn();
const mockOn = vi.fn();
const mockPoolInstance = {
  connect: mockConnect,
  query: mockQuery,
  end: mockEnd,
  on: mockOn,
};

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => mockPoolInstance),
}));

vi.mock('@qa-platform/config', () => ({
  loadEnv: vi.fn(),
  resetEnv: vi.fn(),
  getEnv: vi.fn().mockReturnValue({
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: 5434,
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_DB: 'qa_platform',
  }),
}));

// Import after mocks are set up
import { invokeProc, invokeProcScalar, invokeProcWrite } from './procedures';
import { withTransaction, query } from './transaction';
import { initializePool, getClient, closePool } from './client';

describe('db integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockReset();
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
    mockEnd.mockReset();
    // Initialize pool so getPool() doesn't throw
    initializePool({
      host: 'localhost',
      port: 5434,
      user: 'postgres',
      password: 'postgres',
      database: 'qa_platform',
    });
  });

  describe('invokeProc', () => {
    it('should invoke stored procedure and return rows', async () => {
      const mockRows = [
        { o_id: 1, o_name: 'Test' },
        { o_id: 2, o_name: 'Test 2' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await invokeProc('sp_test_list', { i_param: 'value' });

      expect(result).toEqual(mockRows);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM public.sp_test_list($1)',
        ['value']
      );
    });

    it('should handle null parameters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await invokeProc('sp_test_list', { i_param: null });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM public.sp_test_list($1)',
        [null]
      );
    });

    it('should handle empty parameters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await invokeProc('sp_test_list', {});

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM public.sp_test_list()',
        []
      );
    });
  });

  describe('invokeProcScalar', () => {
    it('should return first row from result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ o_id: 42, o_name: 'test' }] });

      const result = await invokeProcScalar('sp_test_insert', { i_name: 'test' });

      expect(result).toEqual({ o_id: 42, o_name: 'test' });
    });

    it('should return null for empty result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await invokeProcScalar('sp_test_insert', {});

      expect(result).toBeNull();
    });
  });

  describe('invokeProcWrite', () => {
    it('should execute write operation in transaction', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ o_id: 1 }] }) // procedure
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await invokeProcWrite('sp_test_insert', { i_name: 'test' });

      expect(result).toEqual([{ o_id: 1 }]);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('withTransaction', () => {
    it('should execute operations in transaction and commit on success', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ o_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ o_id: 2 }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await withTransaction(async ({ client }) => {
        const r1 = await client.query('SELECT * FROM test1');
        const r2 = await client.query('SELECT * FROM test2');
        return [r1.rows[0], r2.rows[0]];
      });

      expect(result).toEqual([{ o_id: 1 }, { o_id: 2 }]);
      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ o_id: 1 }] })
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        withTransaction(async ({ client }) => {
          await client.query('SELECT * FROM test1');
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockQuery).not.toHaveBeenCalledWith('COMMIT');
    });

    it('should release client after transaction', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await withTransaction(async () => 'result');

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should execute read-only query without transaction', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ o_id: 1 }] });

      const result = await query('SELECT * FROM test WHERE id = $1', [1]);

      expect(result).toEqual([{ o_id: 1 }]);
      expect(mockQuery).not.toHaveBeenCalledWith('BEGIN');
    });

    it('should handle query errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(query('SELECT * FROM test', [])).rejects.toThrow('Connection failed');
    });
  });

  describe('connection pool', () => {
    it('should create singleton pool', async () => {
      const client1 = await getClient();
      const client2 = await getClient();
      
      // Both calls should use same pool (connect called twice)
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should close pool', async () => {
      await closePool();
      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
