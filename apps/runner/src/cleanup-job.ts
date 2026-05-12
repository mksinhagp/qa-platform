/**
 * cleanup-job.ts — Artifact Retention Cleanup Job
 * Phase 11.1: Retention enforcement audits and cleanup
 *
 * Purpose:
 *   Standalone script that enforces artifact retention policy:
 *   1. Queries sp_artifacts_list_expired to retrieve expired artifact records.
 *   2. Attempts fs.unlink for each file path (ENOENT is treated as success —
 *      the file is already gone).
 *   3. Calls sp_artifacts_mark_deleted with the batch of IDs to remove DB rows.
 *   4. Prints a summary: found / file-deleted / db-deleted / failures.
 *   5. Exits 0 on success, 1 on any unrecoverable error.
 *
 * Usage:
 *   npx tsx apps/runner/src/cleanup-job.ts
 *
 * Environment variables (same as main runner; can be in .env):
 *   DATABASE_URL  — PostgreSQL connection string, e.g.
 *                   postgres://user:pass@localhost:5432/qa_platform
 *   CLEANUP_LIMIT — Maximum artifacts to process per run (default: 500)
 */

import { unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Env loading ─────────────────────────────────────────────────────────────

/**
 * Load a .env file from the monorepo root without an external dependency.
 * Only sets variables that are not already present in process.env so that
 * Docker / CI environment variables take precedence.
 */
function loadDotEnv(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Walk up from apps/runner/src to the repo root
  const envPath = path.resolve(__dirname, '..', '..', '..', '.env');

  // Use createRequire to get fs synchronously without a top-level import
  const req = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = req('node:fs') as typeof import('node:fs');

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip matching outer quotes (single or double), keeping inner content intact
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else {
        // Unquoted value: strip inline comment (space + # ...)
        const commentIdx = val.indexOf(' #');
        if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env not present — rely entirely on process.env
  }
}

loadDotEnv();

// ─── Minimal pg client wrapper ────────────────────────────────────────────────
// We use a fully dynamic import to avoid a compile-time dependency on `pg` in
// the runner package.  At runtime tsx resolves the pnpm workspace symlink to
// packages/db/node_modules/pg.

interface DbRow {
  [key: string]: unknown;
}

interface MinimalClient {
  connect(): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(sql: string, values?: unknown[]): Promise<{ rows: DbRow[]; rowCount: number | null }>;
  end(): Promise<void>;
}

async function createPgClient(): Promise<MinimalClient> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is required. ' +
      'Set it in .env or pass it directly.',
    );
  }

  // Use an indirect dynamic import so the TypeScript compiler in the runner
  // package does not try to resolve 'pg' at type-check time (pg is not in
  // runner's package.json; it is available at runtime via the pnpm workspace
  // symlink in packages/db/node_modules/pg).
  // The string concatenation defeats static module graph analysis intentionally.
  const pgModuleName = 'p' + 'g';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgModule = (await import(/* @vite-ignore */ pgModuleName)) as any;
  const Client = (pgModule.default?.Client ?? pgModule.Client) as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new(opts: { connectionString: string }): MinimalClient;
  };

  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

// ─── Proc invocation helpers ─────────────────────────────────────────────────

async function invokeProc(
  client: MinimalClient,
  procName: string,
  params: Record<string, unknown> = {},
): Promise<DbRow[]> {
  const entries = Object.entries(params);
  const values = entries.map(([, value]) => value);
  // Build placeholders: JavaScript arrays are serialised by the pg driver as
  // text array literals (e.g. {"1","2","3"}).  Add an explicit ::integer[] cast
  // for any value that is a JavaScript Array so PostgreSQL receives the correct
  // type without relying on implicit coercion. Use named function arguments so
  // callers cannot accidentally swap values when a proc has multiple params.
  const placeholders = entries
    .map(([key, value], i) => {
      const placeholder = Array.isArray(value) ? `$${i + 1}::integer[]` : `$${i + 1}`;
      return `${key} => ${placeholder}`;
    })
    .join(', ');
  const sql = `SELECT * FROM public.${procName}(${placeholders})`;
  const result = await client.query(sql, values);
  return result.rows;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExpiredArtifactRow extends DbRow {
  o_id: number;
  o_run_execution_id: number;
  o_artifact_type: string;
  o_file_path: string;
  o_file_size_bytes: string | null; // pg returns BIGINT as string
  o_retention_date: string | null;
  o_created_date: string;
}

interface DeletedCountRow extends DbRow {
  o_deleted_count: number;
}

// ─── Core cleanup logic ───────────────────────────────────────────────────────

async function runCleanup(): Promise<void> {
  const limit = Math.max(1, parseInt(process.env.CLEANUP_LIMIT ?? '500', 10) || 500);

  console.log(`[cleanup-job] Starting artifact retention cleanup (limit=${limit})`);

  const client = await createPgClient();

  try {
    // 1. Query expired artifacts
    const expired = await invokeProc(
      client,
      'sp_artifacts_list_expired',
      { i_limit: limit },
    ) as ExpiredArtifactRow[];

    console.log(`[cleanup-job] Found ${expired.length} expired artifact(s)`);

    if (expired.length === 0) {
      console.log('[cleanup-job] Nothing to clean up. Exiting.');
      return;
    }

    // 2. Attempt to delete each file from disk
    let filesDeleted = 0;
    let filesMissing = 0;
    let filesFailed = 0;
    const missingParentDirs = new Set<string>();
    const successIds: number[] = [];

    for (const artifact of expired) {
      const filePath = artifact.o_file_path;
      const id = artifact.o_id;

      try {
        await unlink(filePath);
        filesDeleted++;
        successIds.push(id);
        console.log(`[cleanup-job]   deleted file: ${filePath}`);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          // File already gone — still mark DB row as deleted
          filesMissing++;
          missingParentDirs.add(path.dirname(filePath));
          successIds.push(id);
          console.warn(`[cleanup-job]   file not found (already removed): ${filePath}`);
        } else {
          // Unexpected I/O error — log but do not remove DB row
          filesFailed++;
          console.error(
            `[cleanup-job]   ERROR deleting file ${filePath}: ${nodeErr.message}`,
          );
        }
      }
    }

    // 3. Remove DB records for all artifacts whose files are confirmed gone
    let dbDeleted = 0;

    if (successIds.length > 0) {
      const rows = await invokeProc(
        client,
        'sp_artifacts_mark_deleted',
        { i_artifact_ids: successIds },
      ) as DeletedCountRow[];
      dbDeleted = rows[0]?.o_deleted_count ?? 0;
    }

    // 4. Summary
    console.log(
      `[cleanup-job] Summary — ` +
      `found: ${expired.length}, ` +
      `files deleted: ${filesDeleted}, ` +
      `files missing (already gone): ${filesMissing}, ` +
      `file errors (skipped): ${filesFailed}, ` +
      `DB rows removed: ${dbDeleted}`,
    );

    if (filesFailed > 0) {
      console.warn(
        `[cleanup-job] ${filesFailed} file(s) could not be deleted due to I/O errors. ` +
        'Their DB records were retained. Review the errors above.',
      );
    }

    if (filesMissing > 0) {
      console.warn(
        `[cleanup-job] ${filesMissing} file path(s) were already missing across ` +
        `${missingParentDirs.size} parent director${missingParentDirs.size === 1 ? 'y' : 'ies'}. ` +
        'Verify artifact roots if this count is unexpectedly high.',
      );
    }
  } finally {
    await client.end();
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

runCleanup().then(() => {
  process.exit(0);
}).catch((err: unknown) => {
  console.error('[cleanup-job] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
