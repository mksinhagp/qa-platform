'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApprovalItem {
  id: number;
  run_step_id: number;
  run_execution_id: number;
  run_id: number;
  run_name: string;
  step_name: string;
  flow_name: string;
  persona_id: string;
  category: string;
  target_type: string | null;
  target_id: string | null;
  payload_summary: string | null;
  required_strength: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  timeout_at: string;
  created_date: string;
  updated_date: string;
}

// ─── List Approvals ──────────────────────────────────────────────────────────

export interface ListApprovalsResult {
  success: boolean;
  approvals?: ApprovalItem[];
  error?: string;
}

export async function listApprovals(options?: {
  status?: string;
  run_id?: number;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<ListApprovalsResult> {
  try {
    await requireCapability('run.execute');

    const rows = await invokeProc('sp_approvals_list', {
      i_status: options?.status ?? null,
      i_run_id: options?.run_id ?? null,
      i_category: options?.category ?? null,
      i_limit: options?.limit ?? 50,
      i_offset: options?.offset ?? 0,
    });

    const approvals: ApprovalItem[] = rows.map((r: Record<string, unknown>) => ({
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
      required_strength: r.o_required_strength as string,
      status: r.o_status as string,
      decided_by: r.o_decided_by as string | null,
      decided_at: r.o_decided_at ? (r.o_decided_at as Date).toISOString() : null,
      reason: r.o_reason as string | null,
      timeout_at: (r.o_timeout_at as Date).toISOString(),
      created_date: (r.o_created_date as Date).toISOString(),
      updated_date: (r.o_updated_date as Date).toISOString(),
    }));

    return { success: true, approvals };
  } catch (error) {
    console.error('List approvals error:', error);
    return { success: false, error: 'Failed to list approvals' };
  }
}

// ─── List Pending Approvals ───────────────────────────────────────────────────

export async function listPendingApprovals(run_id?: number): Promise<ListApprovalsResult> {
  return listApprovals({ status: 'pending', run_id });
}

// ─── Decide Approval ─────────────────────────────────────────────────────────

export interface DecideApprovalResult {
  success: boolean;
  error?: string;
}

export async function decideApproval(
  approvalId: number,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<DecideApprovalResult> {
  try {
    const authContext = await requireCapability('run.execute');

    await invokeProcWrite('sp_approvals_update_decision', {
      i_id: approvalId,
      i_status: decision,
      i_decided_by: authContext.operatorId.toString(),
      i_reason: reason ?? null,
      i_updated_by: authContext.operatorId.toString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Decide approval error:', error);
    return { success: false, error: 'Failed to record approval decision' };
  }
}

// ─── Get Single Approval ──────────────────────────────────────────────────────

export interface GetApprovalResult {
  success: boolean;
  approval?: ApprovalItem;
  error?: string;
}

export async function getApproval(approvalId: number): Promise<GetApprovalResult> {
  try {
    await requireCapability('run.execute');

    const rows = await invokeProc('sp_approvals_get_by_id', { i_id: approvalId });

    if (!rows.length) {
      return { success: false, error: 'Approval not found' };
    }

    const r = rows[0] as Record<string, unknown>;

    const approval: ApprovalItem = {
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
      required_strength: r.o_required_strength as string,
      status: r.o_status as string,
      decided_by: r.o_decided_by as string | null,
      decided_at: r.o_decided_at ? (r.o_decided_at as Date).toISOString() : null,
      reason: r.o_reason as string | null,
      timeout_at: (r.o_timeout_at as Date).toISOString(),
      created_date: (r.o_created_date as Date).toISOString(),
      updated_date: (r.o_updated_date as Date).toISOString(),
    };

    return { success: true, approval };
  } catch (error) {
    console.error('Get approval error:', error);
    return { success: false, error: 'Failed to get approval' };
  }
}
