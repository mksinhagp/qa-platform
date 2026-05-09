// Transaction helper for PostgreSQL
// Provides BEGIN, COMMIT, ROLLBACK with automatic cleanup
// Per global rules: Use snake_case for variables, audit columns in all operations

import { PoolClient } from 'pg';
import { getClient, getPool } from './client';

export interface TransactionContext {
  client: PoolClient;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Execute a callback within a database transaction
 * Automatically commits on success, rolls back on error
 * Ensures client is always released back to pool
 */
export async function withTransaction<T>(
  callback: (context: TransactionContext) => Promise<T>
): Promise<T> {
  const client = await getClient();
  let committed = false;

  try {
    await client.query('BEGIN');

    const context: TransactionContext = {
      client,
      async commit() {
        if (!committed) {
          await client.query('COMMIT');
          committed = true;
        }
      },
      async rollback() {
        if (!committed) {
          await client.query('ROLLBACK');
          committed = true;
        }
      },
    };

    const result = await callback(context);

    // Auto-commit if callback didn't explicitly commit/rollback
    if (!committed) {
      await client.query('COMMIT');
      committed = true;
    }

    return result;
  } catch (error) {
    // Rollback on any error
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError);
      }
    }
    throw error;
  } finally {
    // Always release client back to pool
    client.release();
  }
}

/**
 * Execute a read-only query without transaction overhead
 * Use for SELECT operations that don't need transactional consistency
 */
export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}
