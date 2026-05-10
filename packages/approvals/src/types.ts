/**
 * Approval strength levels — mirrors the ApprovalStrength enum from shared-types
 * but kept local so the package has no dependency on shared-types.
 */
export type ApprovalStrength = 'none' | 'one_click' | 'strong';

/**
 * Approval status values
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timed_out';

/**
 * The action categories from master plan §8.1.
 * Used to determine default approval strength via the policy table.
 */
export type ApprovalCategory =
  | 'health_probe'
  | 'browse_search'
  | 'form_fill'
  | 'registration_submit'
  | 'login_attempt'
  | 'cart_update'
  | 'checkout_submit'
  | 'admin_write'
  | 'admin_delete'
  | 'vault_admin';

/**
 * A pending or resolved approval record returned from the DB.
 */
export interface ApprovalRecord {
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
  required_strength: ApprovalStrength;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  timeout_at: string;
  created_date: string;
  updated_date: string;
}

/**
 * Parameters to create a new approval request.
 */
export interface ApprovalRequest {
  run_step_id: number;
  category: ApprovalCategory | string;
  target_type?: string;
  target_id?: string;
  payload_summary?: string;
  required_strength?: ApprovalStrength;
  /** ISO 8601 timeout. Defaults to NOW + 15 minutes. */
  timeout_at?: string;
  created_by?: string;
}

/**
 * Result returned by requestApproval().
 */
export interface ApprovalCreated {
  approval_id: number;
  timeout_at: string;
}

/**
 * Result of polling for a decision.
 */
export type PollResult =
  | { decided: true; status: 'approved' | 'rejected' | 'timed_out'; reason: string | null }
  | { decided: false };

/**
 * Default strength per category (§8.1).
 */
export const DEFAULT_STRENGTHS: Record<string, ApprovalStrength> = {
  health_probe: 'none',
  browse_search: 'none',
  form_fill: 'none',
  registration_submit: 'one_click',
  login_attempt: 'one_click',
  cart_update: 'one_click',
  checkout_submit: 'strong',
  admin_write: 'strong',
  admin_delete: 'strong',
  vault_admin: 'strong',
};
