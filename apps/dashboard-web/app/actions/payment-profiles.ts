'use server';

import { cookies } from 'next/headers';
import { invokeProc } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { encryptSecret } from '@qa-platform/vault';
import { logAudit } from './audit';

export interface PaymentProfile {
  id: number;
  name: string;
  payment_type: 'card' | 'ach';
  last_4: string | null;
  card_brand: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  description: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface PaymentProfileWithSecret extends PaymentProfile {
  secret_id: number;
}

export interface CreatePaymentProfileInput {
  name: string;
  payment_type: 'card' | 'ach';
  last_4?: string;
  card_brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  account_number?: string;
  routing_number?: string;
  description?: string;
}

export interface UpdatePaymentProfileInput {
  id: number;
  name?: string;
  last_4?: string;
  card_brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  description?: string;
  is_active?: boolean;
}

export interface PaymentProfileResult {
  success: boolean;
  profile?: PaymentProfile;
  error?: string;
}

export interface PaymentProfilesListResult {
  success: boolean;
  profiles?: PaymentProfile[];
  error?: string;
}

async function getUnlockToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('unlock_token')?.value || null;
}

export async function listPaymentProfiles(
  paymentType?: 'card' | 'ach'
): Promise<PaymentProfilesListResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_profiles_list', {
      i_payment_type: paymentType || null,
    });

    const profiles: PaymentProfile[] = result.map((row: {
      o_id: number;
      o_name: string;
      o_payment_type: 'card' | 'ach';
      o_last_4: string | null;
      o_card_brand: string | null;
      o_description: string | null;
      o_is_active: boolean;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      payment_type: row.o_payment_type,
      last_4: row.o_last_4,
      card_brand: row.o_card_brand,
      expiry_month: null,
      expiry_year: null,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: '',
      updated_date: '',
    }));

    return { success: true, profiles };
  } catch (error) {
    console.error('List payment profiles error:', error);
    return { success: false, error: 'Failed to list payment profiles' };
  }
}

export async function getPaymentProfile(id: number): Promise<PaymentProfileResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_profiles_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment profile not found' };
    }

    const row = result[0];
    const profile: PaymentProfileWithSecret = {
      id: row.o_id,
      name: row.o_name,
      payment_type: row.o_payment_type,
      last_4: row.o_last_4,
      card_brand: row.o_card_brand,
      expiry_month: row.o_expiry_month,
      expiry_year: row.o_expiry_year,
      secret_id: row.o_secret_id,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, profile };
  } catch (error) {
    console.error('Get payment profile error:', error);
    return { success: false, error: 'Failed to get payment profile' };
  }
}

export async function createPaymentProfile(
  input: CreatePaymentProfileInput
): Promise<PaymentProfileResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');
    const unlockToken = await getUnlockToken();

    if (!unlockToken) {
      return { success: false, error: 'Vault is locked. Please unlock first.' };
    }

    // Build the secret payload based on payment type
    let secretPayload: Record<string, string>;
    if (input.payment_type === 'card') {
      secretPayload = {
        card_number: input.account_number || '',
      };
    } else {
      secretPayload = {
        account_number: input.account_number || '',
        routing_number: input.routing_number || '',
      };
    }

    // Encrypt the secret
    const plaintext = Buffer.from(JSON.stringify(secretPayload), 'utf8');
    const { encryptedPayload, nonce, wrappedDek } = await encryptSecret(
      unlockToken,
      plaintext
    );

    // Create secret record
    const secretResult = await invokeProc('sp_secret_records_insert', {
      i_category: 'payment_profile',
      i_owner_scope: 'global:payment-profiles',
      i_name: input.name,
      i_description: input.description || null,
      i_encrypted_payload: encryptedPayload,
      i_nonce: nonce,
      i_aad: Buffer.from('qa-platform-secret-v1', 'utf8'),
      i_wrapped_dek: wrappedDek,
      i_kdf_version: 1,
      i_is_session_only: false,
      i_created_by: authContext.operatorId?.toString() || 'system',
    });

    if (secretResult.length === 0) {
      return { success: false, error: 'Failed to create secret' };
    }

    const secretId = secretResult[0].o_id;

    // Create payment profile
    const profileResult = await invokeProc('sp_payment_profiles_insert', {
      i_name: input.name,
      i_payment_type: input.payment_type,
      i_last_4: input.last_4 || null,
      i_card_brand: input.card_brand || null,
      i_expiry_month: input.expiry_month || null,
      i_expiry_year: input.expiry_year || null,
      i_secret_id: secretId,
      i_description: input.description || null,
      i_created_by: authContext.operatorId?.toString() || 'system',
    });

    if (profileResult.length === 0) {
      return { success: false, error: 'Failed to create payment profile' };
    }

    const row = profileResult[0];
    const profile: PaymentProfile = {
      id: row.o_id,
      name: row.o_name,
      payment_type: row.o_payment_type,
      last_4: row.o_last_4,
      card_brand: null,
      expiry_month: input.expiry_month || null,
      expiry_year: input.expiry_year || null,
      description: input.description || null,
      is_active: true,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    await logAudit({
      action: 'payment_profile.create',
      target: `payment-profile:${profile.id}`,
      status: 'success',
      details: { name: input.name, type: input.payment_type },
    });

    return { success: true, profile };
  } catch (error) {
    console.error('Create payment profile error:', error);
    return { success: false, error: 'Failed to create payment profile' };
  }
}

export async function updatePaymentProfile(
  input: UpdatePaymentProfileInput
): Promise<PaymentProfileResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_payment_profiles_update', {
      i_id: input.id,
      i_name: input.name || null,
      i_last_4: input.last_4 || null,
      i_card_brand: input.card_brand || null,
      i_expiry_month: input.expiry_month || null,
      i_expiry_year: input.expiry_year || null,
      i_description: input.description || null,
      i_is_active: input.is_active !== undefined ? input.is_active : null,
      i_updated_by: authContext.operatorId?.toString() || 'system',
    });

    if (result.length === 0) {
      return { success: false, error: 'Payment profile not found' };
    }

    const row = result[0];
    const profile: PaymentProfile = {
      id: row.o_id,
      name: row.o_name,
      payment_type: row.o_payment_type,
      last_4: row.o_last_4,
      card_brand: null,
      expiry_month: input.expiry_month || null,
      expiry_year: input.expiry_year || null,
      description: input.description || null,
      is_active: row.o_is_active,
      created_date: '',
      updated_date: row.o_updated_date,
    };

    await logAudit({
      action: 'payment_profile.update',
      target: `payment-profile:${input.id}`,
      status: 'success',
    });

    return { success: true, profile };
  } catch (error) {
    console.error('Update payment profile error:', error);
    return { success: false, error: 'Failed to update payment profile' };
  }
}
