/**
 * Account lifecycle types — Phase 15
 * Represents test accounts and their lifecycle actions.
 */

// ─── Account Status ─────────────────────────────────────────────────────────

/** Lifecycle status of a test account */
export type AccountStatus =
  | 'pending_registration'
  | 'registered'
  | 'email_verified'
  | 'active'
  | 'suspended'
  | 'deactivated';

/** Cleanup status of a test account */
export type CleanupStatus =
  | 'active'
  | 'pending_approval'
  | 'approved'
  | 'cleaned_up'
  | 'cleanup_failed';

// ─── Login Strategies ───────────────────────────────────────────────────────

/** Supported login strategies (Phase 15.2) */
export type LoginStrategy =
  | 'email_password'
  | 'username_password'
  | 'magic_link'
  | 'email_otp'
  | 'manual_sso_approval';

/** All valid login strategies as a constant array */
export const LOGIN_STRATEGIES: readonly LoginStrategy[] = [
  'email_password',
  'username_password',
  'magic_link',
  'email_otp',
  'manual_sso_approval',
] as const;

// ─── Email Verification Methods ─────────────────────────────────────────────

/** How email verification is completed */
export type VerificationMethod = 'link_click' | 'code_entry' | 'auto_verified' | 'manual';

// ─── Action Types ───────────────────────────────────────────────────────────

/** Types of lifecycle actions on test accounts */
export type AccountActionType =
  | 'register'
  | 'verify_email'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'profile_update'
  | 'cleanup_request'
  | 'cleanup_approved'
  | 'cleanup_executed';

/** Status of a lifecycle action */
export type AccountActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

// ─── DB Record Types ────────────────────────────────────────────────────────

/** Test account record from test_accounts table */
export interface TestAccount {
  id: number;
  site_id: number;
  run_execution_id: number | null;
  persona_id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  account_status: AccountStatus;
  login_strategy: LoginStrategy;
  email_verified: boolean;
  verification_method: VerificationMethod | null;
  cleanup_status: CleanupStatus;
  cleanup_approved_by: string | null;
  cleanup_approved_at: Date | null;
  cleaned_up_at: Date | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  created_date: Date;
  updated_date: Date;
}

/** Test account action record from test_account_actions table */
export interface TestAccountAction {
  id: number;
  test_account_id: number;
  run_execution_id: number | null;
  action_type: AccountActionType;
  action_status: AccountActionStatus;
  step_name: string | null;
  duration_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  created_date: Date;
}
