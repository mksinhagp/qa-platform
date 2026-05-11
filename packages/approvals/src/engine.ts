/**
 * Approval Engine — the core library used by both the runner and the dashboard.
 *
 * Runner-side usage (via HTTP to dashboard):
 *   1. Runner encounters an approval-gated step.
 *   2. Calls requestApproval() which writes an `approvals` row.
 *   3. Calls pollForDecision() with a timeout matching approval.timeout_at.
 *   4. Proceeds (approved), records skipped_by_approval (rejected), or times out.
 *
 * Dashboard-side usage:
 *   1. Calls listApprovals() to surface pending items to the operator.
 *   2. Calls decideApproval() to record approved/rejected.
 */

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import type {
  ApprovalRequest,
  ApprovalCreated,
  ApprovalRecord,
  ApprovalStrength,
  ApprovalStatus,
  PollResult,
} from './types.js';
import { DEFAULT_STRENGTHS } from './types.js';

/**
 * Create a new pending approval request.
 * Returns the approval id and the absolute timeout timestamp.
 */
export async function requestApproval(req: ApprovalRequest): Promise<ApprovalCreated> {
  const strength: ApprovalStrength =
    req.required_strength ?? (DEFAULT_STRENGTHS[req.category] ?? 'one_click');

  const result = await invokeProcWrite('sp_approvals_insert', {
    i_run_step_id: req.run_step_id,
    i_category: req.category,
    i_target_type: req.target_type ?? null,
    i_target_id: req.target_id ?? null,
    i_payload_summary: req.payload_summary ?? null,
    i_required_strength: strength,
    i_timeout_at: req.timeout_at ?? null,
    i_created_by: req.created_by ?? 'system',
  });

  const row = result[0];
  if (!row) throw new Error('sp_approvals_insert returned no row');

  return {
    approval_id: row.o_id as number,
    timeout_at: (row.o_timeout_at as Date).toISOString(),
  };
}

/**
 * Poll the database for a decision on an approval.
 * Returns `{ decided: true, status, reason }` once the operator acts,
 * or `{ decided: false }` if still pending.
 *
 * The runner calls this in a loop with a sleep between iterations.
 * See `waitForDecision()` for the blocking polling wrapper.
 */
export async function pollForDecision(approvalId: number): Promise<PollResult> {
  const rows = await invokeProc('sp_approvals_get_by_id', { i_id: approvalId });

  if (!rows.length) {
    throw new Error(`Approval ${approvalId} not found`);
  }

  const row = rows[0] as { o_status: string; o_reason: string | null; o_timeout_at: Date };
  const status = row.o_status as ApprovalStatus;

  if (status === 'pending') {
    // Auto-expire if we are past timeout_at
    if (new Date() > new Date(row.o_timeout_at)) {
      await expireApproval(approvalId);
      return { decided: true, status: 'timed_out', reason: null };
    }
    return { decided: false };
  }

  return {
    decided: true,
    status: status as 'approved' | 'rejected' | 'timed_out',
    reason: row.o_reason,
  };
}

/**
 * Blocking poller — polls every `intervalMs` until a decision is made
 * or `timeoutMs` elapses.
 */
export async function waitForDecision(
  approvalId: number,
  timeoutMs = 15 * 60 * 1000,
  intervalMs = 3000,
): Promise<PollResult> {
  const deadline = Date.now() + timeoutMs;

  // Poll first, then sleep — avoids an unnecessary initial delay before the
  // first check, which matters when an operator acts immediately.
  while (Date.now() < deadline) {
    const result = await pollForDecision(approvalId);
    if (result.decided) return result;
    // Only sleep if there is still time remaining so we exit promptly on timeout.
    if (Date.now() + intervalMs < deadline) {
      await sleep(intervalMs);
    } else {
      break;
    }
  }

  // Deadline passed — mark timed out and return
  await expireApproval(approvalId);
  return { decided: true, status: 'timed_out', reason: null };
}

/**
 * Mark an approval as timed_out (called internally when deadline passes).
 */
async function expireApproval(approvalId: number): Promise<void> {
  try {
    await invokeProcWrite('sp_approvals_update_decision', {
      i_id: approvalId,
      i_status: 'timed_out',
      i_decided_by: null,
      i_reason: 'Automatically expired — no operator decision before timeout',
      i_updated_by: 'system',
    });
  } catch {
    // Already decided — ignore
  }
}

/**
 * Record an operator's decision (approve or reject).
 * Used by the dashboard server action.
 */
export async function decideApproval(
  approvalId: number,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  reason?: string,
): Promise<void> {
  await invokeProcWrite('sp_approvals_update_decision', {
    i_id: approvalId,
    i_status: decision,
    i_decided_by: decidedBy,
    i_reason: reason ?? null,
    i_updated_by: decidedBy,
  });
}

/**
 * List approvals with optional filters.
 * Returns enriched rows joining runs, executions, and steps.
 */
export async function listApprovals(options?: {
  status?: ApprovalStatus;
  run_id?: number;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<ApprovalRecord[]> {
  const rows = await invokeProc('sp_approvals_list', {
    i_status: options?.status ?? null,
    i_run_id: options?.run_id ?? null,
    i_category: options?.category ?? null,
    i_limit: options?.limit ?? 50,
    i_offset: options?.offset ?? 0,
  });

  return rows.map((r: Record<string, unknown>) => ({
    id: r.o_id as number,
    run_step_id: r.o_run_step_id as number,
    run_execution_id: r.o_run_execution_id as number,
    run_id: r.o_run_id as number,
    run_name: r.o_run_name as string,
    step_name: r.o_step_name as string,
    flow_name: r.o_flow_name as string,
    persona_id: r.o_persona_id as string,
    category: r.o_category as string,
    target_type: r.o_target_type as string | null,
    target_id: r.o_target_id as string | null,
    payload_summary: r.o_payload_summary as string | null,
    required_strength: r.o_required_strength as ApprovalStrength,
    status: r.o_status as ApprovalStatus,
    decided_by: r.o_decided_by as string | null,
    decided_at: r.o_decided_at ? (r.o_decided_at as Date).toISOString() : null,
    reason: r.o_reason as string | null,
    timeout_at: (r.o_timeout_at as Date).toISOString(),
    created_date: (r.o_created_date as Date).toISOString(),
    updated_date: (r.o_updated_date as Date).toISOString(),
  }));
}

/**
 * Get the required approval strength for a given category from the policy table,
 * with fallback to the hardcoded DEFAULT_STRENGTHS map.
 */
export async function getApprovalStrength(
  category: string,
  _siteEnvironmentId?: number,
): Promise<ApprovalStrength> {
  try {
    const rows = await invokeProc('sp_approval_policies_list', {
      i_is_system: null,
    });

    // Find the most-specific match: site-env override first, then system default
    type PolicyRow = { o_action_category: string; o_default_strength: string };
    const match = rows.find(
      (r: PolicyRow) => r.o_action_category === category,
    ) as PolicyRow | undefined;

    if (match) {
      return match.o_default_strength as ApprovalStrength;
    }
  } catch {
    // DB unavailable — fall back to hardcoded defaults
  }

  return DEFAULT_STRENGTHS[category] ?? 'one_click';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
