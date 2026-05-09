'use server';

import { cookies } from 'next/headers';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability, requireOperator } from '@qa-platform/auth';
import { encryptSecret, decryptSecret, withUnlocked } from '@qa-platform/vault';
import { logAudit } from './audit';

export interface Credential {
  id: number;
  site_id: number;
  site_environment_id: number;
  role_name: string;
  secret_id: number;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface CredentialWithValue extends Credential {
  credential_value: string;
  name: string;
  description: string | null;
}

export interface CreateCredentialInput {
  site_id: number;
  site_environment_id: number;
  role_name: string;
  credential_value: string;
  name: string;
  description?: string;
  is_session_only?: boolean;
}

export interface UpdateCredentialInput {
  id: number;
  credential_value?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface CredentialResult {
  success: boolean;
  credential?: Credential;
  error?: string;
}

export interface CredentialsListResult {
  success: boolean;
  credentials?: Credential[];
  error?: string;
}

export interface CredentialWithValueResult {
  success: boolean;
  credential?: CredentialWithValue;
  error?: string;
}

async function getUnlockToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('unlock_token')?.value || null;
}

export async function listCredentials(
  siteId?: number,
  siteEnvironmentId?: number
): Promise<CredentialsListResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_site_credentials_list', {
      i_site_id: siteId ?? null,
      i_site_environment_id: siteEnvironmentId ?? null,
    });

    const credentials: Credential[] = result.map((row: {
      o_id: number;
      o_site_id: number | null;
      o_site_environment_id: number | null;
      o_role_name: string;
      o_secret_id: number;
      o_is_active: boolean;
      o_created_date: string;
      o_updated_date: string;
    }) => ({
      id: row.o_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      role_name: row.o_role_name,
      secret_id: row.o_secret_id,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    }));

    return { success: true, credentials };
  } catch (error) {
    console.error('List credentials error:', error);
    return { success: false, error: 'Failed to list credentials' };
  }
}

export async function getCredential(id: number): Promise<CredentialResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_site_credentials_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Credential not found' };
    }

    const row = result[0];
    const credential: Credential = {
      id: row.o_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      role_name: row.o_role_name,
      secret_id: row.o_secret_id,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, credential };
  } catch (error) {
    console.error('Get credential error:', error);
    return { success: false, error: 'Failed to get credential' };
  }
}

export async function getCredentialWithValue(
  id: number
): Promise<CredentialWithValueResult> {
  try {
    const authContext = await requireCapability('secret.reveal');
    const unlockToken = await getUnlockToken();

    if (!unlockToken) {
      return { success: false, error: 'Vault is locked. Please unlock first.' };
    }

    // Get credential metadata
    const credResult = await invokeProc('sp_site_credentials_get_by_id', {
      i_id: id,
    });

    if (credResult.length === 0) {
      return { success: false, error: 'Credential not found' };
    }

    const credRow = credResult[0];

    // Get secret record
    const secretResult = await invokeProc('sp_secret_records_get_by_id', {
      i_id: credRow.o_secret_id,
    });

    if (secretResult.length === 0) {
      return { success: false, error: 'Secret not found' };
    }

    const secretRow = secretResult[0];

    // Decrypt secret value — wrap_nonce is required for envelope decryption
    if (!secretRow.o_wrap_nonce) {
      return { success: false, error: 'Secret record is missing wrap_nonce (corrupt or pre-envelope format)' };
    }

    const plaintext = await decryptSecret(
      unlockToken,
      secretRow.o_encrypted_payload,
      secretRow.o_nonce,
      secretRow.o_wrapped_dek,
      secretRow.o_wrap_nonce,
    );

    const credentialValue = plaintext.toString('utf8');

    // Log access
    await logAudit({
      action: 'secret.reveal',
      target: `credential:${id}`,
      status: 'success',
      details: { secret_id: credRow.o_secret_id },
    });

    const credential: CredentialWithValue = {
      id: credRow.o_id,
      site_id: credRow.o_site_id,
      site_environment_id: credRow.o_site_environment_id,
      role_name: credRow.o_role_name,
      secret_id: credRow.o_secret_id,
      is_active: credRow.o_is_active,
      created_date: credRow.o_created_date,
      updated_date: credRow.o_updated_date,
      credential_value: credentialValue,
      name: secretRow.o_name,
      description: secretRow.o_description,
    };

    return { success: true, credential };
  } catch (error) {
    console.error('Get credential with value error:', error);
    return { success: false, error: 'Failed to reveal credential' };
  }
}

export async function createCredential(
  input: CreateCredentialInput
): Promise<CredentialResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');
    const unlockToken = await getUnlockToken();

    if (!unlockToken) {
      return { success: false, error: 'Vault is locked. Please unlock first.' };
    }

    // Encrypt the credential value
    const plaintext = Buffer.from(input.credential_value, 'utf8');
    const { encryptedPayload, nonce, wrappedDek, wrapNonce } = await encryptSecret(
      unlockToken,
      plaintext
    );

    // Create secret record (transactional)
    const secretResult = await invokeProcWrite('sp_secret_records_insert', {
      i_category: 'site_credential',
      i_owner_scope: `site:${input.site_id}`,
      i_name: input.name,
      i_description: input.description || null,
      i_encrypted_payload: encryptedPayload,
      i_nonce: nonce,
      i_wrap_nonce: wrapNonce,
      i_aad: Buffer.from('qa-platform-secret-v1', 'utf8'),
      i_wrapped_dek: wrappedDek,
      i_kdf_version: 1,
      i_is_session_only: input.is_session_only ?? false,
      i_created_by: authContext.operatorId?.toString() || 'system',
    });

    if (secretResult.length === 0) {
      return { success: false, error: 'Failed to create secret' };
    }

    const secretId = secretResult[0].o_id;

    // Create site credential reference (transactional)
    const credResult = await invokeProcWrite('sp_site_credentials_insert', {
      i_site_id: input.site_id,
      i_site_environment_id: input.site_environment_id,
      i_role_name: input.role_name,
      i_secret_id: secretId,
      i_created_by: authContext.operatorId?.toString() || 'system',
    });

    if (credResult.length === 0) {
      return { success: false, error: 'Failed to create credential' };
    }

    const row = credResult[0];
    const credential: Credential = {
      id: row.o_id,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      role_name: row.o_role_name,
      secret_id: row.o_secret_id,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    // Log creation
    await logAudit({
      action: 'site_credentials.create',
      target: `credential:${credential.id}`,
      status: 'success',
      details: { site_id: input.site_id, role_name: input.role_name },
    });

    return { success: true, credential };
  } catch (error) {
    console.error('Create credential error:', error);
    return { success: false, error: 'Failed to create credential' };
  }
}

export async function updateCredential(
  input: UpdateCredentialInput
): Promise<CredentialResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');
    const unlockToken = await getUnlockToken();

    // Get current credential to find secret_id
    const credResult = await invokeProc('sp_site_credentials_get_by_id', {
      i_id: input.id,
    });

    if (credResult.length === 0) {
      return { success: false, error: 'Credential not found' };
    }

    const secretId = credResult[0].o_secret_id;

    // If credential value provided, update secret
    if (input.credential_value && !unlockToken) {
      return { success: false, error: 'Vault must be unlocked to update credential secret value' };
    }
    if (input.credential_value && unlockToken) {
      const plaintext = Buffer.from(input.credential_value, 'utf8');
      const { encryptedPayload, nonce, wrappedDek, wrapNonce } = await encryptSecret(
        unlockToken,
        plaintext
      );

      await invokeProcWrite('sp_secret_records_update', {
        i_id: secretId,
        i_encrypted_payload: encryptedPayload,
        i_nonce: nonce,
        i_wrap_nonce: wrapNonce,
        i_aad: Buffer.from('qa-platform-secret-v1', 'utf8'),
        i_wrapped_dek: wrappedDek,
        i_updated_by: authContext.operatorId?.toString() || 'system',
      });
    }

    // Archive credential if is_active is false
    if (input.is_active === false) {
      await invokeProc('sp_secret_records_archive', {
        i_id: secretId,
        i_updated_by: authContext.operatorId?.toString() || 'system',
      });
    }

    // Log update
    await logAudit({
      action: 'site_credentials.update',
      target: `credential:${input.id}`,
      status: 'success',
    });

    return getCredential(input.id);
  } catch (error) {
    console.error('Update credential error:', error);
    return { success: false, error: 'Failed to update credential' };
  }
}

// ─── Secret records (vault-stored secrets, for use in binding dropdowns) ─────

export interface SecretRecord {
  id: number;
  name: string;
  category: string;
  owner_scope: string | null;
  description: string | null;
  is_session_only: boolean;
  is_active: boolean;
}

export async function listSecretRecords(
  ownerScope?: string
): Promise<{ success: boolean; secrets?: SecretRecord[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_secret_records_list', {
      i_owner_scope: ownerScope ?? null,
      i_category: null,
      i_is_session_only: null,
    });
    const secrets: SecretRecord[] = result.map((row: {
      o_id: number; o_name: string; o_category: string; o_owner_scope: string | null;
      o_description: string | null; o_is_session_only: boolean; o_is_active: boolean;
    }) => ({
      id: row.o_id, name: row.o_name, category: row.o_category, owner_scope: row.o_owner_scope,
      description: row.o_description, is_session_only: row.o_is_session_only, is_active: row.o_is_active,
    }));
    return { success: true, secrets };
  } catch (error) {
    console.error('List secret records error:', error);
    return { success: false, error: 'Failed to list secret records' };
  }
}
