'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { unlink } from 'node:fs/promises';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetentionAuditRow {
  artifact_type: string;
  total_count: number;
  expired_count: number;
  total_size_bytes: number;
  oldest_artifact: string | null;
  retention_days: number | null;
}

export interface RetentionConfigRow {
  id: number;
  artifact_type: string;
  retention_days: number;
  is_active: boolean;
  notes: string | null;
  updated_date: string;
}

export interface ExpiredArtifact {
  id: number;
  run_execution_id: number;
  artifact_type: string;
  file_path: string;
  file_size_bytes: number | null;
  retention_date: string | null;
  created_date: string;
}

export interface CleanupResult {
  found: number;
  files_deleted: number;
  files_missing: number;
  file_errors: number;
  db_deleted: number;
}

// ─── Retention Audit ─────────────────────────────────────────────────────────

/**
 * Return per-artifact-type retention audit summary.
 * Calls sp_artifacts_retention_audit (no params).
 */
export async function getRetentionAudit(): Promise<{
  success: boolean;
  rows?: RetentionAuditRow[];
  error?: string;
}> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_artifacts_retention_audit', {});
    const rows: RetentionAuditRow[] = result.map((row: {
      o_artifact_type: string;
      o_total_count: string;
      o_expired_count: string;
      o_total_size_bytes: string;
      o_oldest_artifact: string | null;
      o_retention_days: number | null;
    }) => ({
      artifact_type: row.o_artifact_type,
      total_count: Number(row.o_total_count) || 0,
      expired_count: Number(row.o_expired_count) || 0,
      total_size_bytes: Number(row.o_total_size_bytes) || 0,
      oldest_artifact: row.o_oldest_artifact ?? null,
      retention_days: row.o_retention_days ?? null,
    }));
    return { success: true, rows };
  } catch (error) {
    console.error('getRetentionAudit error:', error);
    return { success: false, error: 'Failed to load retention audit' };
  }
}

// ─── Retention Config ─────────────────────────────────────────────────────────

/**
 * Return all artifact_retention_config rows.
 * Calls sp_artifact_retention_config_list (no params).
 */
export async function getRetentionConfig(): Promise<{
  success: boolean;
  config?: RetentionConfigRow[];
  error?: string;
}> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_artifact_retention_config_list', {});
    const config: RetentionConfigRow[] = result.map((row: {
      o_id: number;
      o_artifact_type: string;
      o_retention_days: number;
      o_is_active: boolean;
      o_notes: string | null;
      o_updated_date: string;
    }) => ({
      id: row.o_id,
      artifact_type: row.o_artifact_type,
      retention_days: row.o_retention_days,
      is_active: row.o_is_active,
      notes: row.o_notes ?? null,
      updated_date: row.o_updated_date,
    }));
    return { success: true, config };
  } catch (error) {
    console.error('getRetentionConfig error:', error);
    return { success: false, error: 'Failed to load retention config' };
  }
}

// ─── Update Retention Config ──────────────────────────────────────────────────

/**
 * Update retention_days (and optional notes) for a given artifact type.
 * Calls sp_artifact_retention_config_update.
 */
export async function updateRetentionConfig(
  artifact_type: string,
  retention_days: number,
  notes?: string,
): Promise<{
  success: boolean;
  row?: RetentionConfigRow;
  error?: string;
}> {
  try {
    const authContext = await requireOperator();
    if (!artifact_type || typeof artifact_type !== 'string') {
      return { success: false, error: 'artifact_type is required' };
    }
    if (!Number.isInteger(retention_days) || retention_days < 1) {
      return { success: false, error: 'retention_days must be a positive integer' };
    }

    const result = await invokeProcWrite('sp_artifact_retention_config_update', {
      i_artifact_type: artifact_type,
      i_retention_days: retention_days,
      i_notes: notes ?? null,
      i_updated_by: authContext.operatorId.toString(),
    });

    if (!result.length) {
      return { success: false, error: `No config row found for artifact_type '${artifact_type}'` };
    }

    const row = result[0] as {
      o_id: number;
      o_artifact_type: string;
      o_retention_days: number;
      o_updated_date: string;
    };

    return {
      success: true,
      row: {
        id: row.o_id,
        artifact_type: row.o_artifact_type,
        retention_days: row.o_retention_days,
        is_active: true,
        notes: notes ?? null,
        updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    console.error('updateRetentionConfig error:', error);
    return { success: false, error: 'Failed to update retention config' };
  }
}

// ─── List Expired Artifacts ───────────────────────────────────────────────────

/**
 * Return expired artifact records (up to limit).
 * Calls sp_artifacts_list_expired.
 */
export async function listExpiredArtifacts(limit = 500): Promise<{
  success: boolean;
  artifacts?: ExpiredArtifact[];
  error?: string;
}> {
  try {
    await requireOperator();
    const safeLimit = Math.max(1, Math.min(limit, 2000));
    const result = await invokeProc('sp_artifacts_list_expired', {
      i_limit: safeLimit,
    });
    const artifacts: ExpiredArtifact[] = result.map((row: {
      o_id: number;
      o_run_execution_id: number;
      o_artifact_type: string;
      o_file_path: string;
      o_file_size_bytes: string | null;
      o_retention_date: string | null;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      run_execution_id: row.o_run_execution_id,
      artifact_type: row.o_artifact_type,
      file_path: row.o_file_path,
      file_size_bytes: row.o_file_size_bytes !== null
        ? Number(row.o_file_size_bytes)
        : null,
      retention_date: row.o_retention_date ?? null,
      created_date: row.o_created_date,
    }));
    return { success: true, artifacts };
  } catch (error) {
    console.error('listExpiredArtifacts error:', error);
    return { success: false, error: 'Failed to list expired artifacts' };
  }
}

// ─── Run Inline Cleanup ───────────────────────────────────────────────────────

/**
 * Run a synchronous, in-process cleanup for up to 100 expired artifacts.
 * Intended for operator-triggered manual cleanup from the dashboard UI.
 * Uses the same logic as the cron cleanup-job.ts but capped at 100 items
 * to remain safe for a server action context.
 */
export async function runInlineCleanup(): Promise<{
  success: boolean;
  result?: CleanupResult;
  error?: string;
}> {
  const UI_CLEANUP_LIMIT = 100;
  try {
    await requireOperator();

    // Fetch expired artifacts (capped for UI safety)
    const expiredResult = await listExpiredArtifacts(UI_CLEANUP_LIMIT);
    if (!expiredResult.success || !expiredResult.artifacts) {
      return { success: false, error: expiredResult.error ?? 'Failed to fetch expired artifacts' };
    }

    const expired = expiredResult.artifacts;
    if (expired.length === 0) {
      return {
        success: true,
        result: { found: 0, files_deleted: 0, files_missing: 0, file_errors: 0, db_deleted: 0 },
      };
    }

    let filesDeleted = 0;
    let filesMissing = 0;
    let fileErrors = 0;
    const successIds: number[] = [];

    // Attempt to delete each file from disk
    for (const artifact of expired) {
      try {
        await unlink(artifact.file_path);
        filesDeleted++;
        successIds.push(artifact.id);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          filesMissing++;
          successIds.push(artifact.id); // File already gone — still clean DB row
        } else {
          fileErrors++;
          console.error(`[runInlineCleanup] I/O error deleting ${artifact.file_path}: ${nodeErr.message}`);
        }
      }
    }

    // Remove DB records for files that are confirmed gone
    let dbDeleted = 0;
    if (successIds.length > 0) {
      const deleteResult = await invokeProcWrite('sp_artifacts_mark_deleted', {
        i_artifact_ids: successIds,
      });
      const row = deleteResult[0] as { o_deleted_count: number } | undefined;
      dbDeleted = row?.o_deleted_count ?? 0;
    }

    return {
      success: true,
      result: {
        found: expired.length,
        files_deleted: filesDeleted,
        files_missing: filesMissing,
        file_errors: fileErrors,
        db_deleted: dbDeleted,
      },
    };
  } catch (error) {
    console.error('runInlineCleanup error:', error);
    return { success: false, error: 'Cleanup failed' };
  }
}
