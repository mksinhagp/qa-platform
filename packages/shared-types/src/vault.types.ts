/**
 * Vault state record
 */
export interface VaultState {
  id: string;
  is_bootstrapped: boolean;
  kdf_salt: string;
  kdf_memory: number;
  kdf_iterations: number;
  kdf_parallelism: number;
  kdf_salt_length: number;
  wrapped_rvk: string;
  aad: string;
  bootstrap_operator_id?: string;
  bootstrap_timestamp?: Date;
  last_unlock_operator_id?: string;
  last_unlock_timestamp?: Date;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  updated_by: string;
}

/**
 * Vault unlock session
 */
export interface VaultUnlockSession {
  id: string;
  operator_session_id: string;
  issued_at: Date;
  expires_at: Date;
  idle_expires_at: Date;
  is_locked: boolean;
  locked_at?: Date;
}
