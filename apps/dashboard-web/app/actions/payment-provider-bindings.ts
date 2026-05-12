'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { logAudit } from './audit';

export interface PaymentProviderBinding {
  id: number;
  site_id: number;
  site_environment_id: number;
  payment_provider_id: number;
  payment_provider_name: string;
  payment_provider_type: string;
  is_default: boolean;
  description: string | null;
  is_active: boolean;
  created_date: string;
}

export interface CreatePaymentProviderBindingInput {
  site_id: number;
  site_environment_id: number;
  payment_provider_id: number;
  is_default?: boolean;
  description?: string;
}

export interface PaymentProviderBindingResult {
  success: boolean;
  binding?: PaymentProviderBinding;
  error?: string;
}

export interface PaymentProviderBindingsListResult {
  success: boolean;
  bindings?: PaymentProviderBinding[];
  error?: string;
}

export async function listPaymentProviderBindings(
  siteId?: number,
  siteEnvironmentId?: number,
  paymentProviderId?: number,
  isActive?: boolean
): Promise<PaymentProviderBindingsListResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_provider_bindings_list', {
      i_site_id: siteId || null,
      i_site_environment_id: siteEnvironmentId || null,
      i_payment_provider_id: paymentProviderId || null,
      i_is_active: isActive !== undefined ? isActive : null,
    });

    const bindings: PaymentProviderBinding[] = result.map((row: {
      o_id: number;
      o_site_id: number;
      o_site_environment_id: number;
      o_payment_provider_id: number;
      o_payment_provider_name: string;
      o_payment_provider_type: string;
      o_is_default: boolean;
      o_description: string | null;
      o_is_active: boolean;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      payment_provider_id: row.o_payment_provider_id,
      payment_provider_name: row.o_payment_provider_name,
      payment_provider_type: row.o_payment_provider_type,
      is_default: row.o_is_default,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
    }));

    return { success: true, bindings };
  } catch (error) {
    console.error('List payment provider bindings error:', error);
    return { success: false, error: 'Failed to list payment provider bindings' };
  }
}

export async function resolvePaymentProvider(
  siteId: number,
  siteEnvironmentId: number
): Promise<PaymentProviderBindingResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_provider_bindings_resolve', {
      i_site_id: siteId,
      i_site_environment_id: siteEnvironmentId,
    });

    if (result.length === 0) {
      return { success: false, error: 'No payment provider binding found' };
    }

    const row = result[0];
    const binding: PaymentProviderBinding = {
      id: 0,
      site_id: siteId,
      site_environment_id: siteEnvironmentId,
      payment_provider_id: row.o_payment_provider_id,
      payment_provider_name: row.o_payment_provider_name,
      payment_provider_type: row.o_payment_provider_type,
      is_default: true,
      description: null,
      is_active: true,
      created_date: new Date().toISOString(),
    };

    return { success: true, binding };
  } catch (error) {
    console.error('Resolve payment provider error:', error);
    return { success: false, error: 'Failed to resolve payment provider' };
  }
}

export async function createPaymentProviderBinding(
  input: CreatePaymentProviderBindingInput
): Promise<PaymentProviderBindingResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');

    const result = await invokeProcWrite('sp_payment_provider_bindings_insert', {
      i_site_id: input.site_id,
      i_site_environment_id: input.site_environment_id,
      i_payment_provider_id: input.payment_provider_id,
      i_is_default: input.is_default !== undefined ? input.is_default : false,
      i_description: input.description || null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create payment provider binding' };
    }

    const row = result[0];
    const binding: PaymentProviderBinding = {
      id: row.o_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      payment_provider_id: row.o_payment_provider_id,
      payment_provider_name: '',
      payment_provider_type: '',
      is_default: input.is_default !== undefined ? input.is_default : false,
      description: input.description || null,
      is_active: true,
      created_date: row.o_created_date,
    };

    await logAudit({
      action: 'payment_provider_binding.create',
      target: `payment-provider-binding:${binding.id}`,
      status: 'success',
      details: { site_id: input.site_id, environment_id: input.site_environment_id, provider_id: input.payment_provider_id },
    });

    return { success: true, binding };
  } catch (error) {
    console.error('Create payment provider binding error:', error);
    return { success: false, error: 'Failed to create payment provider binding' };
  }
}
