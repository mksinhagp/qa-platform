'use server';

/**
 * Admin Test Results Server Actions — Phase 7
 *
 * These actions are called by the dashboard UI to fetch admin/back-office test
 * suite results and individual assertion details for a given run execution.
 *
 * Data is written by the /api/runner/callback route when it receives
 * an 'admin_test_result' payload from the runner's admin flow post-step.
 */

import { invokeProc } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminTestSuiteRecord {
  id: number;
  run_execution_id: number;
  suite_type: string;
  status: string;
  total_assertions: number;
  passed_assertions: number;
  failed_assertions: number;
  skipped_assertions: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_date: string;
  updated_date: string;
}

export interface AdminTestAssertionRecord {
  id: number;
  admin_test_suite_id: number;
  assertion_name: string;
  status: string;
  page_url: string | null;
  expected_value: string | null;
  actual_value: string | null;
  error_message: string | null;
  detail: Record<string, unknown> | null;
  created_date: string;
  updated_date: string;
}

// ─── List Suites by Execution ────────────────────────────────────────────────

export async function listAdminTestSuites(
  runExecutionId: number,
): Promise<{ success: boolean; suites?: AdminTestSuiteRecord[]; error?: string }> {
  try {
    await requireCapability('run.read');
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    type Row = {
      o_id: number;
      o_run_execution_id: number;
      o_suite_type: string;
      o_status: string;
      o_total_assertions: number;
      o_passed_assertions: number;
      o_failed_assertions: number;
      o_skipped_assertions: number;
      o_started_at: string | null;
      o_completed_at: string | null;
      o_duration_ms: number | null;
      o_error_message: string | null;
      o_metadata: Record<string, unknown> | null;
      o_created_date: string;
      o_updated_date: string;
    };

    const rows = (await invokeProc('sp_admin_test_suites_list_by_execution', {
      i_run_execution_id: runExecutionId,
    })) as Row[];

    const suites: AdminTestSuiteRecord[] = rows.map(r => ({
      id: r.o_id,
      run_execution_id: r.o_run_execution_id,
      suite_type: r.o_suite_type,
      status: r.o_status,
      total_assertions: r.o_total_assertions,
      passed_assertions: r.o_passed_assertions,
      failed_assertions: r.o_failed_assertions,
      skipped_assertions: r.o_skipped_assertions,
      started_at: r.o_started_at ? new Date(r.o_started_at).toISOString() : null,
      completed_at: r.o_completed_at ? new Date(r.o_completed_at).toISOString() : null,
      duration_ms: r.o_duration_ms,
      error_message: r.o_error_message,
      metadata: r.o_metadata,
      created_date: new Date(r.o_created_date).toISOString(),
      updated_date: new Date(r.o_updated_date).toISOString(),
    }));

    return { success: true, suites };
  } catch (err) {
    console.error('Failed to list admin test suites:', err);
    return { success: false, error: 'Failed to load admin test suites' };
  }
}

// ─── List Assertions by Suite ────────────────────────────────────────────────

export async function listAdminTestAssertions(
  adminTestSuiteId: number,
): Promise<{ success: boolean; assertions?: AdminTestAssertionRecord[]; error?: string }> {
  try {
    await requireCapability('run.read');
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    type Row = {
      o_id: number;
      o_admin_test_suite_id: number;
      o_assertion_name: string;
      o_status: string;
      o_page_url: string | null;
      o_expected_value: string | null;
      o_actual_value: string | null;
      o_error_message: string | null;
      o_detail: Record<string, unknown> | null;
      o_created_date: string;
      o_updated_date: string;
    };

    const rows = (await invokeProc('sp_admin_test_assertions_list_by_suite', {
      i_admin_test_suite_id: adminTestSuiteId,
    })) as Row[];

    const assertions: AdminTestAssertionRecord[] = rows.map(r => ({
      id: r.o_id,
      admin_test_suite_id: r.o_admin_test_suite_id,
      assertion_name: r.o_assertion_name,
      status: r.o_status,
      page_url: r.o_page_url,
      expected_value: r.o_expected_value,
      actual_value: r.o_actual_value,
      error_message: r.o_error_message,
      detail: r.o_detail,
      created_date: new Date(r.o_created_date).toISOString(),
      updated_date: new Date(r.o_updated_date).toISOString(),
    }));

    return { success: true, assertions };
  } catch (err) {
    console.error('Failed to list admin test assertions:', err);
    return { success: false, error: 'Failed to load admin test assertions' };
  }
}
