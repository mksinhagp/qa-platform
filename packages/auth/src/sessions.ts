// Session management backed by stored procedures
// Handles creation, validation, and revocation of operator sessions

import { randomBytes } from 'crypto';
import { invokeProc, invokeProcScalar } from '@qa-platform/db';
import { getEnv } from '@qa-platform/config';

export interface Session {
  id: number;
  sessionToken: string;
  operatorId: number;
  ipAddress?: string;
  userAgent?: string;
  createdDate: Date;
  lastActivityDate: Date;
  expiresDate: Date;
}

export interface ValidationResult {
  isValid: boolean;
  operatorId?: number;
  sessionId?: number;
  lastActivityDate?: Date;
  expiresDate?: Date;
}

/**
 * Generate a cryptographically secure session token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Create a new operator session
 */
export async function createSession(
  operatorId: number,
  ipAddress?: string,
  userAgent?: string,
  createdBy: string = 'system'
): Promise<Session> {
  const sessionToken = generateSessionToken();
  const env = getEnv();

  const idleTimeoutSeconds = env.AUTH_SESSION_IDLE_TIMEOUT_SECONDS || 28800;     // default 8 hours
  const absoluteTimeoutSeconds = env.AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS || 2592000; // default 30 days

  const result = await invokeProcScalar('sp_operator_sessions_create', {
    i_operator_id: operatorId,
    i_session_token: sessionToken,
    i_ip_address: ipAddress || null,
    i_user_agent: userAgent || null,
    i_idle_timeout_seconds: idleTimeoutSeconds,
    i_absolute_timeout_seconds: absoluteTimeoutSeconds,
    i_created_by: createdBy,
  });

  if (!result) {
    throw new Error('Session creation failed: stored procedure returned no result');
  }

  return {
    id: result.o_id,
    sessionToken: result.o_session_token,
    operatorId,
    ipAddress,
    userAgent,
    createdDate: result.o_created_date,
    lastActivityDate: result.o_created_date,
    expiresDate: result.o_expires_date,
  };
}

/**
 * Validate a session token
 * Checks absolute expiry and idle timeout, updates last_activity_date on success
 */
export async function validateSession(
  sessionToken: string
): Promise<ValidationResult> {
  const env = getEnv();

  const idleTimeoutSeconds = env.AUTH_SESSION_IDLE_TIMEOUT_SECONDS || 28800;

  const result = await invokeProc('sp_operator_sessions_validate', {
    i_session_token: sessionToken,
    i_idle_timeout_seconds: idleTimeoutSeconds,
  });

  if (result.length === 0) {
    return { isValid: false };
  }

  const row = result[0];
  return {
    isValid: row.o_is_valid,
    operatorId: row.o_operator_id,
    sessionId: row.o_session_id,
    lastActivityDate: row.o_last_activity_date,
    expiresDate: row.o_expires_date,
  };
}

/**
 * Revoke a session (logout)
 */
export async function revokeSession(
  sessionToken: string,
  updatedBy: string
): Promise<boolean> {
  const result = await invokeProcScalar('sp_operator_sessions_revoke', {
    i_session_token: sessionToken,
    i_updated_by: updatedBy,
  });

  return result?.o_success ?? false;
}
