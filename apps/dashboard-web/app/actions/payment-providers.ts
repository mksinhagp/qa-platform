'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { logAudit } from './audit';

export interface PaymentProvider {
  id: number;
  name: string;
  provider_type: 'authorize_net' | 'stripe' | 'paypal' | 'generic';
  is_sandbox: boolean;
  merchant_id: string | null;
  environment_url: string | null;
  description: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface CreatePaymentProviderInput {
  name: string;
  provider_type: 'authorize_net' | 'stripe' | 'paypal' | 'generic';
  is_sandbox?: boolean;
  api_login_id_secret_id?: number;
  api_transaction_key_secret_id?: number;
  api_key_secret_id?: number;
  api_secret_secret_id?: number;
  merchant_id?: string;
  environment_url?: string;
  description?: string;
}

export interface UpdatePaymentProviderInput {
  id: number;
  name?: string;
  is_sandbox?: boolean;
  api_login_id_secret_id?: number;
  api_transaction_key_secret_id?: number;
  api_key_secret_id?: number;
  api_secret_secret_id?: number;
  merchant_id?: string;
  environment_url?: string;
  description?: string;
  is_active?: boolean;
}

export interface PaymentProviderResult {
  success: boolean;
  provider?: PaymentProvider;
  error?: string;
}

export interface PaymentProvidersListResult {
  success: boolean;
  providers?: PaymentProvider[];
  error?: string;
}

export async function listPaymentProviders(
  providerType?: string,
  isSandbox?: boolean,
  isActive?: boolean
): Promise<PaymentProvidersListResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_providers_list', {
      i_provider_type: providerType || null,
      i_is_sandbox: isSandbox !== undefined ? isSandbox : null,
      i_is_active: isActive !== undefined ? isActive : null,
    });

    const providers: PaymentProvider[] = result.map((row: {
      o_id: number;
      o_name: string;
      o_provider_type: string;
      o_is_sandbox: boolean;
      o_merchant_id: string | null;
      o_environment_url: string | null;
      o_description: string | null;
      o_is_active: boolean;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      provider_type: row.o_provider_type as any,
      is_sandbox: row.o_is_sandbox,
      merchant_id: row.o_merchant_id,
      environment_url: row.o_environment_url,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    }));

    return { success: true, providers };
  } catch (error) {
    console.error('List payment providers error:', error);
    return { success: false, error: 'Failed to list payment providers' };
  }
}

export async function getPaymentProvider(id: number): Promise<PaymentProviderResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_providers_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment provider not found' };
    }

    const row = result[0];
    const provider: PaymentProvider = {
      id: row.o_id,
      name: row.o_name,
      provider_type: row.o_provider_type as any,
      is_sandbox: row.o_is_sandbox,
      merchant_id: row.o_merchant_id,
      environment_url: row.o_environment_url,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, provider };
  } catch (error) {
    console.error('Get payment provider error:', error);
    return { success: false, error: 'Failed to get payment provider' };
  }
}

export async function createPaymentProvider(
  input: CreatePaymentProviderInput
): Promise<PaymentProviderResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');

    const result = await invokeProcWrite('sp_payment_providers_insert', {
      i_name: input.name,
      i_provider_type: input.provider_type,
      i_is_sandbox: input.is_sandbox !== undefined ? input.is_sandbox : true,
      i_api_login_id_secret_id: input.api_login_id_secret_id || null,
      i_api_transaction_key_secret_id: input.api_transaction_key_secret_id || null,
      i_api_key_secret_id: input.api_key_secret_id || null,
      i_api_secret_secret_id: input.api_secret_secret_id || null,
      i_merchant_id: input.merchant_id || null,
      i_environment_url: input.environment_url || null,
      i_description: input.description || null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create payment provider' };
    }

    const row = result[0];
    const provider: PaymentProvider = {
      id: row.o_id,
      name: row.o_name,
      provider_type: input.provider_type,
      is_sandbox: input.is_sandbox !== undefined ? input.is_sandbox : true,
      merchant_id: input.merchant_id || null,
      environment_url: input.environment_url || null,
      description: input.description || null,
      is_active: true,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    await logAudit({
      action: 'payment_provider.create',
      target: `payment-provider:${provider.id}`,
      status: 'success',
      details: { name: input.name, type: input.provider_type, sandbox: input.is_sandbox },
    });

    return { success: true, provider };
  } catch (error) {
    console.error('Create payment provider error:', error);
    return { success: false, error: 'Failed to create payment provider' };
  }
}

export async function updatePaymentProvider(
  input: UpdatePaymentProviderInput
): Promise<PaymentProviderResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');

    const result = await invokeProcWrite('sp_payment_providers_update', {
      i_id: input.id,
      i_name: input.name || null,
      i_is_sandbox: input.is_sandbox !== undefined ? input.is_sandbox : null,
      i_api_login_id_secret_id: input.api_login_id_secret_id || null,
      i_api_transaction_key_secret_id: input.api_transaction_key_secret_id || null,
      i_api_key_secret_id: input.api_key_secret_id || null,
      i_api_secret_secret_id: input.api_secret_secret_id || null,
      i_merchant_id: input.merchant_id || null,
      i_environment_url: input.environment_url || null,
      i_description: input.description || null,
      i_is_active: input.is_active !== undefined ? input.is_active : null,
      i_updated_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment provider not found' };
    }

    const row = result[0];
    const provider: PaymentProvider = {
      id: row.o_id,
      name: row.o_name,
      provider_type: row.o_provider_type as any,
      is_sandbox: row.o_is_sandbox,
      merchant_id: row.o_merchant_id,
      environment_url: row.o_environment_url,
      description: row.o_description,
      is_active: true,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    await logAudit({
      action: 'payment_provider.update',
      target: `payment-provider:${provider.id}`,
      status: 'success',
      details: { id: input.id },
    });

    return { success: true, provider };
  } catch (error) {
    console.error('Update payment provider error:', error);
    return { success: false, error: 'Failed to update payment provider' };
  }
}
