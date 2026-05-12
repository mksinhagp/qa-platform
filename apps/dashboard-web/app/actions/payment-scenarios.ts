'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { logAudit } from './audit';

export interface PaymentScenario {
  id: number;
  name: string;
  scenario_type: 'success' | 'decline' | 'avs_failure' | 'cvv_failure' | 'duplicate' | 'void' | 'refund';
  expected_result: string;
  description: string | null;
  test_amount: number;
  expected_response_code: string | null;
  expected_response_reason: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface CreatePaymentScenarioInput {
  name: string;
  scenario_type: 'success' | 'decline' | 'avs_failure' | 'cvv_failure' | 'duplicate' | 'void' | 'refund';
  expected_result: string;
  description?: string;
  test_card_number?: string;
  test_cvv?: string;
  test_expiry_month?: number;
  test_expiry_year?: number;
  test_amount?: number;
  avs_zip_code?: string;
  avs_address?: string;
  expected_response_code?: string;
  expected_response_reason?: string;
}

export interface UpdatePaymentScenarioInput {
  id: number;
  name?: string;
  scenario_type?: 'success' | 'decline' | 'avs_failure' | 'cvv_failure' | 'duplicate' | 'void' | 'refund';
  expected_result?: string;
  description?: string;
  test_card_number?: string;
  test_cvv?: string;
  test_expiry_month?: number;
  test_expiry_year?: number;
  test_amount?: number;
  avs_zip_code?: string;
  avs_address?: string;
  expected_response_code?: string;
  expected_response_reason?: string;
  is_active?: boolean;
}

export interface PaymentScenarioResult {
  success: boolean;
  scenario?: PaymentScenario;
  error?: string;
}

export interface PaymentScenariosListResult {
  success: boolean;
  scenarios?: PaymentScenario[];
  error?: string;
}

export async function listPaymentScenarios(
  scenarioType?: string,
  isActive?: boolean
): Promise<PaymentScenariosListResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_scenarios_list', {
      i_scenario_type: scenarioType || null,
      i_is_active: isActive !== undefined ? isActive : null,
    });

    const scenarios: PaymentScenario[] = result.map((row: {
      o_id: number;
      o_name: string;
      o_scenario_type: string;
      o_expected_result: string;
      o_description: string | null;
      o_test_amount: number;
      o_expected_response_code: string | null;
      o_expected_response_reason: string | null;
      o_is_active: boolean;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      scenario_type: row.o_scenario_type as any,
      expected_result: row.o_expected_result,
      description: row.o_description,
      test_amount: row.o_test_amount,
      expected_response_code: row.o_expected_response_code,
      expected_response_reason: row.o_expected_response_reason,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    }));

    return { success: true, scenarios };
  } catch (error) {
    console.error('List payment scenarios error:', error);
    return { success: false, error: 'Failed to list payment scenarios' };
  }
}

export async function getPaymentScenario(id: number): Promise<PaymentScenarioResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_scenarios_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment scenario not found' };
    }

    const row = result[0];
    const scenario: PaymentScenario = {
      id: row.o_id,
      name: row.o_name,
      scenario_type: row.o_scenario_type as any,
      expected_result: row.o_expected_result,
      description: row.o_description,
      test_amount: row.o_test_amount,
      expected_response_code: row.o_expected_response_code,
      expected_response_reason: row.o_expected_response_reason,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, scenario };
  } catch (error) {
    console.error('Get payment scenario error:', error);
    return { success: false, error: 'Failed to get payment scenario' };
  }
}

export async function createPaymentScenario(
  input: CreatePaymentScenarioInput
): Promise<PaymentScenarioResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');

    const result = await invokeProcWrite('sp_payment_scenarios_insert', {
      i_name: input.name,
      i_scenario_type: input.scenario_type,
      i_expected_result: input.expected_result,
      i_description: input.description || null,
      i_test_card_number: input.test_card_number || null,
      i_test_cvv: input.test_cvv || null,
      i_test_expiry_month: input.test_expiry_month || null,
      i_test_expiry_year: input.test_expiry_year || null,
      i_test_amount: input.test_amount || 1.00,
      i_avs_zip_code: input.avs_zip_code || null,
      i_avs_address: input.avs_address || null,
      i_expected_response_code: input.expected_response_code || null,
      i_expected_response_reason: input.expected_response_reason || null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create payment scenario' };
    }

    const row = result[0];
    const scenario: PaymentScenario = {
      id: row.o_id,
      name: row.o_name,
      scenario_type: input.scenario_type,
      expected_result: input.expected_result,
      description: input.description || null,
      test_amount: input.test_amount || 1.00,
      expected_response_code: input.expected_response_code || null,
      expected_response_reason: input.expected_response_reason || null,
      is_active: true,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    await logAudit({
      action: 'payment_scenario.create',
      target: `payment-scenario:${scenario.id}`,
      status: 'success',
      details: { name: input.name, type: input.scenario_type },
    });

    return { success: true, scenario };
  } catch (error) {
    console.error('Create payment scenario error:', error);
    return { success: false, error: 'Failed to create payment scenario' };
  }
}

export async function updatePaymentScenario(
  input: UpdatePaymentScenarioInput
): Promise<PaymentScenarioResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');

    const result = await invokeProcWrite('sp_payment_scenarios_update', {
      i_id: input.id,
      i_name: input.name || null,
      i_scenario_type: input.scenario_type || null,
      i_expected_result: input.expected_result || null,
      i_description: input.description || null,
      i_test_card_number: input.test_card_number || null,
      i_test_cvv: input.test_cvv || null,
      i_test_expiry_month: input.test_expiry_month || null,
      i_test_expiry_year: input.test_expiry_year || null,
      i_test_amount: input.test_amount || null,
      i_avs_zip_code: input.avs_zip_code || null,
      i_avs_address: input.avs_address || null,
      i_expected_response_code: input.expected_response_code || null,
      i_expected_response_reason: input.expected_response_reason || null,
      i_is_active: input.is_active !== undefined ? input.is_active : null,
      i_updated_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment scenario not found' };
    }

    const row = result[0];
    const scenario: PaymentScenario = {
      id: row.o_id,
      name: row.o_name,
      scenario_type: row.o_scenario_type as any,
      expected_result: row.o_expected_result,
      description: row.o_description,
      test_amount: row.o_test_amount,
      expected_response_code: row.o_expected_response_code,
      expected_response_reason: row.o_expected_response_reason,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    await logAudit({
      action: 'payment_scenario.update',
      target: `payment-scenario:${scenario.id}`,
      status: 'success',
      details: { id: input.id },
    });

    return { success: true, scenario };
  } catch (error) {
    console.error('Update payment scenario error:', error);
    return { success: false, error: 'Failed to update payment scenario' };
  }
}
