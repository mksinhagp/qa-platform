'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { hashPassword } from '@qa-platform/auth';
import { requireCapability, requireOperator } from '@qa-platform/auth';

export interface Operator {
  id: number;
  login: string;
  full_name: string | null;
  email: string | null;
  active: boolean;
  created_date: string;
  updated_date: string;
}

export interface CreateOperatorInput {
  login: string;
  password: string;
  full_name?: string;
  email?: string;
  active?: boolean;
}

export interface UpdateOperatorInput {
  id: number;
  password?: string;
  full_name?: string;
  email?: string;
  active?: boolean;
}

export interface OperatorResult {
  success: boolean;
  operator?: Operator;
  error?: string;
}

export interface OperatorsListResult {
  success: boolean;
  operators?: Operator[];
  error?: string;
}

export async function listOperators(activeOnly?: boolean): Promise<OperatorsListResult> {
  try {
    // Require operator.manage capability
    await requireCapability('operator.manage');

    const result = await invokeProc('sp_operators_list', {
      i_active: activeOnly ?? null,
    });

    const operators: Operator[] = result.map((row: {
      o_id: number;
      o_login: string;
      o_full_name: string | null;
      o_email: string | null;
      o_active: boolean;
      o_created_date: string;
      o_updated_date: string;
    }) => ({
      id: row.o_id,
      login: row.o_login,
      full_name: row.o_full_name,
      email: row.o_email,
      active: row.o_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    }));

    return { success: true, operators };
  } catch (error) {
    console.error('List operators error:', error);
    return { success: false, error: 'Failed to list operators' };
  }
}

export async function getOperator(id: number): Promise<OperatorResult> {
  try {
    // Require operator.manage capability
    await requireCapability('operator.manage');

    const result = await invokeProc('sp_operators_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Operator not found' };
    }

    const row = result[0];
    const operator: Operator = {
      id: row.o_id,
      login: row.o_login,
      full_name: row.o_full_name,
      email: row.o_email,
      active: row.o_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, operator };
  } catch (error) {
    console.error('Get operator error:', error);
    return { success: false, error: 'Failed to get operator' };
  }
}

export async function createOperator(input: CreateOperatorInput): Promise<OperatorResult> {
  try {
    // Require operator.manage capability
    const authContext = await requireCapability('operator.manage');

    // Hash the password
    const passwordHash = await hashPassword(input.password);

    const result = await invokeProcWrite('sp_operators_insert', {
      i_login: input.login,
      i_password_hash: passwordHash,
      i_full_name: input.full_name || null,
      i_email: input.email || null,
      i_active: input.active ?? true,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create operator' };
    }

    const row = result[0];
    const operator: Operator = {
      id: row.o_id,
      login: row.o_login,
      full_name: row.o_full_name,
      email: row.o_email,
      active: row.o_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, operator };
  } catch (error) {
    console.error('Create operator error:', error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique constraint')) {
      return { success: false, error: 'Login already exists' };
    }
    
    return { success: false, error: 'Failed to create operator' };
  }
}

export async function updateOperator(input: UpdateOperatorInput): Promise<OperatorResult> {
  try {
    // Require operator.manage capability
    const authContext = await requireCapability('operator.manage');

    // Hash password if provided
    let passwordHash: string | null = null;
    if (input.password && input.password.length > 0) {
      passwordHash = await hashPassword(input.password);
    }

    const result = await invokeProcWrite('sp_operators_update', {
      i_id: input.id,
      i_password_hash: passwordHash,
      i_full_name: input.full_name !== undefined ? (input.full_name || null) : null,
      i_email: input.email !== undefined ? (input.email || null) : null,
      i_active: input.active !== undefined ? input.active : null,
      i_updated_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Operator not found' };
    }

    const row = result[0];
    const operator: Operator = {
      id: row.o_id,
      login: row.o_login,
      full_name: row.o_full_name,
      email: row.o_email,
      active: row.o_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, operator };
  } catch (error) {
    console.error('Update operator error:', error);
    return { success: false, error: 'Failed to update operator' };
  }
}
