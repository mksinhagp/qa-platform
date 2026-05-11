/**
 * POST /api/runner/callback
 *
 * Three payload types (differentiated by `type` field):
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
 * Authentication: one-time callback token validated against the stored token
 *   in the run_executions table (i_callback_token param).
 */

import { NextRequest, NextResponse } from 'next/server';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';

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
    const executionId = body.execution_id as number | undefined;
    const suites = body.suites as Array<Record<string, unknown>> | undefined;

    if (!executionId || !Array.isArray(suites)) {
      return NextResponse.json(
        { error: 'execution_id and suites[] are required for api_test_result' },
        { status: 400 },
      );
    }

    // Validate callback token
    try {
      const tokenRows = await invokeProc('sp_run_executions_validate_token', {
        i_id: executionId,
        i_callback_token: token,
      });
      type TokenRow = { o_valid: boolean };
      const valid = (tokenRows as TokenRow[])[0]?.o_valid;
      if (!valid) {
        return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Token validation failed' }, { status: 401 });
    }

    try {
      for (const suite of suites) {
        const suiteType = suite.suite_type as string;
        const suiteStatus = suite.status as string;
        const assertions = suite.assertions as Array<Record<string, unknown>> | undefined;

        // Insert suite record
        const suiteResult = await invokeProcWrite('sp_api_test_suites_insert', {
          i_run_execution_id: executionId,
          i_suite_type: suiteType,
          i_metadata: suite.metadata ? JSON.stringify(suite.metadata) : null,
          i_created_by: 'runner',
        });

        const suiteId = suiteResult[0]?.o_id as number | undefined;
        if (!suiteId) continue;

        // Batch insert assertions if present
        if (assertions && assertions.length > 0) {
          await invokeProcWrite('sp_api_test_assertions_insert_batch', {
            i_api_test_suite_id: suiteId,
            i_assertions: JSON.stringify(assertions),
            i_created_by: 'runner',
          });
        }

        // Update suite with final status and counters
        await invokeProcWrite('sp_api_test_suites_update', {
          i_id: suiteId,
          i_status: suiteStatus,
          i_total_assertions: (suite.total_assertions as number) ?? 0,
          i_passed_assertions: (suite.passed_assertions as number) ?? 0,
          i_failed_assertions: (suite.failed_assertions as number) ?? 0,
          i_skipped_assertions: (suite.skipped_assertions as number) ?? 0,
          i_duration_ms: (suite.duration_ms as number) ?? null,
          i_error_message: (suite.error_message as string) ?? null,
          i_updated_by: 'runner',
        });
      }

      return NextResponse.json({ success: true, suites_processed: suites.length });
    } catch (err) {
      console.error('API test result callback error:', err);
      return NextResponse.json({ error: 'Failed to record API test results' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown callback type: ${type}` }, { status: 400 });
}
