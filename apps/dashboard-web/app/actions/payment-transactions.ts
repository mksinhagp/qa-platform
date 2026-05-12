'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';

export interface PaymentTransaction {
  id: number;
  run_execution_id: number;
  site_id: number;
  site_environment_id: number;
  persona_id: number | null;
  payment_provider_id: number | null;
  payment_profile_id: number | null;
  payment_scenario_id: number | null;
  transaction_type: 'authorize' | 'capture' | 'void' | 'refund';
  amount: number;
  currency: string;
  provider_transaction_id: string | null;
  status: 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refunded';
  email_receipt_verified: boolean;
  admin_reconciled: boolean;
  test_data_cleanup_status: string;
  approval_id: number | null;
  created_date: string;
  updated_date: string;
}

export interface CreatePaymentTransactionInput {
  run_execution_id: number;
  site_id: number;
  site_environment_id: number;
  persona_id?: number;
  payment_provider_id?: number;
  payment_profile_id?: number;
  payment_scenario_id?: number;
  transaction_type: 'authorize' | 'capture' | 'void' | 'refund';
  amount: number;
  currency?: string;
  provider_transaction_id?: string;
  provider_response_code?: string;
  provider_response_reason?: string;
  provider_response_text?: string;
  status?: 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refunded';
  ui_confirmation?: string;
  email_receipt_verified?: boolean;
  email_receipt_details?: string;
  admin_reconciled?: boolean;
  admin_reconciliation_details?: string;
  error_message?: string;
  redacted_card_number?: string;
  redacted_cvv?: string;
  test_data_generated?: boolean;
  test_data_cleanup_status?: string;
  approval_id?: number;
}

export interface UpdatePaymentTransactionInput {
  id: number;
  provider_transaction_id?: string;
  provider_response_code?: string;
  provider_response_reason?: string;
  provider_response_text?: string;
  status?: 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refunded';
  ui_confirmation?: string;
  email_receipt_verified?: boolean;
  email_receipt_details?: string;
  admin_reconciled?: boolean;
  admin_reconciliation_details?: string;
  error_message?: string;
  redacted_card_number?: string;
  redacted_cvv?: string;
  test_data_generated?: boolean;
  test_data_cleanup_status?: string;
}

export interface PaymentTransactionResult {
  success: boolean;
  transaction?: PaymentTransaction;
  error?: string;
}

export interface PaymentTransactionsListResult {
  success: boolean;
  transactions?: PaymentTransaction[];
  error?: string;
}

export async function listPaymentTransactions(
  runExecutionId?: number,
  siteId?: number,
  paymentProviderId?: number,
  status?: string,
  transactionType?: string,
  limit?: number,
  offset?: number
): Promise<PaymentTransactionsListResult> {
  try {
    await requireCapability('runs.view');

    const result = await invokeProc('sp_payment_transactions_list', {
      i_run_execution_id: runExecutionId || null,
      i_site_id: siteId || null,
      i_payment_provider_id: paymentProviderId || null,
      i_status: status || null,
      i_transaction_type: transactionType || null,
      i_limit: limit || 100,
      i_offset: offset || 0,
    });

    const transactions: PaymentTransaction[] = result.map((row: {
      o_id: number;
      o_run_execution_id: number;
      o_site_id: number;
      o_site_environment_id: number;
      o_persona_id: number | null;
      o_payment_provider_id: number | null;
      o_payment_scenario_id: number | null;
      o_transaction_type: string;
      o_amount: number;
      o_currency: string;
      o_provider_transaction_id: string | null;
      o_status: string;
      o_email_receipt_verified: boolean;
      o_admin_reconciled: boolean;
      o_test_data_cleanup_status: string;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      run_execution_id: row.o_run_execution_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      persona_id: row.o_persona_id,
      payment_provider_id: row.o_payment_provider_id,
      payment_profile_id: null,
      payment_scenario_id: row.o_payment_scenario_id,
      transaction_type: row.o_transaction_type as any,
      amount: row.o_amount,
      currency: row.o_currency,
      provider_transaction_id: row.o_provider_transaction_id,
      status: row.o_status as any,
      email_receipt_verified: row.o_email_receipt_verified,
      admin_reconciled: row.o_admin_reconciled,
      test_data_cleanup_status: row.o_test_data_cleanup_status,
      approval_id: null,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    }));

    return { success: true, transactions };
  } catch (error) {
    console.error('List payment transactions error:', error);
    return { success: false, error: 'Failed to list payment transactions' };
  }
}

export async function getPaymentTransaction(id: number): Promise<PaymentTransactionResult> {
  try {
    await requireCapability('runs.view');

    const result = await invokeProc('sp_payment_transactions_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment transaction not found' };
    }

    const row = result[0];
    const transaction: PaymentTransaction = {
      id: row.o_id,
      run_execution_id: row.o_run_execution_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      persona_id: row.o_persona_id,
      payment_provider_id: row.o_payment_provider_id,
      payment_profile_id: row.o_payment_profile_id,
      payment_scenario_id: row.o_payment_scenario_id,
      transaction_type: row.o_transaction_type as any,
      amount: row.o_amount,
      currency: row.o_currency,
      provider_transaction_id: row.o_provider_transaction_id,
      status: row.o_status as any,
      email_receipt_verified: row.o_email_receipt_verified,
      admin_reconciled: row.o_admin_reconciled,
      test_data_cleanup_status: row.o_test_data_cleanup_status,
      approval_id: row.o_approval_id,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, transaction };
  } catch (error) {
    console.error('Get payment transaction error:', error);
    return { success: false, error: 'Failed to get payment transaction' };
  }
}

export async function createPaymentTransaction(
  input: CreatePaymentTransactionInput
): Promise<PaymentTransactionResult> {
  try {
    const authContext = await requireCapability('runs.execute');

    const result = await invokeProcWrite('sp_payment_transactions_insert', {
      i_run_execution_id: input.run_execution_id,
      i_site_id: input.site_id,
      i_site_environment_id: input.site_environment_id,
      i_persona_id: input.persona_id || null,
      i_payment_provider_id: input.payment_provider_id || null,
      i_payment_profile_id: input.payment_profile_id || null,
      i_payment_scenario_id: input.payment_scenario_id || null,
      i_transaction_type: input.transaction_type,
      i_amount: input.amount,
      i_currency: input.currency || 'USD',
      i_provider_transaction_id: input.provider_transaction_id || null,
      i_provider_response_code: input.provider_response_code || null,
      i_provider_response_reason: input.provider_response_reason || null,
      i_provider_response_text: input.provider_response_text || null,
      i_status: input.status || 'pending',
      i_ui_confirmation: input.ui_confirmation || null,
      i_email_receipt_verified: input.email_receipt_verified || false,
      i_email_receipt_details: input.email_receipt_details || null,
      i_admin_reconciled: input.admin_reconciled || false,
      i_admin_reconciliation_details: input.admin_reconciliation_details || null,
      i_error_message: input.error_message || null,
      i_redacted_card_number: input.redacted_card_number || null,
      i_redacted_cvv: input.redacted_cvv || null,
      i_test_data_generated: input.test_data_generated || false,
      i_test_data_cleanup_status: input.test_data_cleanup_status || 'pending',
      i_approval_id: input.approval_id || null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create payment transaction' };
    }

    const row = result[0];
    const transaction: PaymentTransaction = {
      id: row.o_id,
      run_execution_id: row.o_run_execution_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      persona_id: input.persona_id || null,
      payment_provider_id: input.payment_provider_id || null,
      payment_profile_id: input.payment_profile_id || null,
      payment_scenario_id: input.payment_scenario_id || null,
      transaction_type: input.transaction_type,
      amount: input.amount,
      currency: input.currency || 'USD',
      provider_transaction_id: input.provider_transaction_id || null,
      status: input.status || 'pending',
      email_receipt_verified: input.email_receipt_verified || false,
      admin_reconciled: input.admin_reconciled || false,
      test_data_cleanup_status: input.test_data_cleanup_status || 'pending',
      approval_id: input.approval_id || null,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    return { success: true, transaction };
  } catch (error) {
    console.error('Create payment transaction error:', error);
    return { success: false, error: 'Failed to create payment transaction' };
  }
}

export async function updatePaymentTransaction(
  input: UpdatePaymentTransactionInput
): Promise<PaymentTransactionResult> {
  try {
    const authContext = await requireCapability('runs.execute');

    const result = await invokeProcWrite('sp_payment_transactions_update', {
      i_id: input.id,
      i_provider_transaction_id: input.provider_transaction_id || null,
      i_provider_response_code: input.provider_response_code || null,
      i_provider_response_reason: input.provider_response_reason || null,
      i_provider_response_text: input.provider_response_text || null,
      i_status: input.status || null,
      i_ui_confirmation: input.ui_confirmation || null,
      i_email_receipt_verified: input.email_receipt_verified !== undefined ? input.email_receipt_verified : null,
      i_email_receipt_details: input.email_receipt_details || null,
      i_admin_reconciled: input.admin_reconciled !== undefined ? input.admin_reconciled : null,
      i_admin_reconciliation_details: input.admin_reconciliation_details || null,
      i_error_message: input.error_message || null,
      i_redacted_card_number: input.redacted_card_number || null,
      i_redacted_cvv: input.redacted_cvv || null,
      i_test_data_generated: input.test_data_generated !== undefined ? input.test_data_generated : null,
      i_test_data_cleanup_status: input.test_data_cleanup_status || null,
      i_updated_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment transaction not found' };
    }

    const row = result[0];
    const transaction: PaymentTransaction = {
      id: row.o_id,
      run_execution_id: 0,
      site_id: 0,
      site_environment_id: 0,
      persona_id: null,
      payment_provider_id: null,
      payment_profile_id: null,
      payment_scenario_id: null,
      transaction_type: 'authorize',
      amount: 0,
      currency: 'USD',
      provider_transaction_id: row.o_provider_transaction_id,
      status: row.o_status as any,
      email_receipt_verified: false,
      admin_reconciled: false,
      test_data_cleanup_status: 'pending',
      approval_id: null,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, transaction };
  } catch (error) {
    console.error('Update payment transaction error:', error);
    return { success: false, error: 'Failed to update payment transaction' };
  }
}
