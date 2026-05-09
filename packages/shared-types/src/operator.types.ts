/**
 * System roles
 */
export enum SystemRole {
  SUPER_ADMIN = "super_admin",
  QA_ADMIN = "qa_admin",
  QA_OPERATOR = "qa_operator",
  REVIEWER = "reviewer",
}

/**
 * Capability families
 */
export enum Capability {
  // Operator management
  OPERATOR_MANAGE = "operator.manage",
  ROLE_MANAGE = "role.manage",
  CAPABILITY_MANAGE = "capability.manage",

  // Site and credentials
  SITE_MANAGE = "site.manage",
  SITE_CREDENTIALS_MANAGE = "site_credentials.manage",

  // Vault and secrets
  VAULT_ADMINISTER = "vault.administer",
  VAULT_UNLOCK = "vault.unlock",
  SECRET_MANAGE = "secret.manage",
  SECRET_REVEAL = "secret.reveal",

  // Runs and approvals
  RUN_EXECUTE = "run.execute",
  RUN_READ = "run.read",
  APPROVAL_DECIDE = "approval.decide",
  APPROVAL_READ = "approval.read",

  // Artifacts and audit
  ARTIFACT_READ = "artifact.read",
  AUDIT_READ = "audit.read",
}

/**
 * Operator record
 */
export interface Operator {
  id: string;
  login_name: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
  last_login_at?: Date;
}

/**
 * Role record
 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system_role: boolean;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Role capability assignment
 */
export interface RoleCapability {
  role_id: string;
  capability: Capability;
  created_date: Date;
  created_by: string;
}

/**
 * Operator role assignment
 */
export interface OperatorRoleAssignment {
  operator_id: string;
  role_id: string;
  created_date: Date;
  created_by: string;
}

/**
 * Operator session
 */
export interface OperatorSession {
  id: string;
  operator_id: string;
  issued_at: Date;
  expires_at: Date;
  idle_expires_at?: Date;
  ip_address?: string;
  user_agent?: string;
  is_revoked: boolean;
  revoked_at?: Date;
}
