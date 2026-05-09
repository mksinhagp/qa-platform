/**
 * Secret category types
 */
export enum SecretCategory {
  WEBSITE_USER_CREDENTIALS = "website_user_credentials",
  WEBSITE_ADMIN_CREDENTIALS = "website_admin_credentials",
  SANDBOX_CARD_PROFILE = "sandbox_card_profile",
  SANDBOX_ACH_PROFILE = "sandbox_ach_profile",
  EMAIL_INBOX_CREDENTIALS = "email_inbox_credentials",
  API_KEY = "api_key",
}

/**
 * Secret usage modes
 */
export enum SecretMode {
  SAVED_ENCRYPTED = "saved_encrypted",
  SESSION_ONLY = "session_only",
}

/**
 * Secret record
 */
export interface SecretRecord {
  id: string;
  category: SecretCategory;
  name: string;
  description?: string;
  owner_operator_id: string;
  mode: SecretMode;
  encrypted_payload: string;
  nonce: string;
  aad: string;
  wrapped_dek: string;
  kdf_version: number;
  is_active: boolean;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
  last_accessed_at?: Date;
  rotation_count: number;
}

/**
 * Secret access log
 */
export interface SecretAccessLog {
  id: string;
  secret_record_id: string;
  access_type: "reveal" | "decrypt_for_run" | "update" | "archive";
  accessed_by_operator_id: string;
  run_execution_id?: string;
  created_date: Date;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Site credential mapping
 */
export interface SiteCredential {
  id: string;
  site_id: string;
  site_environment_id: string;
  role: string;
  secret_record_id?: string;
  session_only_value?: string;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Payment profile
 */
export interface PaymentProfile {
  id: string;
  name: string;
  type: "card" | "ach";
  last_four?: string;
  secret_record_id: string;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Email inbox configuration
 */
export interface EmailInbox {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  secret_record_id: string;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}
