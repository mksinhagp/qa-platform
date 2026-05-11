/**
 * Unit tests for adminTestResults server actions — Phase 7
 *
 * Covers: listAdminTestSuites, listAdminTestAssertions
 * Pattern mirrors runs.test.ts: mock @qa-platform/db + @qa-platform/auth,
 * verify proc calls, error handling, auth gating.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listAdminTestSuites,
  listAdminTestAssertions,
} from './adminTestResults';
import { invokeProc } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcWrite: vi.fn(),
}));

vi.mock('@qa-platform/auth', () => ({
  requireCapability: vi.fn(),
}));

const AUTH_CTX = { operatorId: 42, sessionId: 1 };

// ─── Sample rows ─────────────────────────────────────────────────────────────

const SUITE_ROW = {
  o_id: 10,
  o_run_execution_id: 200,
  o_suite_type: 'admin_login',
  o_status: 'passed',
  o_total_assertions: 3,
  o_passed_assertions: 3,
  o_failed_assertions: 0,
  o_skipped_assertions: 0,
  o_started_at: '2026-05-10T00:00:00Z',
  o_completed_at: '2026-05-10T00:00:05Z',
  o_duration_ms: 5000,
  o_error_message: null,
  o_metadata: null,
  o_created_date: '2026-05-10T00:00:00Z',
  o_updated_date: '2026-05-10T00:00:00Z',
};

const SUITE_ROW_2 = {
  ...SUITE_ROW,
  o_id: 11,
  o_suite_type: 'booking_lookup',
  o_status: 'failed',
  o_total_assertions: 2,
  o_passed_assertions: 1,
  o_failed_assertions: 1,
};

const ASSERTION_ROW = {
  o_id: 100,
  o_admin_test_suite_id: 10,
  o_assertion_name: 'login_form_visible',
  o_status: 'passed',
  o_page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/login',
  o_expected_value: null,
  o_actual_value: null,
  o_error_message: null,
  o_detail: null,
  o_created_date: '2026-05-10T00:00:01Z',
  o_updated_date: '2026-05-10T00:00:01Z',
};

const ASSERTION_ROW_FAILED = {
  ...ASSERTION_ROW,
  o_id: 101,
  o_assertion_name: 'admin_dashboard_reached',
  o_status: 'failed',
  o_page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/admin',
  o_expected_value: 'admin dashboard visible',
  o_actual_value: 'no dashboard found',
  o_error_message: 'Admin dashboard not reached after login',
  o_detail: { selector: 'nav' },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireCapability).mockResolvedValue(AUTH_CTX);
});

// ─── listAdminTestSuites ────────────────────────────────────────────────────

describe('listAdminTestSuites', () => {
  it('returns mapped suite list on success', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([SUITE_ROW, SUITE_ROW_2]);

    const result = await listAdminTestSuites(200);

    expect(result.success).toBe(true);
    expect(result.suites).toHaveLength(2);
    expect(result.suites![0]).toMatchObject({
      id: 10,
      run_execution_id: 200,
      suite_type: 'admin_login',
      status: 'passed',
      total_assertions: 3,
      passed_assertions: 3,
      failed_assertions: 0,
      skipped_assertions: 0,
    });
    expect(result.suites![1]).toMatchObject({
      id: 11,
      suite_type: 'booking_lookup',
      status: 'failed',
    });
  });

  it('passes execution id to proc', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    await listAdminTestSuites(200);

    expect(invokeProc).toHaveBeenCalledWith(
      'sp_admin_test_suites_list_by_execution',
      { i_run_execution_id: 200 },
    );
  });

  it('returns empty array when no suites exist', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    const result = await listAdminTestSuites(999);

    expect(result.success).toBe(true);
    expect(result.suites).toHaveLength(0);
  });

  it('maps date fields to ISO strings', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([SUITE_ROW]);

    const result = await listAdminTestSuites(200);

    expect(result.suites![0].started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.suites![0].completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.suites![0].created_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.suites![0].updated_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles null date fields', async () => {
    const rowWithNulls = {
      ...SUITE_ROW,
      o_started_at: null,
      o_completed_at: null,
    };
    vi.mocked(invokeProc).mockResolvedValueOnce([rowWithNulls]);

    const result = await listAdminTestSuites(200);

    expect(result.suites![0].started_at).toBeNull();
    expect(result.suites![0].completed_at).toBeNull();
  });

  it('returns error on DB failure', async () => {
    vi.mocked(invokeProc).mockRejectedValueOnce(new Error('connection refused'));

    const result = await listAdminTestSuites(200);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to load admin test suites/i);
  });

  it('enforces run.read capability', async () => {
    vi.mocked(requireCapability).mockRejectedValueOnce(new Error('Forbidden'));

    const result = await listAdminTestSuites(200);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unauthorized/i);
  });
});

// ─── listAdminTestAssertions ────────────────────────────────────────────────

describe('listAdminTestAssertions', () => {
  it('returns mapped assertion list on success', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([ASSERTION_ROW, ASSERTION_ROW_FAILED]);

    const result = await listAdminTestAssertions(10);

    expect(result.success).toBe(true);
    expect(result.assertions).toHaveLength(2);
    expect(result.assertions![0]).toMatchObject({
      id: 100,
      admin_test_suite_id: 10,
      assertion_name: 'login_form_visible',
      status: 'passed',
      page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/login',
    });
    expect(result.assertions![1]).toMatchObject({
      id: 101,
      assertion_name: 'admin_dashboard_reached',
      status: 'failed',
      expected_value: 'admin dashboard visible',
      actual_value: 'no dashboard found',
      error_message: 'Admin dashboard not reached after login',
    });
  });

  it('passes suite id to proc', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    await listAdminTestAssertions(10);

    expect(invokeProc).toHaveBeenCalledWith(
      'sp_admin_test_assertions_list_by_suite',
      { i_admin_test_suite_id: 10 },
    );
  });

  it('returns empty array when no assertions exist', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([]);

    const result = await listAdminTestAssertions(999);

    expect(result.success).toBe(true);
    expect(result.assertions).toHaveLength(0);
  });

  it('maps date fields to ISO strings', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([ASSERTION_ROW]);

    const result = await listAdminTestAssertions(10);

    expect(result.assertions![0].created_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.assertions![0].updated_date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('preserves null optional fields', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([ASSERTION_ROW]);

    const result = await listAdminTestAssertions(10);

    expect(result.assertions![0].expected_value).toBeNull();
    expect(result.assertions![0].actual_value).toBeNull();
    expect(result.assertions![0].error_message).toBeNull();
    expect(result.assertions![0].detail).toBeNull();
  });

  it('preserves detail object when present', async () => {
    vi.mocked(invokeProc).mockResolvedValueOnce([ASSERTION_ROW_FAILED]);

    const result = await listAdminTestAssertions(10);

    expect(result.assertions![0].detail).toEqual({ selector: 'nav' });
  });

  it('returns error on DB failure', async () => {
    vi.mocked(invokeProc).mockRejectedValueOnce(new Error('connection refused'));

    const result = await listAdminTestAssertions(10);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to load admin test assertions/i);
  });

  it('enforces run.read capability', async () => {
    vi.mocked(requireCapability).mockRejectedValueOnce(new Error('Forbidden'));

    const result = await listAdminTestAssertions(10);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unauthorized/i);
  });
});
