/**
 * Audit log action categories
 */
export enum AuditAction {
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILURE = "login_failure",
  LOGOUT = "logout",
  ROLE_ASSIGNMENT_CHANGE = "role_assignment_change",
  VAULT_BOOTSTRAP = "vault_bootstrap",
  VAULT_UNLOCK_SUCCESS = "vault_unlock_success",
  VAULT_UNLOCK_FAILURE = "vault_unlock_failure",
  VAULT_LOCK = "vault_lock",
  SECRET_CREATE = "secret_create",
  SECRET_UPDATE = "secret_update",
  SECRET_ARCHIVE = "secret_archive",
  SECRET_REVEAL = "secret_reveal",
  SECRET_DECRYPT_FOR_RUN = "secret_decrypt_for_run",
  PAYMENT_PROFILE_CREATE = "payment_profile_create",
  PAYMENT_PROFILE_UPDATE = "payment_profile_update",
  EMAIL_INBOX_CREATE = "email_inbox_create",
  EMAIL_INBOX_UPDATE = "email_inbox_update",
  APPROVAL_DECIDE = "approval_decide",
  RUN_EXECUTE = "run_execute",
  RUN_ABORT = "run_abort",
}

/**
 * Audit log record
 */
export interface AuditLog {
  id: string;
  actor_operator_id: string;
  action: AuditAction;
  target_type: string;
  target_id?: string;
  before_summary?: string;
  after_summary?: string;
  status: "success" | "failure";
  error_message?: string;
  correlation_id?: string;
  created_date: Date;
  ip_address?: string;
  user_agent?: string;
}
