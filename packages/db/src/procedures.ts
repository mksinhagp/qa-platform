// Stored procedure invocation wrapper
// Per global rules: All database access must go through stored procedures
// No ad-hoc SQL in application code
// Uses snake_case for parameters, returns tabular/scalar datasets only (no JSON)

import { PoolClient } from 'pg';
import { withTransaction } from './transaction';

const PROC_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function buildProcSql(procName: string, placeholders: string): string {
  if (!PROC_NAME_PATTERN.test(procName)) {
    throw new Error(`Invalid stored procedure name: ${procName}`);
  }
  return `SELECT * FROM public.${procName}(${placeholders})`;
}

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
 * Invoke a stored procedure that returns a result set (rows array)
 * Uses parameterized queries to prevent SQL injection
 */
export async function invokeProc<T = Record<string, unknown>>(
  procName: string,
  params: ProcParams = {},
  options: { useTransaction?: boolean } = {}
): Promise<T[]> {
  const { useTransaction = false } = options;

  // Build parameter placeholders ($1, $2, ...)
  const paramKeys = Object.keys(params);
  const paramValues = Object.values(params);
  const placeholders = paramKeys.map((_, i) => `$${i + 1}`).join(', ');

  // Build the function call: SELECT * FROM schema.proc_name(arg1, arg2, ...)
  const sql = buildProcSql(procName, placeholders);

  if (useTransaction) {
    return withTransaction(async ({ client }) => {
      const result = await client.query(sql, paramValues);
      return result.rows as T[];
    });
  }

  // Non-transactional call (for read-only procs)
  const { getPool } = await import('./client');
  const pool = getPool();
  const result = await pool.query(sql, paramValues);

  return result.rows as T[];
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
  const sql = buildProcSql(procName, placeholders);

  const result = await client.query(sql, paramValues);

  return {
    rows: result.rows,
    rowCount: result.rowCount || 0,
  };
}

/**
 * Invoke a stored procedure that returns a single row
 * Returns the first row as an object, or null if no results
 */
export async function invokeProcScalar<T = Record<string, unknown>>(
  procName: string,
  params: ProcParams = {}
): Promise<T | null> {
  const rows = await invokeProc<T>(procName, params);
  if (rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * Invoke a stored procedure that performs write operations
 * Automatically uses transaction for data integrity
 */
export async function invokeProcWrite<T = Record<string, unknown>>(
  procName: string,
  params: ProcParams = {}
): Promise<T[]> {
  return invokeProc<T>(procName, params, { useTransaction: true });
}
