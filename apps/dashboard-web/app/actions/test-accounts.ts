'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────
// Aligned to sp_test_accounts_insert proc signature

const testAccountSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  run_execution_id: z.number().int().positive('Invalid run execution ID').optional(),
  persona_id: z.string().max(100, 'Persona ID too long').default('default'),
  email: z.string().email('Must be a valid email').max(255, 'Email too long'),
  username: z.string().max(255, 'Username too long').optional(),
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  password_hash: z.string().max(255).optional(),
  login_strategy: z.string().max(50, 'Login strategy too long').default('email_password'),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});

const testAccountStatusSchema = z.object({
  id: z.number().int().positive('Invalid test account ID'),
  account_status: z.string().min(1, 'Status is required').max(50, 'Status too long'),
  email_verified: z.boolean().optional(),
  verification_method: z.string().max(50).optional(),
});

const accountActionSchema = z.object({
  test_account_id: z.number().int().positive('Invalid test account ID'),
  action_type: z.string().min(1, 'Action type is required').max(50, 'Action type too long'),
  action_status: z.string().max(50).default('pending'),
  run_execution_id: z.number().int().positive().optional(),
  step_name: z.string().max(255).optional(),
  duration_ms: z.number().int().optional(),
  error_message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

const accountActionUpdateSchema = z.object({
  id: z.number().int().positive('Invalid action ID'),
  action_status: z.string().min(1, 'Action status is required').max(50, 'Action status too long'),
  duration_ms: z.number().int().optional(),
  error_message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────
// Aligned to sp_test_accounts_list / sp_test_accounts_get_by_id output columns

export interface TestAccount {
  id: number;
  site_id: number;
  run_execution_id: number | null;
  persona_id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  account_status: string;
  login_strategy: string;
  email_verified: boolean;
  cleanup_status: string;
  cleanup_approved_by: string | null;
  cleaned_up_at: string | null;
  notes: string | null;
  created_date: string;
  updated_date: string;
}

export interface TestAccountDetail extends TestAccount {
  phone: string | null;
  verification_method: string | null;
  cleanup_approved_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TestAccountAction {
  id: number;
  test_account_id: number;
  run_execution_id: number | null;
  action_type: string;
  action_status: string;
  step_name: string | null;
  duration_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  created_date: string;
}

// ─── Row Mappers ─────────────────────────────────────────────────────────────
// Aligned to sp_test_accounts_list output columns

function mapTestAccountRow(row: Record<string, unknown>): TestAccount {
  return {
    id: row.o_id as number,
    site_id: row.o_site_id as number,
    run_execution_id: (row.o_run_execution_id as number) ?? null,
    persona_id: row.o_persona_id as string,
    email: row.o_email as string,
    username: (row.o_username as string) ?? null,
    first_name: (row.o_first_name as string) ?? null,
    last_name: (row.o_last_name as string) ?? null,
    account_status: row.o_account_status as string,
    login_strategy: row.o_login_strategy as string,
    email_verified: row.o_email_verified as boolean,
    cleanup_status: row.o_cleanup_status as string,
    cleanup_approved_by: (row.o_cleanup_approved_by as string) ?? null,
    cleaned_up_at: (row.o_cleaned_up_at as string) ?? null,
    notes: (row.o_notes as string) ?? null,
    created_date: row.o_created_date as string,
    updated_date: (row.o_updated_date as string) ?? '',
  };
}

// Aligned to sp_test_accounts_get_by_id output columns (superset of list)
function mapTestAccountDetailRow(row: Record<string, unknown>): TestAccountDetail {
  return {
    ...mapTestAccountRow(row),
    phone: (row.o_phone as string) ?? null,
    verification_method: (row.o_verification_method as string) ?? null,
    cleanup_approved_at: (row.o_cleanup_approved_at as string) ?? null,
    metadata: (row.o_metadata as Record<string, unknown>) ?? null,
  };
}

function mapAccountActionRow(row: Record<string, unknown>): TestAccountAction {
  return {
    id: row.o_id as number,
    test_account_id: row.o_test_account_id as number,
    run_execution_id: (row.o_run_execution_id as number) ?? null,
    action_type: row.o_action_type as string,
    action_status: row.o_action_status as string,
    step_name: (row.o_step_name as string) ?? null,
    duration_ms: (row.o_duration_ms as number) ?? null,
    error_message: (row.o_error_message as string) ?? null,
    details: (row.o_details as Record<string, unknown>) ?? null,
    created_date: row.o_created_date as string,
  };
}

// ─── Test Accounts ───────────────────────────────────────────────────────────

export async function listTestAccounts(
  siteId: number,
  cleanupStatus?: string,
  accountStatus?: string,
  limit?: number,
  offset?: number
): Promise<{ success: boolean; accounts?: TestAccount[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_test_accounts_list', {
      i_site_id: siteId,
      i_cleanup_status: cleanupStatus ?? null,
      i_account_status: accountStatus ?? null,
      i_limit: limit ?? 100,
      i_offset: offset ?? 0,
    });
    const accounts: TestAccount[] = result.map(mapTestAccountRow);
    return { success: true, accounts };
  } catch (error) {
    console.error('List test accounts error:', error);
    return { success: false, error: 'Failed to list test accounts' };
  }
}

export async function getTestAccount(
  id: number
): Promise<{ success: boolean; account?: TestAccountDetail; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_test_accounts_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Test account not found' };
    return { success: true, account: mapTestAccountDetailRow(result[0]) };
  } catch (error) {
    console.error('Get test account error:', error);
    return { success: false, error: 'Failed to get test account' };
  }
}

export async function createTestAccount(data: {
  site_id: number;
  run_execution_id?: number;
  persona_id?: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  password_hash?: string;
  login_strategy?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
}): Promise<{ success: boolean; account?: { id: number; email: string; account_status: string }; error?: string }> {
  try {
    const validation = testAccountSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_test_accounts_insert returns: o_id, o_email, o_account_status
    const result = await invokeProcWrite('sp_test_accounts_insert', {
      i_site_id: validation.data.site_id,
      i_run_execution_id: validation.data.run_execution_id ?? null,
      i_persona_id: validation.data.persona_id,
      i_email: validation.data.email,
      i_username: validation.data.username ?? null,
      i_first_name: validation.data.first_name ?? null,
      i_last_name: validation.data.last_name ?? null,
      i_phone: validation.data.phone ?? null,
      i_password_hash: validation.data.password_hash ?? null,
      i_login_strategy: validation.data.login_strategy,
      i_metadata: validation.data.metadata ? JSON.stringify(validation.data.metadata) : null,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      account: {
        id: row.o_id as number,
        email: row.o_email as string,
        account_status: row.o_account_status as string,
      },
    };
  } catch (error) {
    console.error('Create test account error:', error);
    return { success: false, error: 'Failed to create test account' };
  }
}

export async function updateTestAccountStatus(
  id: number,
  accountStatus: string,
  emailVerified?: boolean,
  verificationMethod?: string
): Promise<{ success: boolean; account?: { id: number; account_status: string; email_verified: boolean }; error?: string }> {
  try {
    const validation = testAccountStatusSchema.safeParse({
      id,
      account_status: accountStatus,
      email_verified: emailVerified,
      verification_method: verificationMethod,
    });
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_test_accounts_update_status returns: o_id, o_account_status, o_email_verified
    const result = await invokeProcWrite('sp_test_accounts_update_status', {
      i_id: validation.data.id,
      i_account_status: validation.data.account_status,
      i_email_verified: validation.data.email_verified ?? null,
      i_verification_method: validation.data.verification_method ?? null,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      account: {
        id: row.o_id as number,
        account_status: row.o_account_status as string,
        email_verified: row.o_email_verified as boolean,
      },
    };
  } catch (error) {
    console.error('Update test account status error:', error);
    return { success: false, error: 'Failed to update test account status' };
  }
}

export async function requestCleanup(
  id: number
): Promise<{ success: boolean; account?: { id: number; cleanup_status: string }; error?: string }> {
  try {
    const authContext = await requireOperator();
    // sp_test_accounts_request_cleanup returns: o_id, o_cleanup_status
    // Proc only accepts i_id and i_updated_by (no reason param)
    const result = await invokeProcWrite('sp_test_accounts_request_cleanup', {
      i_id: id,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      account: { id: row.o_id as number, cleanup_status: row.o_cleanup_status as string },
    };
  } catch (error) {
    console.error('Request cleanup error:', error);
    return { success: false, error: 'Failed to request cleanup' };
  }
}

export async function approveCleanup(
  id: number
): Promise<{ success: boolean; account?: { id: number; cleanup_status: string }; error?: string }> {
  try {
    const authContext = await requireOperator();
    // sp_test_accounts_approve_cleanup returns: o_id, o_cleanup_status
    const result = await invokeProcWrite('sp_test_accounts_approve_cleanup', {
      i_id: id,
      i_approved_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      account: { id: row.o_id as number, cleanup_status: row.o_cleanup_status as string },
    };
  } catch (error) {
    console.error('Approve cleanup error:', error);
    return { success: false, error: 'Failed to approve cleanup' };
  }
}

export async function markCleaned(
  id: number
): Promise<{ success: boolean; account?: { id: number; cleanup_status: string }; error?: string }> {
  try {
    const authContext = await requireOperator();
    // sp_test_accounts_mark_cleaned returns: o_id, o_cleanup_status
    const result = await invokeProcWrite('sp_test_accounts_mark_cleaned', {
      i_id: id,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      account: { id: row.o_id as number, cleanup_status: row.o_cleanup_status as string },
    };
  } catch (error) {
    console.error('Mark cleaned error:', error);
    return { success: false, error: 'Failed to mark account as cleaned' };
  }
}

// ─── Test Account Actions ─────────────────────────────────────────────────────

export async function createAccountAction(data: {
  test_account_id: number;
  action_type: string;
  action_status?: string;
  run_execution_id?: number;
  step_name?: string;
  duration_ms?: number;
  error_message?: string;
  details?: Record<string, unknown>;
}): Promise<{ success: boolean; action?: { id: number; action_type: string; action_status: string }; error?: string }> {
  try {
    const validation = accountActionSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_test_account_actions_insert returns: o_id, o_action_type, o_action_status
    const result = await invokeProcWrite('sp_test_account_actions_insert', {
      i_test_account_id: validation.data.test_account_id,
      i_action_type: validation.data.action_type,
      i_action_status: validation.data.action_status,
      i_run_execution_id: validation.data.run_execution_id ?? null,
      i_step_name: validation.data.step_name ?? null,
      i_duration_ms: validation.data.duration_ms ?? null,
      i_error_message: validation.data.error_message ?? null,
      i_details: validation.data.details ? JSON.stringify(validation.data.details) : null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      action: {
        id: row.o_id as number,
        action_type: row.o_action_type as string,
        action_status: row.o_action_status as string,
      },
    };
  } catch (error) {
    console.error('Create account action error:', error);
    return { success: false, error: 'Failed to create account action' };
  }
}

export async function listAccountActions(
  testAccountId: number
): Promise<{ success: boolean; actions?: TestAccountAction[]; error?: string }> {
  try {
    await requireOperator();
    // sp_test_account_actions_list only takes i_test_account_id
    const result = await invokeProc('sp_test_account_actions_list', {
      i_test_account_id: testAccountId,
    });
    const actions: TestAccountAction[] = result.map(mapAccountActionRow);
    return { success: true, actions };
  } catch (error) {
    console.error('List account actions error:', error);
    return { success: false, error: 'Failed to list account actions' };
  }
}

export async function updateAccountAction(data: {
  id: number;
  action_status: string;
  duration_ms?: number;
  error_message?: string;
  details?: Record<string, unknown>;
}): Promise<{ success: boolean; action?: { id: number; action_type: string; action_status: string }; error?: string }> {
  try {
    const validation = accountActionUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_test_account_actions_update returns: o_id, o_action_type, o_action_status
    const result = await invokeProcWrite('sp_test_account_actions_update', {
      i_id: validation.data.id,
      i_action_status: validation.data.action_status,
      i_duration_ms: validation.data.duration_ms ?? null,
      i_error_message: validation.data.error_message ?? null,
      i_details: validation.data.details ? JSON.stringify(validation.data.details) : null,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Account action not found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      action: {
        id: row.o_id as number,
        action_type: row.o_action_type as string,
        action_status: row.o_action_status as string,
      },
    };
  } catch (error) {
    console.error('Update account action error:', error);
    return { success: false, error: 'Failed to update account action' };
  }
}
