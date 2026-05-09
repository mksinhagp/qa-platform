'use server';

import { cookies } from 'next/headers';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { encryptSecret } from '@qa-platform/vault';
import { logAudit } from './audit';

export interface EmailInbox {
  id: number;
  name: string;
  provider: string;
  host: string;
  port: number;
  use_tls: boolean;
  username: string;
  description: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface EmailInboxWithSecret extends EmailInbox {
  secret_id: number;
}

export interface CreateEmailInboxInput {
  name: string;
  provider: 'imap' | 'gmail' | 'microsoft' | 'custom';
  host: string;
  port: number;
  use_tls?: boolean;
  username: string;
  password: string;
  description?: string;
}

export interface UpdateEmailInboxInput {
  id: number;
  name?: string;
  host?: string;
  port?: number;
  use_tls?: boolean;
  username?: string;
  password?: string;
  description?: string;
  is_active?: boolean;
}

export interface EmailInboxResult {
  success: boolean;
  inbox?: EmailInbox;
  error?: string;
}

export interface EmailInboxesListResult {
  success: boolean;
  inboxes?: EmailInbox[];
  error?: string;
}

async function getUnlockToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('unlock_token')?.value || null;
}

export async function listEmailInboxes(
  provider?: string
): Promise<EmailInboxesListResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_email_inboxes_list', {
      i_provider: provider || null,
    });

    const inboxes: EmailInbox[] = result.map((row: {
      o_id: number;
      o_name: string;
      o_provider: string;
      o_host: string;
      o_port: number;
      o_use_tls: boolean;
      o_username: string;
      o_description: string | null;
      o_is_active: boolean;
      o_created_date: string;
      o_updated_date: string;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      provider: row.o_provider,
      host: row.o_host,
      port: row.o_port,
      use_tls: row.o_use_tls ?? true,
      username: row.o_username,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date ?? '',
      updated_date: row.o_updated_date ?? '',
    }));

    return { success: true, inboxes };
  } catch (error) {
    console.error('List email inboxes error:', error);
    return { success: false, error: 'Failed to list email inboxes' };
  }
}

export async function getEmailInbox(id: number): Promise<EmailInboxResult> {
  try {
    await requireCapability('site_credentials.manage');

    const result = await invokeProc('sp_email_inboxes_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Email inbox not found' };
    }

    const row = result[0];
    const inbox: EmailInboxWithSecret = {
      id: row.o_id,
      name: row.o_name,
      provider: row.o_provider,
      host: row.o_host,
      port: row.o_port,
      use_tls: row.o_use_tls,
      username: row.o_username,
      secret_id: row.o_secret_id,
      description: row.o_description,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, inbox };
  } catch (error) {
    console.error('Get email inbox error:', error);
    return { success: false, error: 'Failed to get email inbox' };
  }
}

export async function createEmailInbox(
  input: CreateEmailInboxInput
): Promise<EmailInboxResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');
    const unlockToken = await getUnlockToken();

    if (!unlockToken) {
      return { success: false, error: 'Vault is locked. Please unlock first.' };
    }

    // Encrypt the password
    const plaintext = Buffer.from(input.password, 'utf8');
    const { encryptedPayload, nonce, wrappedDek, wrapNonce } = await encryptSecret(
      unlockToken,
      plaintext
    );

    

    // Create secret record
    const secretResult = await invokeProcWrite('sp_secret_records_insert', {
      i_category: 'email_password',
      i_owner_scope: 'global:email-inboxes',
      i_name: `${input.name} - Password`,
      i_description: `Password for ${input.username}`,
      i_encrypted_payload: encryptedPayload,
      i_nonce: nonce,
      i_wrap_nonce: wrapNonce,
      i_aad: 'qa-platform-secret-v1',
      i_wrapped_dek: wrappedDek,
      i_kdf_version: 1,
      i_is_session_only: false,
      i_created_by: authContext.operatorId?.toString() || 'system',
    });

    if (secretResult.length === 0) {
      return { success: false, error: 'Failed to create secret' };
    }

    const secretId = secretResult[0].o_id;

    // Create email inbox
    const inboxResult = await invokeProcWrite('sp_email_inboxes_insert', {
      i_name: input.name,
      i_provider: input.provider,
      i_host: input.host,
      i_port: input.port,
      i_use_tls: input.use_tls ?? true,
      i_username: input.username,
      i_secret_id: secretId,
      i_description: input.description || null,
      i_created_by: authContext.operatorId?.toString() || 'system',
    });

    if (inboxResult.length === 0) {
      return { success: false, error: 'Failed to create email inbox' };
    }

    const row = inboxResult[0];
    const inbox: EmailInbox = {
      id: row.o_id,
      name: row.o_name,
      provider: row.o_provider,
      host: row.o_host,
      port: row.o_port,
      use_tls: input.use_tls ?? true,
      username: input.username,
      description: input.description || null,
      is_active: true,
      created_date: row.o_created_date,
      updated_date: row.o_created_date,
    };

    await logAudit({
      action: 'email_inbox.create',
      target: `email-inbox:${inbox.id}`,
      status: 'success',
      details: { provider: input.provider, username: input.username },
    });

    return { success: true, inbox };
  } catch (error) {
    console.error('Create email inbox error:', error);
    return { success: false, error: 'Failed to create email inbox' };
  }
}

export async function updateEmailInbox(
  input: UpdateEmailInboxInput
): Promise<EmailInboxResult> {
  try {
    const authContext = await requireCapability('site_credentials.manage');
    const unlockToken = await getUnlockToken();

    // Get current inbox to find secret_id
    const inboxResult = await invokeProc('sp_email_inboxes_get_by_id', {
      i_id: input.id,
    });

    if (inboxResult.length === 0) {
      return { success: false, error: 'Email inbox not found' };
    }

    const secretId = inboxResult[0].o_secret_id;

    // If password provided, update secret
    if (input.password && !unlockToken) {
      return { success: false, error: 'Vault must be unlocked to update inbox password' };
    }
    if (input.password && unlockToken) {
      const plaintext = Buffer.from(input.password, 'utf8');
      const { encryptedPayload, nonce, wrappedDek, wrapNonce } = await encryptSecret(
        unlockToken,
        plaintext
      );

      

      await invokeProcWrite('sp_secret_records_update', {
        i_id: secretId,
        i_encrypted_payload: encryptedPayload,
        i_nonce: nonce,
        i_wrap_nonce: wrapNonce,
        i_aad: 'qa-platform-secret-v1',
        i_wrapped_dek: wrappedDek,
        i_updated_by: authContext.operatorId?.toString() || 'system',
      });
    }

    // Update email inbox
    const result = await invokeProcWrite('sp_email_inboxes_update', {
      i_id: input.id,
      i_name: input.name ?? null,
      i_host: input.host ?? null,
      i_port: input.port ?? null,
      i_use_tls: input.use_tls ?? null,
      i_username: input.username ?? null,
      i_description: input.description ?? null,
      i_is_active: input.is_active !== undefined ? input.is_active : null,
      i_updated_by: authContext.operatorId?.toString() || 'system',
    });

    if (result.length === 0) {
      return { success: false, error: 'Email inbox not found' };
    }

    const row = result[0];
    const inbox: EmailInbox = {
      id: row.o_id,
      name: row.o_name,
      provider: row.o_provider,
      host: row.o_host,
      port: row.o_port,
      use_tls: input.use_tls ?? true,
      username: input.username || inboxResult[0].o_username,
      description: input.description !== undefined ? (input.description || null) : inboxResult[0].o_description,
      is_active: row.o_is_active,
      created_date: inboxResult[0].o_created_date,
      updated_date: row.o_updated_date,
    };

    await logAudit({
      action: 'email_inbox.update',
      target: `email-inbox:${input.id}`,
      status: 'success',
    });

    return { success: true, inbox };
  } catch (error) {
    console.error('Update email inbox error:', error);
    return { success: false, error: 'Failed to update email inbox' };
  }
}
