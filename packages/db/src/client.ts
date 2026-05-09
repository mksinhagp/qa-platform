// PostgreSQL client singleton with connection pooling
// Per global rules: All database access must go through stored procedures
// This client is only used by the proc-invocation wrapper

import { Pool, PoolConfig, PoolClient } from 'pg';

let poolInstance: Pool | null = null;

/**
 * Initialize the PostgreSQL connection pool
 * Must be called before any database operations
 */
export function initializePool(config?: PoolConfig): Pool {
  if (poolInstance) {
    return poolInstance;
  }

  const sslMode = process.env.POSTGRES_SSL_MODE;

  // Default configuration overrides for safety
  const poolConfig: PoolConfig = {
    host: process.env.POSTGRES_HOST ?? 'postgres',
    port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432,
    database: process.env.POSTGRES_DB ?? 'qa_platform',
    user: process.env.POSTGRES_USER ?? 'qa_user',
    password: process.env.POSTGRES_PASSWORD,
    ...config,
    ssl: sslMode && sslMode !== 'disable' ? { rejectUnauthorized: sslMode === 'require' } : config?.ssl,
    max: config?.max || 20,
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 2000,
  };

  poolInstance = new Pool(poolConfig);

  // Handle pool errors
  poolInstance.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  return poolInstance;
}

/**
 * Get the existing pool instance
 * Throws if pool has not been initialized
 */
export function getPool(): Pool {
  if (!poolInstance) {
    throw new Error('PostgreSQL pool not initialized. Call initializePool() first.');
  }
  return poolInstance;
}

/**
 * Close the connection pool gracefully
 * Should be called on application shutdown
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * Get a client from the pool for direct use
 * Used internally by transaction helper
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}
