// Stored procedure invocation wrapper
// Per global rules: All database access must go through stored procedures
// No ad-hoc SQL in application code
// Uses snake_case for parameters, returns tabular/scalar datasets only (no JSON)

import { PoolClient } from 'pg';
import { withTransaction } from './transaction';

/**
 * Parameters for stored procedure invocation
 * All parameters use snake_case per global rules
 */
export interface ProcParams {
  [key: string]: unknown;
}

/**
 * Result of a stored procedure call
 * Returns tabular data (rows) or scalar values
 */
export interface ProcResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

/**
 * Invoke a stored procedure that returns a result set
 * Uses parameterized queries to prevent SQL injection
 */
export async function invokeProc(
  procName: string,
  params: ProcParams = {},
  options: { useTransaction?: boolean } = {}
): Promise<ProcResult> {
  const { useTransaction = false } = options;

  // Build parameter placeholders ($1, $2, ...)
  const paramKeys = Object.keys(params);
  const paramValues = Object.values(params);
  const placeholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ');

  // Build the function call: SELECT * FROM schema.proc_name(arg1, arg2, ...)
  const sql = `SELECT * FROM public.${procName}(${placeholders})`;

  if (useTransaction) {
    return withTransaction(async ({ client }) => {
      const result = await client.query(sql, paramValues);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    });
  }

  // Non-transactional call (for read-only procs)
  const { getPool } = await import('./client');
  const pool = getPool();
  const result = await pool.query(sql, paramValues);

  return {
    rows: result.rows,
    rowCount: result.rowCount || 0,
  };
}

/**
 * Invoke a stored procedure within an existing transaction
 * Used when multiple procs need to be called in one transaction
 */
export async function invokeProcInTransaction(
  client: PoolClient,
  procName: string,
  params: ProcParams = {}
): Promise<ProcResult> {
  const paramKeys = Object.keys(params);
  const paramValues = Object.values(params);
  const placeholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `SELECT * FROM public.${procName}(${placeholders})`;

  const result = await client.query(sql, paramValues);

  return {
    rows: result.rows,
    rowCount: result.rowCount || 0,
  };
}

/**
 * Invoke a stored procedure that returns a single scalar value
 * Returns the first column of the first row, or null if no results
 */
export async function invokeProcScalar<T = unknown>(
  procName: string,
  params: ProcParams = {}
): Promise<T | null> {
  const result = await invokeProc(procName, params);
  if (result.rows.length === 0) {
    return null;
  }
  const firstRow = result.rows[0] as Record<string, unknown>;
  const firstKey = Object.keys(firstRow)[0];
  return (firstRow[firstKey] as T) || null;
}

/**
 * Invoke a stored procedure that performs write operations
 * Automatically uses transaction for data integrity
 */
export async function invokeProcWrite(
  procName: string,
  params: ProcParams = {}
): Promise<ProcResult> {
  return invokeProc(procName, params, { useTransaction: true });
}
