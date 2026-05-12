'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const testAccountSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  site_environment_id: z.number().int().positive('Invalid site environment ID').optional(),
  persona_id: z.number().int().positive('Invalid persona ID').optional(),
  email: z.string().email('Must be a valid email').max(255, 'Email too long'),
  username: z.string().max(255, 'Username too long').optional(),
  login_strategy: z.string().min(1, 'Login strategy is required').max(100, 'Login strategy too long'),
  status: z.string().min(1, 'Status is required').max(50, 'Status too long'),
  metadata_json: z.record(z.unknown()).optional(),
});

const testAccountStatusSchema = z.object({
  id: z.number().int().positive('Invalid test account ID'),
  status: z.string().min(1, 'Status is required').max(50, 'Status too long'),
});

const requestCleanupSchema = z.object({
  id: z.number().int().positive('Invalid test account ID'),
  reason: z.string().min(1, 'Reason is required').max(1000, 'Reason too long'),
});

const accountActionSchema = z.object({
  test_account_id: z.number().int().positive('Invalid test account ID'),
  action_type: z.string().min(1, 'Action type is required').max(100, 'Action type too long'),
  flow_key: z.string().max(255, 'Flow key too long').optional(),
  result_status: z.string().min(1, 'Result status is required').max(50, 'Result status too long'),
  detail_json: z.record(z.unknown()).optional(),
});

const accountActionUpdateSchema = z.object({
  id: z.number().int().positive('Invalid action ID'),
  result_status: z.string().min(1, 'Result status is required').max(50, 'Result status too long'),
  detail_json: z.record(z.unknown()).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TestAccount {
  id: number;
  site_id: number;
  site_environment_id: number | null;
  persona_id: number | null;
  email: string;
  username: string | null;
  login_strategy: string;
  status: string; // 'active' | 'pending_cleanup' | 'cleanup_approved' | 'cleaned'
  metadata_json: Record<string, unknown> | null;
  created_date: string;
  updated_date: string;
}

export interface TestAccountAction {
  id: number;
  test_account_id: number;
  action_type: string;
  flow_key: string | null;
  result_status: string;
  detail_json: Record<string, unknown> | null;
  created_date: string;
}

// ─── Row Mappers ─────────────────────────────────────────────────────────────

function mapTestAccountRow(row: {
  o_id: number;
  o_site_id: number;
  o_site_environment_id: number | null;
  o_persona_id: number | null;
  o_email: string;
  o_username: string | null;
  o_login_strategy: string;
  o_status: string;
  o_metadata_json: Record<string, unknown> | null;
  o_created_date: string;
  o_updated_date: string;
}): TestAccount {
  return {
    id: row.o_id,
    site_id: row.o_site_id,
    site_environment_id: row.o_site_environment_id ?? null,
    persona_id: row.o_persona_id ?? null,
    email: row.o_email,
    username: row.o_username ?? null,
    login_strategy: row.o_login_strategy,
    status: row.o_status,
    metadata_json: row.o_metadata_json ?? null,
    created_date: row.o_created_date,
    updated_date: row.o_updated_date ?? '',
  };
}

function mapAccountActionRow(row: {
  o_id: number;
  o_test_account_id: number;
  o_action_type: string;
  o_flow_key: string | null;
  o_result_status: string;
  o_detail_json: Record<string, unknown> | null;
  o_created_date: string;
}): TestAccountAction {
  return {
    id: row.o_id,
    test_account_id: row.o_test_account_id,
    action_type: row.o_action_type,
    flow_key: row.o_flow_key ?? null,
    result_status: row.o_result_status,
    detail_json: row.o_detail_json ?? null,
    created_date: row.o_created_date,
  };
}

// ─── Test Accounts ───────────────────────────────────────────────────────────

export async function listTestAccounts(
  siteId: number,
  status?: string,
  personaId?: number
): Promise<{ success: boolean; accounts?: TestAccount[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_test_accounts_list', {
      i_site_id: siteId,
      i_status: status ?? null,
      i_persona_id: personaId ?? null,
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
): Promise<{ success: boolean; account?: TestAccount; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_test_accounts_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Test account not found' };
    return { success: true, account: mapTestAccountRow(result[0]) };
  } catch (error) {
    console.error('Get test account error:', error);
    return { success: false, error: 'Failed to get test account' };
  }
}

export async function createTestAccount(data: {
  site_id: number;
  site_environment_id?: number;
  persona_id?: number;
  email: string;
  username?: string;
  login_strategy: string;
  status: string;
  metadata_json?: Record<string, unknown>;
}): Promise<{ success: boolean; account?: TestAccount; error?: string }> {
  try {
    // Validate input
    const validation = testAccountSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_accounts_insert', {
      i_site_id: validation.data.site_id,
      i_site_environment_id: validation.data.site_environment_id ?? null,
      i_persona_id: validation.data.persona_id ?? null,
      i_email: validation.data.email,
      i_username: validation.data.username ?? null,
      i_login_strategy: validation.data.login_strategy,
      i_status: validation.data.status,
      i_metadata_json: validation.data.metadata_json ? JSON.stringify(validation.data.metadata_json) : null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return {
      success: true,
      account: {
        id: row.o_id,
        site_id: row.o_site_id,
        site_environment_id: null,
        persona_id: row.o_persona_id ?? null,
        email: row.o_email,
        username: row.o_username ?? null,
        login_strategy: row.o_login_strategy,
        status: row.o_status,
        metadata_json: null,
        created_date: row.o_created_date,
        updated_date: '',
      },
    };
  } catch (error) {
    console.error('Create test account error:', error);
    return { success: false, error: 'Failed to create test account' };
  }
}

export async function updateTestAccountStatus(
  id: number,
  status: string
): Promise<{ success: boolean; account?: Pick<TestAccount, 'id' | 'status' | 'updated_date'>; error?: string }> {
  try {
    // Validate input
    const validation = testAccountStatusSchema.safeParse({ id, status });
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_accounts_update_status', {
      i_id: validation.data.id,
      i_status: validation.data.status,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0];
    return {
      success: true,
      account: { id: row.o_id, status: row.o_status, updated_date: row.o_updated_date },
    };
  } catch (error) {
    console.error('Update test account status error:', error);
    return { success: false, error: 'Failed to update test account status' };
  }
}

export async function requestCleanup(
  id: number,
  reason: string
): Promise<{ success: boolean; account?: Pick<TestAccount, 'id' | 'status'>; error?: string }> {
  try {
    // Validate input
    const validation = requestCleanupSchema.safeParse({ id, reason });
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_accounts_request_cleanup', {
      i_id: validation.data.id,
      i_reason: validation.data.reason,
      i_requested_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0];
    return { success: true, account: { id: row.o_id, status: row.o_status } };
  } catch (error) {
    console.error('Request cleanup error:', error);
    return { success: false, error: 'Failed to request cleanup' };
  }
}

export async function approveCleanup(
  id: number
): Promise<{ success: boolean; account?: Pick<TestAccount, 'id' | 'status'>; error?: string }> {
  try {
    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_accounts_approve_cleanup', {
      i_id: id,
      i_approved_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0];
    return { success: true, account: { id: row.o_id, status: row.o_status } };
  } catch (error) {
    console.error('Approve cleanup error:', error);
    return { success: false, error: 'Failed to approve cleanup' };
  }
}

export async function markCleaned(
  id: number
): Promise<{ success: boolean; account?: Pick<TestAccount, 'id' | 'status'>; error?: string }> {
  try {
    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_accounts_mark_cleaned', {
      i_id: id,
      i_cleaned_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Test account not found' };
    const row = result[0];
    return { success: true, account: { id: row.o_id, status: row.o_status } };
  } catch (error) {
    console.error('Mark cleaned error:', error);
    return { success: false, error: 'Failed to mark account as cleaned' };
  }
}

// ─── Test Account Actions ─────────────────────────────────────────────────────

export async function createAccountAction(data: {
  test_account_id: number;
  action_type: string;
  flow_key?: string;
  result_status: string;
  detail_json?: Record<string, unknown>;
}): Promise<{ success: boolean; action?: TestAccountAction; error?: string }> {
  try {
    // Validate input
    const validation = accountActionSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_account_actions_insert', {
      i_test_account_id: validation.data.test_account_id,
      i_action_type: validation.data.action_type,
      i_flow_key: validation.data.flow_key ?? null,
      i_result_status: validation.data.result_status,
      i_detail_json: validation.data.detail_json ? JSON.stringify(validation.data.detail_json) : null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return {
      success: true,
      action: {
        id: row.o_id,
        test_account_id: row.o_test_account_id,
        action_type: row.o_action_type,
        flow_key: row.o_flow_key ?? null,
        result_status: row.o_result_status,
        detail_json: null,
        created_date: row.o_created_date,
      },
    };
  } catch (error) {
    console.error('Create account action error:', error);
    return { success: false, error: 'Failed to create account action' };
  }
}

export async function listAccountActions(
  testAccountId: number,
  actionType?: string
): Promise<{ success: boolean; actions?: TestAccountAction[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_test_account_actions_list', {
      i_test_account_id: testAccountId,
      i_action_type: actionType ?? null,
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
  result_status: string;
  detail_json?: Record<string, unknown>;
}): Promise<{ success: boolean; action?: Pick<TestAccountAction, 'id' | 'result_status'>; error?: string }> {
  try {
    // Validate input
    const validation = accountActionUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_test_account_actions_update', {
      i_id: validation.data.id,
      i_result_status: validation.data.result_status,
      i_detail_json: validation.data.detail_json ? JSON.stringify(validation.data.detail_json) : null,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Account action not found' };
    const row = result[0];
    return { success: true, action: { id: row.o_id, result_status: row.o_result_status } };
  } catch (error) {
    console.error('Update account action error:', error);
    return { success: false, error: 'Failed to update account action' };
  }
}
