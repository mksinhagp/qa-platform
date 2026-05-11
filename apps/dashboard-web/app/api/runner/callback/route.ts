/**
 * POST /api/runner/callback
 *
 * Four payload types (differentiated by `type` field):
 *
 *  1. "execution_result" — the runner finished an execution and is reporting results.
 *     Writes step results, friction signals, and final status back to the DB.
 *
 *  2. "approval_request" — the runner hit an approval-gated step and needs an operator
 *     decision before it can proceed.
 *     Creates an approvals row and returns { approval_id } to the runner.
 *
 *  3. "api_test_result" — the runner completed API validation post-step and is
 *     reporting suite/assertion results for storage in the DB (Phase 6).
 *
 *  4. "llm_analysis_result" — the runner completed LLM failure summarization and is
 *     reporting the structured summary for storage in the DB (Phase 8).
 *
 * Authentication: one-time callback token validated against the stored token
 *   in the run_executions table (i_callback_token param).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';

// ─── Zod schema for the Phase 8 llm_analysis_result payload ──────────────────

const LlmAnalysisResultPayloadSchema = z.object({
  type: z.literal('llm_analysis_result'),
  execution_id: z.number().int().positive(),
  task_type: z.enum(['selector_healing', 'failure_summarization']),
  model_used: z.string().min(1),
  status: z.enum(['pending', 'completed', 'error', 'skipped']),
  result_json: z.record(z.unknown()).nullish(),
  error_message: z.string().nullish(),
  prompt_tokens: z.number().int().nonnegative().nullish(),
  completion_tokens: z.number().int().nonnegative().nullish(),
  duration_ms: z.number().int().nonnegative().nullish(),
});

// ─── Zod schema for the Phase 6 api_test_result payload ───────────────────────
// Validates the full shape up-front so downstream procs receive well-typed
// data and don't fail mid-write with a Postgres type error.
const ApiAssertionSchema = z.object({
  endpoint_url: z.string(),
  http_method: z.string(),
  assertion_name: z.string(),
  status: z.enum(['passed', 'failed', 'error', 'skipped']),
  expected_value: z.string().nullish(),
  actual_value: z.string().nullish(),
  response_status: z.number().int().nullish(),
  response_time_ms: z.number().int().nullish(),
  error_message: z.string().nullish(),
  detail: z.unknown().nullish(),
});

const ApiSuiteSchema = z.object({
  suite_type: z.enum(['reachability', 'schema', 'business_rules', 'cross_validation']),
  status: z.enum(['passed', 'failed', 'error', 'skipped']),
  total_assertions: z.number().int().nonnegative().default(0),
  passed_assertions: z.number().int().nonnegative().default(0),
  failed_assertions: z.number().int().nonnegative().default(0),
  skipped_assertions: z.number().int().nonnegative().default(0),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().nullish(),
  error_message: z.string().nullish(),
  metadata: z.unknown().nullish(),
  assertions: z.array(ApiAssertionSchema).default([]),
});

const ApiTestResultPayloadSchema = z.object({
  type: z.literal('api_test_result'),
  execution_id: z.number().int().positive(),
  suites: z.array(ApiSuiteSchema).min(1),
});

// ─── Zod schema for the Phase 7 admin_test_result payload ──────────────────
const AdminAssertionSchema = z.object({
  assertion_name: z.string(),
  status: z.enum(['passed', 'failed', 'error', 'skipped']),
  page_url: z.string().nullish(),
  expected_value: z.string().nullish(),
  actual_value: z.string().nullish(),
  error_message: z.string().nullish(),
  detail: z.unknown().nullish(),
});

const AdminSuiteSchema = z.object({
  suite_type: z.enum(['admin_login', 'booking_lookup', 'registration_lookup', 'admin_edit', 'reporting_screens']),
  status: z.enum(['passed', 'failed', 'error', 'skipped']),
  total_assertions: z.number().int().nonnegative().default(0),
  passed_assertions: z.number().int().nonnegative().default(0),
  failed_assertions: z.number().int().nonnegative().default(0),
  skipped_assertions: z.number().int().nonnegative().default(0),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().nonnegative().nullish(),
  error_message: z.string().nullish(),
  metadata: z.unknown().nullish(),
  assertions: z.array(AdminAssertionSchema).default([]),
});

const AdminTestResultPayloadSchema = z.object({
  type: z.literal('admin_test_result'),
  execution_id: z.number().int().positive(),
  suites: z.array(AdminSuiteSchema).min(1),
});

// Hardcoded fallback strengths — mirrors packages/approvals/src/types.ts DEFAULT_STRENGTHS
const DEFAULT_STRENGTHS: Record<string, string> = {
  registration_submit: 'one_click',
  checkout_submit: 'strong_confirm',
  data_export: 'strong_confirm',
  account_delete: 'strong_confirm',
};

/**
 * Look up the required approval strength for a given category from the DB policy
 * table, falling back to DEFAULT_STRENGTHS then 'one_click' if unavailable.
 */
async function getApprovalStrength(category: string): Promise<string> {
  try {
    const rows = await invokeProc('sp_approval_policies_list', { i_is_system: null });
    type PolicyRow = { o_action_category: string; o_default_strength: string };
    const match = (rows as PolicyRow[]).find(r => r.o_action_category === category);
    if (match) return match.o_default_strength;
  } catch {
    // DB policy lookup failed — fall back to hardcoded defaults
  }
  return DEFAULT_STRENGTHS[category] ?? 'one_click';
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-runner-token');
  const correlationId = request.headers.get('x-correlation-id') ?? 'unknown';

  if (!token) {
    return NextResponse.json({ error: 'Missing runner token' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const type = body.type as string | undefined;

  // ─── Handle execution result ──────────────────────────────────────────────
  if (!type || type === 'execution_result') {
    const executionId = body.execution_id as number | undefined;
    const status = body.status as string | undefined;
    const frictionScore = body.friction_score as number | undefined;
    const steps = body.steps as unknown[] | undefined;
    const frictionSignals = body.friction_signals as unknown[] | undefined;
    const errorMessage = body.error_message as string | null | undefined;
    const startedAt = body.started_at as string | undefined;
    const completedAt = body.completed_at as string | undefined;

    if (!executionId || !status) {
      return NextResponse.json({ error: 'execution_id and status are required' }, { status: 400 });
    }

    try {
      await invokeProcWrite('sp_run_executions_update_result', {
        i_id: executionId,
        i_callback_token: token,
        i_status: status,
        i_friction_score: frictionScore ?? null,
        i_error_message: errorMessage ?? null,
        i_started_at: startedAt ?? null,
        i_completed_at: completedAt ?? null,
        i_steps: steps ? JSON.stringify(steps) : null,
        i_friction_signals: frictionSignals ? JSON.stringify(frictionSignals) : null,
        i_updated_by: 'runner',
        i_correlation_id: correlationId,
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('Execution result callback error:', err);
      return NextResponse.json({ error: 'Failed to record execution result' }, { status: 500 });
    }
  }

  // ─── Handle approval request ──────────────────────────────────────────────
  if (type === 'approval_request') {
    const executionId = body.execution_id as number | undefined;
    const runId = body.run_id as number | undefined;
    const stepName = body.step_name as string | undefined;
    const stepOrder = body.step_order as number | undefined;
    const category = (body.category as string | undefined) ?? 'registration_submit';
    const payloadSummary = body.payload_summary as string | undefined;
    const MAX_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour hard cap
    const MIN_TIMEOUT_MS = 10_000;        // 10 seconds minimum
    const rawTimeoutMs = (body.timeout_ms as number | undefined) ?? 15 * 60 * 1000;
    const timeoutMs = Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, rawTimeoutMs));

    if (!executionId || !stepName || !stepOrder) {
      return NextResponse.json(
        { error: 'execution_id, step_name, and step_order are required' },
        { status: 400 },
      );
    }

    try {
      // First create the run_step record for this approval step
      const stepResult = await invokeProcWrite('sp_run_steps_insert', {
        i_run_execution_id: executionId,
        i_callback_token: token,
        i_step_name: stepName,
        i_step_order: stepOrder,
        i_step_type: 'approval',
        i_run_id: runId ?? null,
        i_updated_by: 'runner',
      });

      const runStepId = stepResult[0]?.o_id as number | undefined;
      if (!runStepId) {
        return NextResponse.json({ error: 'Failed to create run step' }, { status: 500 });
      }

      // Then create the approval record — look up the correct required strength
      // from the policy table so checkout_submit gets strong_confirm, not one_click.
      const requiredStrength = await getApprovalStrength(category);
      const timeoutAt = new Date(Date.now() + timeoutMs).toISOString();
      const approvalResult = await invokeProcWrite('sp_approvals_insert', {
        i_run_step_id: runStepId,
        i_category: category,
        i_target_type: 'flow_step',
        i_target_id: `execution_${executionId}_step_${stepOrder}`,
        i_payload_summary: payloadSummary ?? null,
        i_required_strength: requiredStrength,
        i_timeout_at: timeoutAt,
        i_created_by: 'runner',
      });

      const approvalId = approvalResult[0]?.o_id as number | undefined;
      if (!approvalId) {
        return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 });
      }

      return NextResponse.json({ success: true, approval_id: approvalId });
    } catch (err) {
      console.error('Approval request callback error:', err);
      return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
    }
  }

  // ─── Handle API test results (Phase 6) ────────────────────────────────────
  if (type === 'api_test_result') {
    // Validate the full payload up-front. Malformed payloads return 400 with
    // a clear error instead of failing mid-write with a Postgres type error.
    const parsed = ApiTestResultPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid api_test_result payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { execution_id: executionId, suites } = parsed.data;

    // Single transactional, idempotent write: sp_api_test_results_record
    //  - Validates the callback token inside the proc (raises 28000 on
    //    mismatch, which we map to 401).
    //  - Upserts each suite row, deletes existing assertions for the suite,
    //    then batch-inserts the provided assertions. Safe to retry: a replay
    //    converges to the same final state instead of duplicating rows.
    try {
      const rows = await invokeProcWrite('sp_api_test_results_record', {
        i_run_execution_id: executionId,
        i_callback_token: token,
        i_suites_json: JSON.stringify(suites),
        i_created_by: 'runner',
      });
      return NextResponse.json({
        success: true,
        suites_processed: Array.isArray(rows) ? rows.length : suites.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('invalid_callback_token')) {
        return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
      }
      console.error('API test result callback error:', { execution_id: executionId, correlation_id: correlationId, error: err });
      return NextResponse.json({ error: 'Failed to record API test results' }, { status: 500 });
    }
  }

  // ─── Handle admin test results (Phase 7) ──────────────────────────────────
  if (type === 'admin_test_result') {
    const parsed = AdminTestResultPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid admin_test_result payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { execution_id: executionId, suites } = parsed.data;

    try {
      const rows = await invokeProcWrite('sp_admin_test_results_record', {
        i_run_execution_id: executionId,
        i_callback_token: token,
        i_suites_json: JSON.stringify(suites),
        i_created_by: 'runner',
      });
      return NextResponse.json({
        success: true,
        suites_processed: Array.isArray(rows) ? rows.length : suites.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('invalid_callback_token')) {
        return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
      }
      console.error('Admin test result callback error:', { execution_id: executionId, correlation_id: correlationId, error: err });
      return NextResponse.json({ error: 'Failed to record admin test results' }, { status: 500 });
    }
  }

  // ─── Handle LLM analysis result (Phase 8) ────────────────────────────────
  if (type === 'llm_analysis_result') {
    const parsed = LlmAnalysisResultPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid llm_analysis_result payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const {
      execution_id: executionId,
      task_type,
      model_used,
      status: analysisStatus,
      result_json,
      error_message,
      prompt_tokens,
      completion_tokens,
      duration_ms,
    } = parsed.data;

    try {
      // Validate token first via a read-only proc call
      const tokenRows = await invokeProc('sp_run_executions_validate_token', {
        i_id: executionId,
        i_callback_token: token,
      });
      type TokenRow = { o_valid: boolean };
      const valid = (tokenRows as TokenRow[])[0]?.o_valid === true;
      if (!valid) {
        return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
      }

      await invokeProcWrite('sp_llm_analysis_upsert', {
        i_run_execution_id: executionId,
        i_task_type: task_type,
        i_model_used: model_used,
        i_status: analysisStatus,
        i_result_json: result_json ? JSON.stringify(result_json) : null,
        i_error_message: error_message ?? null,
        i_prompt_tokens: prompt_tokens ?? null,
        i_completion_tokens: completion_tokens ?? null,
        i_duration_ms: duration_ms ?? null,
        i_updated_by: 'runner',
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error('LLM analysis result callback error:', { execution_id: executionId, correlation_id: correlationId, error: err });
      return NextResponse.json({ error: 'Failed to record LLM analysis result' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown callback type: ${type}` }, { status: 400 });
}
