import { ApprovalStrength } from "./run.types";

/**
 * Approval decision states
 */
export enum ApprovalDecision {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  TIMED_OUT = "timed_out",
}

/**
 * Approval request record
 */
export interface Approval {
  id: string;
  run_step_id: string;
  category: string;
  target_page?: string;
  target_api?: string;
  acting_role: string;
  expected_side_effect?: string;
  payment_profile_id?: string;
  strength: ApprovalStrength;
  decision: ApprovalDecision;
  reason?: string;
  decider_operator_id?: string;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
  decided_at?: Date;
}

/**
 * Approval policy configuration
 */
export interface ApprovalPolicy {
  id: string;
  category: string;
  default_strength: ApprovalStrength;
  site_environment_id?: string;
  override_strength?: ApprovalStrength;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}
