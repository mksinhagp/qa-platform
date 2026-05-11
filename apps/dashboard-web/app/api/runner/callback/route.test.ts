/**
 * Unit tests for POST /api/runner/callback — Phase 6 api_test_result branch.
 *
 * Also covers the shared preamble (missing token, invalid JSON, unknown type)
 * and the execution_result happy path to ensure the refactoring didn't break
 * other branches.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@qa-platform/db', () => ({
  invokeProc: vi.fn(),
  invokeProcWrite: vi.fn(),
}));

import { invokeProc, invokeProcWrite } from '@qa-platform/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/runner/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Runner-Token': 'test-token-abc',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function responseJson(req: NextRequest) {
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

// ─── Shared preamble tests ────────────────────────────────────────────────────

describe('POST /api/runner/callback — shared preamble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when X-Runner-Token header is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/runner/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'execution_result', execution_id: 1, status: 'passed' }),
    });
    const { status, body } = await responseJson(req);
    expect(status).toBe(401);
    expect(body.error).toMatch(/Missing runner token/i);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/runner/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Runner-Token': 'tok',
      },
      body: 'not-json',
    });
    const { status, body } = await responseJson(req);
    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid JSON/i);
  });

  it('returns 400 for unknown callback type', async () => {
    const { status, body } = await responseJson(makeRequest({ type: 'unknown_type' }));
    expect(status).toBe(400);
    expect(body.error).toMatch(/Unknown callback type/i);
  });
});

// ─── execution_result branch ──────────────────────────────────────────────────

describe('POST /api/runner/callback — execution_result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when execution_id or status missing', async () => {
    const { status, body } = await responseJson(
      makeRequest({ type: 'execution_result', execution_id: null }),
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/execution_id and status/i);
  });

  it('returns 200 on successful execution_result write', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([]);
    const { status, body } = await responseJson(
      makeRequest({
        type: 'execution_result',
        execution_id: 100,
        status: 'passed',
        friction_score: 0.42,
        started_at: '2026-05-10T00:00:00Z',
        completed_at: '2026-05-10T00:01:00Z',
      }),
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(vi.mocked(invokeProcWrite)).toHaveBeenCalledWith(
      'sp_run_executions_update_result',
      expect.objectContaining({
        i_id: 100,
        i_callback_token: 'test-token-abc',
        i_status: 'passed',
        i_friction_score: 0.42,
      }),
    );
  });

  it('returns 500 when proc throws', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(new Error('DB error'));
    const { status, body } = await responseJson(
      makeRequest({
        type: 'execution_result',
        execution_id: 100,
        status: 'failed',
      }),
    );
    expect(status).toBe(500);
    expect(body.error).toMatch(/Failed to record execution result/i);
  });
});

// ─── api_test_result branch (Phase 6) ─────────────────────────────────────────

const VALID_API_TEST_PAYLOAD = {
  type: 'api_test_result' as const,
  execution_id: 100,
  suites: [
    {
      suite_type: 'reachability',
      status: 'passed',
      total_assertions: 2,
      passed_assertions: 2,
      failed_assertions: 0,
      skipped_assertions: 0,
      started_at: '2026-05-10T00:00:00Z',
      completed_at: '2026-05-10T00:00:01Z',
      duration_ms: 1000,
      assertions: [
        {
          endpoint_url: '/api/health',
          http_method: 'GET',
          assertion_name: 'health_reachable',
          status: 'passed' as const,
          response_status: 200,
          response_time_ms: 45,
        },
        {
          endpoint_url: '/api/camps',
          http_method: 'GET',
          assertion_name: 'camps_reachable',
          status: 'passed' as const,
          response_status: 200,
          response_time_ms: 120,
        },
      ],
    },
    {
      suite_type: 'schema',
      status: 'failed',
      total_assertions: 1,
      passed_assertions: 0,
      failed_assertions: 1,
      skipped_assertions: 0,
      started_at: '2026-05-10T00:00:01Z',
      completed_at: '2026-05-10T00:00:02Z',
      duration_ms: 800,
      assertions: [
        {
          endpoint_url: '/api/camps',
          http_method: 'GET',
          assertion_name: 'camps_schema_valid',
          status: 'failed' as const,
          expected_value: 'array of Camp',
          actual_value: 'object',
          error_message: 'Expected array, got object',
          detail: { path: '$.data', schema_diff: 'type mismatch' },
        },
      ],
    },
  ],
};

describe('POST /api/runner/callback — api_test_result (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Zod validation ─────────────────────────────────────────────────────────

  it('returns 400 when execution_id is missing', async () => {
    const payload = { type: 'api_test_result', suites: VALID_API_TEST_PAYLOAD.suites };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid api_test_result payload/i);
    expect(body.details).toBeDefined();
  });

  it('returns 400 when suites is empty array', async () => {
    const payload = { type: 'api_test_result', execution_id: 100, suites: [] };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid api_test_result payload/i);
  });

  it('returns 400 when suite_type is invalid', async () => {
    const payload = {
      type: 'api_test_result',
      execution_id: 100,
      suites: [{
        suite_type: 'invalid_type',
        status: 'passed',
        assertions: [],
      }],
    };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
    expect(body.details).toBeDefined();
  });

  it('returns 400 when assertion status is invalid', async () => {
    const payload = {
      type: 'api_test_result',
      execution_id: 100,
      suites: [{
        suite_type: 'reachability',
        status: 'passed',
        assertions: [{
          endpoint_url: '/api/health',
          http_method: 'GET',
          assertion_name: 'test',
          status: 'banana',
        }],
      }],
    };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
  });

  it('returns 400 when total_assertions is negative', async () => {
    const payload = {
      type: 'api_test_result',
      execution_id: 100,
      suites: [{
        suite_type: 'reachability',
        status: 'passed',
        total_assertions: -1,
        assertions: [],
      }],
    };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
  });

  // ─── Successful write ─────────────────────────────────────────────────────

  it('returns 200 and calls sp_api_test_results_record on valid payload', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([
      { o_suite_id: 1, o_suite_type: 'reachability', o_status: 'passed' },
      { o_suite_id: 2, o_suite_type: 'schema', o_status: 'failed' },
    ]);

    const { status, body } = await responseJson(makeRequest(VALID_API_TEST_PAYLOAD));
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.suites_processed).toBe(2);

    expect(vi.mocked(invokeProcWrite)).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeProcWrite)).toHaveBeenCalledWith(
      'sp_api_test_results_record',
      expect.objectContaining({
        i_run_execution_id: 100,
        i_callback_token: 'test-token-abc',
        i_created_by: 'runner',
      }),
    );

    // Verify the suites JSON was serialised
    const callArgs = vi.mocked(invokeProcWrite).mock.calls[0][1] as Record<string, unknown>;
    const suitesJson = JSON.parse(callArgs.i_suites_json as string);
    expect(suitesJson).toHaveLength(2);
    expect(suitesJson[0].suite_type).toBe('reachability');
    expect(suitesJson[1].suite_type).toBe('schema');
  });

  // ─── Token validation failure (proc raises 28000) ─────────────────────────

  it('returns 401 when proc raises invalid_callback_token', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(
      new Error('invalid_callback_token'),
    );

    const { status, body } = await responseJson(makeRequest(VALID_API_TEST_PAYLOAD));
    expect(status).toBe(401);
    expect(body.error).toMatch(/Invalid callback token/i);
  });

  // ─── Generic DB error ────────────────────────────────────────────────────

  it('returns 500 on generic DB error', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(
      new Error('connection refused'),
    );

    const { status, body } = await responseJson(makeRequest(VALID_API_TEST_PAYLOAD));
    expect(status).toBe(500);
    expect(body.error).toMatch(/Failed to record API test results/i);
  });

  // ─── Defaults applied by Zod ─────────────────────────────────────────────

  it('applies Zod defaults for optional numeric fields', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([
      { o_suite_id: 1, o_suite_type: 'reachability', o_status: 'passed' },
    ]);

    const minimal = {
      type: 'api_test_result',
      execution_id: 100,
      suites: [{
        suite_type: 'reachability',
        status: 'passed',
        assertions: [{
          endpoint_url: '/api/health',
          http_method: 'GET',
          assertion_name: 'test',
          status: 'passed',
        }],
      }],
    };

    const { status } = await responseJson(makeRequest(minimal));
    expect(status).toBe(200);

    // Verify the serialised JSON has the defaulted counter values
    const callArgs = vi.mocked(invokeProcWrite).mock.calls[0][1] as Record<string, unknown>;
    const suitesJson = JSON.parse(callArgs.i_suites_json as string);
    expect(suitesJson[0].total_assertions).toBe(0);
    expect(suitesJson[0].passed_assertions).toBe(0);
    expect(suitesJson[0].failed_assertions).toBe(0);
    expect(suitesJson[0].skipped_assertions).toBe(0);
  });
});

// ─── admin_test_result branch (Phase 7) ─────────────────────────────────────

const VALID_ADMIN_TEST_PAYLOAD = {
  type: 'admin_test_result' as const,
  execution_id: 200,
  suites: [
    {
      suite_type: 'admin_login',
      status: 'passed',
      total_assertions: 3,
      passed_assertions: 3,
      failed_assertions: 0,
      skipped_assertions: 0,
      started_at: '2026-05-10T00:00:00Z',
      completed_at: '2026-05-10T00:00:05Z',
      duration_ms: 5000,
      assertions: [
        {
          assertion_name: 'login_form_visible',
          status: 'passed' as const,
          page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/login',
        },
        {
          assertion_name: 'credentials_accepted',
          status: 'passed' as const,
          page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/login',
        },
        {
          assertion_name: 'admin_dashboard_reached',
          status: 'passed' as const,
          page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/admin',
        },
      ],
    },
    {
      suite_type: 'booking_lookup',
      status: 'failed',
      total_assertions: 2,
      passed_assertions: 1,
      failed_assertions: 1,
      skipped_assertions: 0,
      started_at: '2026-05-10T00:00:06Z',
      completed_at: '2026-05-10T00:00:10Z',
      duration_ms: 4000,
      assertions: [
        {
          assertion_name: 'booking_list_rendered',
          status: 'passed' as const,
          page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/admin/bookings',
        },
        {
          assertion_name: 'booking_detail_loaded',
          status: 'failed' as const,
          page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/admin/bookings/1',
          expected_value: 'detail heading visible',
          actual_value: 'no heading found',
          error_message: 'Booking detail view did not load',
        },
      ],
    },
  ],
};

describe('POST /api/runner/callback — admin_test_result (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Zod validation ─────────────────────────────────────────────────────────

  it('returns 400 when execution_id is missing', async () => {
    const payload = { type: 'admin_test_result', suites: VALID_ADMIN_TEST_PAYLOAD.suites };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid admin_test_result payload/i);
    expect(body.details).toBeDefined();
  });

  it('returns 400 when suites is empty array', async () => {
    const payload = { type: 'admin_test_result', execution_id: 200, suites: [] };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid admin_test_result payload/i);
  });

  it('returns 400 when suite_type is invalid', async () => {
    const payload = {
      type: 'admin_test_result',
      execution_id: 200,
      suites: [{
        suite_type: 'invalid_admin_type',
        status: 'passed',
        assertions: [],
      }],
    };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
    expect(body.details).toBeDefined();
  });

  it('returns 400 when assertion status is invalid', async () => {
    const payload = {
      type: 'admin_test_result',
      execution_id: 200,
      suites: [{
        suite_type: 'admin_login',
        status: 'passed',
        assertions: [{
          assertion_name: 'test',
          status: 'banana',
        }],
      }],
    };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
  });

  it('returns 400 when total_assertions is negative', async () => {
    const payload = {
      type: 'admin_test_result',
      execution_id: 200,
      suites: [{
        suite_type: 'admin_login',
        status: 'passed',
        total_assertions: -1,
        assertions: [],
      }],
    };
    const { status, body } = await responseJson(makeRequest(payload));
    expect(status).toBe(400);
  });

  it('accepts all valid admin suite types', async () => {
    const suiteTypes = ['admin_login', 'booking_lookup', 'registration_lookup', 'admin_edit', 'reporting_screens'];
    for (const suiteType of suiteTypes) {
      vi.mocked(invokeProcWrite).mockResolvedValueOnce([
        { o_suite_id: 1, o_suite_type: suiteType, o_status: 'passed' },
      ]);
      const payload = {
        type: 'admin_test_result',
        execution_id: 200,
        suites: [{ suite_type: suiteType, status: 'passed', assertions: [] }],
      };
      const { status } = await responseJson(makeRequest(payload));
      expect(status).toBe(200);
    }
  });

  // ─── Successful write ─────────────────────────────────────────────────────

  it('returns 200 and calls sp_admin_test_results_record on valid payload', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([
      { o_suite_id: 1, o_suite_type: 'admin_login', o_status: 'passed' },
      { o_suite_id: 2, o_suite_type: 'booking_lookup', o_status: 'failed' },
    ]);

    const { status, body } = await responseJson(makeRequest(VALID_ADMIN_TEST_PAYLOAD));
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.suites_processed).toBe(2);

    expect(vi.mocked(invokeProcWrite)).toHaveBeenCalledOnce();
    expect(vi.mocked(invokeProcWrite)).toHaveBeenCalledWith(
      'sp_admin_test_results_record',
      expect.objectContaining({
        i_run_execution_id: 200,
        i_callback_token: 'test-token-abc',
        i_created_by: 'runner',
      }),
    );

    // Verify the suites JSON was serialised
    const callArgs = vi.mocked(invokeProcWrite).mock.calls[0][1] as Record<string, unknown>;
    const suitesJson = JSON.parse(callArgs.i_suites_json as string);
    expect(suitesJson).toHaveLength(2);
    expect(suitesJson[0].suite_type).toBe('admin_login');
    expect(suitesJson[1].suite_type).toBe('booking_lookup');
  });

  // ─── Token validation failure ─────────────────────────────────────────────

  it('returns 401 when proc raises invalid_callback_token', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(
      new Error('invalid_callback_token'),
    );

    const { status, body } = await responseJson(makeRequest(VALID_ADMIN_TEST_PAYLOAD));
    expect(status).toBe(401);
    expect(body.error).toMatch(/Invalid callback token/i);
  });

  // ─── Generic DB error ────────────────────────────────────────────────────

  it('returns 500 on generic DB error', async () => {
    vi.mocked(invokeProcWrite).mockRejectedValueOnce(
      new Error('connection refused'),
    );

    const { status, body } = await responseJson(makeRequest(VALID_ADMIN_TEST_PAYLOAD));
    expect(status).toBe(500);
    expect(body.error).toMatch(/Failed to record admin test results/i);
  });

  // ─── Defaults applied by Zod ─────────────────────────────────────────────

  it('applies Zod defaults for optional numeric fields', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([
      { o_suite_id: 1, o_suite_type: 'admin_login', o_status: 'passed' },
    ]);

    const minimal = {
      type: 'admin_test_result',
      execution_id: 200,
      suites: [{
        suite_type: 'admin_login',
        status: 'passed',
        assertions: [{
          assertion_name: 'test',
          status: 'passed',
        }],
      }],
    };

    const { status } = await responseJson(makeRequest(minimal));
    expect(status).toBe(200);

    // Verify the serialised JSON has the defaulted counter values
    const callArgs = vi.mocked(invokeProcWrite).mock.calls[0][1] as Record<string, unknown>;
    const suitesJson = JSON.parse(callArgs.i_suites_json as string);
    expect(suitesJson[0].total_assertions).toBe(0);
    expect(suitesJson[0].passed_assertions).toBe(0);
    expect(suitesJson[0].failed_assertions).toBe(0);
    expect(suitesJson[0].skipped_assertions).toBe(0);
  });

  // ─── Admin-specific assertion fields ──────────────────────────────────────

  it('serialises page_url and admin-specific assertion fields', async () => {
    vi.mocked(invokeProcWrite).mockResolvedValueOnce([
      { o_suite_id: 1, o_suite_type: 'admin_login', o_status: 'passed' },
    ]);

    const payload = {
      type: 'admin_test_result',
      execution_id: 200,
      suites: [{
        suite_type: 'admin_login',
        status: 'passed',
        assertions: [{
          assertion_name: 'dashboard_reachable',
          status: 'passed',
          page_url: 'https://ykportalnextgenqa.yugalkunj.org/#/admin',
          expected_value: 'admin dashboard',
          actual_value: 'admin dashboard',
        }],
      }],
    };

    const { status } = await responseJson(makeRequest(payload));
    expect(status).toBe(200);

    const callArgs = vi.mocked(invokeProcWrite).mock.calls[0][1] as Record<string, unknown>;
    const suitesJson = JSON.parse(callArgs.i_suites_json as string);
    expect(suitesJson[0].assertions[0].page_url).toBe(
      'https://ykportalnextgenqa.yugalkunj.org/#/admin',
    );
    expect(suitesJson[0].assertions[0].expected_value).toBe('admin dashboard');
  });
});
