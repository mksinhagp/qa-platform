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

// ─── Zod schema for the Phase 17 payment_transaction_result payload ─────────

const PaymentTransactionResultPayloadSchema = z.object({
  type: z.literal('payment_transaction_result'),
  execution_id: z.number().int().positive(),
  site_id: z.number().int().positive(),
  site_environment_id: z.number().int().positive(),
  payment_provider_id: z.number().int().positive().nullish(),
  payment_scenario_id: z.number().int().positive().nullish(),
  transaction_type: z.enum(['authorize', 'capture', 'void', 'refund']),
  amount: z.number().nonnegative(),
  currency: z.string().max(3).default('USD'),
  provider_transaction_id: z.string().nullish(),
  provider_response_code: z.string().nullish(),
  provider_response_reason: z.string().nullish(),
  provider_response_text: z.string().nullish(),
  status: z.enum(['pending', 'approved', 'declined', 'error', 'voided', 'refunded']),
  ui_confirmation: z.string().nullish(),
  email_receipt_verified: z.boolean().default(false),
  email_receipt_details: z.string().nullish(),
  admin_reconciled: z.boolean().default(false),
  admin_reconciliation_details: z.string().nullish(),
  error_message: z.string().nullish(),
  redacted_card_number: z.string().nullish(),
  redacted_cvv: z.string().nullish(),
  test_data_generated: z.boolean().default(false),
  test_data_cleanup_status: z.string().default('pending'),
  verification_overall_match: z.boolean().default(false),
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
      // sp_run_executions_validate_token returns o_is_valid (not o_valid)
      const tokenRows = await invokeProc('sp_run_executions_validate_token', {
        i_id: executionId,
        i_callback_token: token,
      });
      type TokenRow = { o_is_valid: boolean };
      const valid = (tokenRows as TokenRow[])[0]?.o_is_valid === true;
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

  // ─── Handle payment transaction result (Phase 17) ─────────────────────────
  if (type === 'payment_transaction_result') {
    const parsed = PaymentTransactionResultPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payment_transaction_result payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const p = parsed.data;

    try {
      // Validate token first
      const tokenRows = await invokeProc('sp_run_executions_validate_token', {
        i_id: p.execution_id,
        i_callback_token: token,
      });
      type TokenRow = { o_is_valid: boolean };
      const valid = (tokenRows as TokenRow[])[0]?.o_is_valid === true;
      if (!valid) {
        return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
      }

      // Record the payment transaction via the insert stored procedure.
      // This is idempotent-safe: duplicate callbacks for the same execution
      // will create additional transaction rows (each with a unique ID).
      // Cleanup/dedup can be handled by the test data management layer.
      const txnResult = await invokeProcWrite('sp_payment_transactions_insert', {
        i_run_execution_id: p.execution_id,
        i_site_id: p.site_id,
        i_site_environment_id: p.site_environment_id,
        i_persona_id: null,
        i_payment_provider_id: p.payment_provider_id ?? null,
        i_payment_profile_id: null,
        i_payment_scenario_id: p.payment_scenario_id ?? null,
        i_transaction_type: p.transaction_type,
        i_amount: p.amount,
        i_currency: p.currency,
        i_provider_transaction_id: p.provider_transaction_id ?? null,
        i_provider_response_code: p.provider_response_code ?? null,
        i_provider_response_reason: p.provider_response_reason ?? null,
        i_provider_response_text: p.provider_response_text ?? null,
        i_status: p.status,
        i_ui_confirmation: p.ui_confirmation ?? null,
        i_email_receipt_verified: p.email_receipt_verified,
        i_email_receipt_details: p.email_receipt_details ?? null,
        i_admin_reconciled: p.admin_reconciled,
        i_admin_reconciliation_details: p.admin_reconciliation_details ?? null,
        i_error_message: p.error_message ?? null,
        i_redacted_card_number: p.redacted_card_number ?? null,
        i_redacted_cvv: p.redacted_cvv ?? null,
        i_test_data_generated: p.test_data_generated,
        i_test_data_cleanup_status: p.test_data_cleanup_status,
        i_approval_id: null,
        i_created_by: 'runner',
      });

      const txnId = (txnResult as Array<{ o_id: number }>)[0]?.o_id;
      return NextResponse.json({ success: true, transaction_id: txnId ?? null });
    } catch (err) {
      console.error('Payment transaction result callback error:', {
        execution_id: p.execution_id,
        correlation_id: correlationId,
        error: err,
      });
      return NextResponse.json({ error: 'Failed to record payment transaction' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown callback type: ${type}` }, { status: 400 });
}
