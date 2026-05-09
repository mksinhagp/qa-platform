// Migration runner for numbered SQL files
// Applies migrations from db/migrations and db/procs directories
// Migrations are idempotent and numbered sequentially
// Per global rules: Number database scripts in serial order

import { promises as fs } from 'fs';
import path from 'path';
import { PoolClient } from 'pg';
import { getPool } from './client';
import { Logger } from '@qa-platform/shared-types';

// Migration record table name
const MIGRATIONS_TABLE = 'schema_migrations';

// Logger for structured logging
const logger = new Logger('migrator');

/**
 * Initialize the migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(14) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      checksum VARCHAR(64) NOT NULL
    );
  `);
}

/**
 * Calculate SHA-256 checksum of a file
 */
async function calculateChecksum(filePath: string): Promise<string> {
  const crypto = await import('crypto');
  const content = await fs.readFile(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Read SQL files from a directory, sorted by filename
 */
async function readSqlFiles(dirPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dirPath);
    const sqlFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort();
    return sqlFiles.map((f) => path.join(dirPath, f));
  } catch (error) {
    // Directory doesn't exist yet, return empty array
    return [];
  }
}

/**
 * Extract version number from migration filename
 * Expected format: 0001_description.sql or 0002_description.sql
 */
function extractVersion(filePath: string): string {
  const filename = path.basename(filePath);
  const match = filename.match(/^(\d{4})_/);
  if (!match) {
    throw new Error(`Invalid migration filename: ${filename}. Expected format: 0001_description.sql`);
  }
  return match[1];
}

/**
 * Check if a migration has already been applied
 */
async function isMigrationApplied(
  client: PoolClient,
  version: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM ${MIGRATIONS_TABLE} WHERE version = $1`,
    [version]
  );
  return result.rows.length > 0;
}

/**
 * Apply a single migration file
 */
async function applyMigration(
  client: PoolClient,
  filePath: string
): Promise<void> {
  const version = extractVersion(filePath);
  const checksum = await calculateChecksum(filePath);
  const content = await fs.readFile(filePath, 'utf-8');

  logger.info(`Applying migration ${version}`, { file: path.basename(filePath) });

  try {
    // Execute the entire file as a single statement
    // PostgreSQL handles multi-statement files with BEGIN/COMMIT blocks
    await client.query(content);

    // Record the migration
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (version, checksum) VALUES ($1, $2)`,
      [version, checksum]
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Failed to apply migration ${version}`, err, { file: path.basename(filePath) });
    throw new Error(`Migration ${version} (${path.basename(filePath)}) failed: ${err.message}`);
  }
}

/**
 * Run all pending migrations from a directory
 */
export interface MigrationOptions {
  migrationsDir?: string;
  procsDir?: string;
}

export async function runMigrations(options: MigrationOptions = {}): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const { migrationsDir = 'db/migrations', procsDir = 'db/procs' } = options;

    // Run schema migrations first
    const migrationFiles = await readSqlFiles(migrationsDir);
    for (const filePath of migrationFiles) {
      const version = extractVersion(filePath);
      const applied = await isMigrationApplied(client, version);

      if (!applied) {
        await applyMigration(client, filePath);
      } else {
        logger.info(`Skipping already applied migration ${version}`, { file: path.basename(filePath) });
      }
    }

    // Run stored procedures second
    const procFiles = await readSqlFiles(procsDir);
    for (const filePath of procFiles) {
      const version = extractVersion(filePath);
      const applied = await isMigrationApplied(client, version);

      if (!applied) {
        await applyMigration(client, filePath);
      } else {
        logger.info(`Skipping already applied proc ${version}`, { file: path.basename(filePath) });
      }
    }

    await client.query('COMMIT');
    logger.info('Migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Migration failed', error instanceof Error ? error : new Error(errMsg));
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get the current migration version
 */
export async function getCurrentVersion(): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version DESC LIMIT 1`
  );
  return result.rows.length > 0 ? (result.rows[0].version as string) : null;
}

/**
 * Get list of all applied migrations
 */
export async function getAppliedMigrations(): Promise<
  Array<{ version: string; applied_at: Date; checksum: string }>
> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT version, applied_at, checksum FROM ${MIGRATIONS_TABLE} ORDER BY version`
  );
  return result.rows;
}
