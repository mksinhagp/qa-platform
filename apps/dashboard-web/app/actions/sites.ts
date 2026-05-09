'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required').max(255, 'Name too long'),
  base_url: z.string().url('Must be a valid URL').max(2048, 'URL too long'),
  description: z.string().max(1000, 'Description too long').optional(),
});

const siteUpdateSchema = siteSchema.extend({
  id: z.number().int().positive('Invalid site ID'),
  is_active: z.boolean(),
});

const siteEnvironmentSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  name: z.string().min(1, 'Environment name is required').max(100, 'Name too long'),
  base_url: z.string().url('Must be a valid URL').max(2048, 'URL too long'),
  description: z.string().max(1000, 'Description too long').optional(),
});

const siteEnvironmentUpdateSchema = siteEnvironmentSchema.extend({
  id: z.number().int().positive('Invalid environment ID'),
  is_active: z.boolean(),
}).omit({ site_id: true });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Site {
  id: number;
  name: string;
  base_url: string;
  description: string | null;
  is_active: boolean;
  env_count?: number;
  created_date: string;
  updated_date: string;
}

export interface SiteEnvironment {
  id: number;
  site_id: number;
  name: string;
  base_url: string;
  description: string | null;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface SiteCredentialBinding {
  id: number;
  site_id: number;
  site_environment_id: number;
  site_env_name: string;
  secret_id: number;
  secret_name: string;
  role_name: string;
  description: string | null;
  is_active: boolean;
}

// ─── Sites ───────────────────────────────────────────────────────────────────

export async function listSites(activeOnly?: boolean): Promise<{ success: boolean; sites?: Site[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_sites_list_with_counts', { i_is_active: activeOnly ?? null });
    const sites: Site[] = result.map((row: {
      o_id: number; o_name: string; o_base_url: string; o_description: string | null;
      o_is_active: boolean; o_env_count: string; o_created_date: string; o_updated_date: string;
    }) => ({
      id: row.o_id, name: row.o_name, base_url: row.o_base_url, description: row.o_description,
      is_active: row.o_is_active, env_count: parseInt(row.o_env_count, 10) || 0,
      created_date: row.o_created_date, updated_date: row.o_updated_date,
    }));
    return { success: true, sites };
  } catch (error) {
    console.error('List sites error:', error);
    return { success: false, error: 'Failed to list sites' };
  }
}

export async function getSite(id: number): Promise<{ success: boolean; site?: Site; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_sites_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Site not found' };
    const row = result[0];
    return {
      success: true,
      site: {
        id: row.o_id, name: row.o_name, base_url: row.o_base_url, description: row.o_description,
        is_active: row.o_is_active, created_date: row.o_created_date, updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    console.error('Get site error:', error);
    return { success: false, error: 'Failed to get site' };
  }
}

export async function createSite(data: {
  name: string;
  base_url: string;
  description?: string;
}): Promise<{ success: boolean; site?: Site; error?: string }> {
  try {
    // Validate input
    const validation = siteSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_sites_insert', {
      i_name: validation.data.name,
      i_base_url: validation.data.base_url,
      i_description: validation.data.description ?? null,
      i_is_active: true,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return {
      success: true,
      site: {
        id: row.o_id, name: row.o_name, base_url: row.o_base_url, description: row.o_description,
        is_active: row.o_is_active, created_date: row.o_created_date, updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    console.error('Create site error:', error);
    return { success: false, error: 'Failed to create site' };
  }
}

export async function updateSite(data: {
  id: number;
  name: string;
  base_url: string;
  description?: string;
  is_active: boolean;
}): Promise<{ success: boolean; site?: Site; error?: string }> {
  try {
    // Validate input
    const validation = siteUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_sites_update', {
      i_id: validation.data.id,
      i_name: validation.data.name,
      i_base_url: validation.data.base_url,
      i_description: validation.data.description ?? null,
      i_is_active: validation.data.is_active,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Site not found' };
    const row = result[0];
    return {
      success: true,
      site: {
        id: row.o_id, name: row.o_name, base_url: row.o_base_url, description: row.o_description,
        is_active: row.o_is_active, created_date: row.o_created_date, updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    console.error('Update site error:', error);
    return { success: false, error: 'Failed to update site' };
  }
}

// ─── Site Environments ───────────────────────────────────────────────────────

export async function listSiteEnvironments(
  siteId?: number,
  activeOnly?: boolean
): Promise<{ success: boolean; environments?: SiteEnvironment[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_site_environments_list', {
      i_site_id: siteId ?? null,
      i_is_active: activeOnly ?? null,
    });
    const environments: SiteEnvironment[] = result.map((row: {
      o_id: number; o_site_id: number; o_name: string; o_base_url: string;
      o_description: string | null; o_is_active: boolean; o_created_date: string; o_updated_date: string;
    }) => ({
      id: row.o_id, site_id: row.o_site_id, name: row.o_name, base_url: row.o_base_url,
      description: row.o_description, is_active: row.o_is_active,
      created_date: row.o_created_date, updated_date: row.o_updated_date,
    }));
    return { success: true, environments };
  } catch (error) {
    console.error('List site environments error:', error);
    return { success: false, error: 'Failed to list site environments' };
  }
}

export async function getSiteEnvironment(id: number): Promise<{ success: boolean; environment?: SiteEnvironment; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_site_environments_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Environment not found' };
    const row = result[0];
    return {
      success: true,
      environment: {
        id: row.o_id, site_id: row.o_site_id, name: row.o_name, base_url: row.o_base_url,
        description: row.o_description, is_active: row.o_is_active,
        created_date: row.o_created_date, updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    console.error('Get site environment error:', error);
    return { success: false, error: 'Failed to get site environment' };
  }
}

export async function createSiteEnvironment(data: {
  site_id: number;
  name: string;
  base_url: string;
  description?: string;
}): Promise<{ success: boolean; environment?: SiteEnvironment; error?: string }> {
  try {
    // Validate input
    const validation = siteEnvironmentSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_environments_insert', {
      i_site_id: validation.data.site_id,
      i_name: validation.data.name,
      i_base_url: validation.data.base_url,
      i_description: validation.data.description ?? null,
      i_is_active: true,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return {
      success: true,
      environment: {
        id: row.o_id, site_id: row.o_site_id, name: row.o_name, base_url: row.o_base_url,
        description: row.o_description, is_active: row.o_is_active,
        created_date: row.o_created_date, updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'An environment with that name already exists for this site' };
    }
    console.error('Create site environment error:', error);
    return { success: false, error: 'Failed to create site environment' };
  }
}

export async function updateSiteEnvironment(data: {
  id: number;
  name: string;
  base_url: string;
  description?: string;
  is_active: boolean;
}): Promise<{ success: boolean; environment?: SiteEnvironment; error?: string }> {
  try {
    // Validate input
    const validation = siteEnvironmentUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_environments_update', {
      i_id: validation.data.id,
      i_name: validation.data.name,
      i_base_url: validation.data.base_url,
      i_description: validation.data.description ?? null,
      i_is_active: validation.data.is_active,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Environment not found' };
    const row = result[0];
    return {
      success: true,
      environment: {
        id: row.o_id, site_id: row.o_site_id, name: row.o_name, base_url: row.o_base_url,
        description: row.o_description, is_active: row.o_is_active,
        created_date: row.o_created_date, updated_date: row.o_updated_date,
      },
    };
  } catch (error) {
    console.error('Update site environment error:', error);
    return { success: false, error: 'Failed to update site environment' };
  }
}

export async function deleteSiteEnvironment(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_environments_delete', {
      i_id: id,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length || !result[0].o_deleted_id) {
      return { success: false, error: 'Environment not found' };
    }
    return { success: true };
  } catch (error) {
    console.error('Delete site environment error:', error);
    return { success: false, error: 'Failed to delete site environment' };
  }
}

// ─── Credential Bindings ─────────────────────────────────────────────────────

export async function listSiteCredentialBindings(
  siteId: number,
  envId?: number
): Promise<{ success: boolean; bindings?: SiteCredentialBinding[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_site_credentials_list_enriched', {
      i_site_id: siteId,
      i_site_environment_id: envId ?? null,
    });
    const bindings: SiteCredentialBinding[] = result.map((row: {
      o_id: number; o_site_id: number; o_site_environment_id: number; o_site_env_name: string;
      o_secret_id: number; o_secret_name: string; o_role_name: string;
      o_description: string | null; o_is_active: boolean;
    }) => ({
      id: row.o_id, site_id: row.o_site_id, site_environment_id: row.o_site_environment_id,
      site_env_name: row.o_site_env_name, secret_id: row.o_secret_id, secret_name: row.o_secret_name,
      role_name: row.o_role_name, description: row.o_description, is_active: row.o_is_active,
    }));
    return { success: true, bindings };
  } catch (error) {
    console.error('List credential bindings error:', error);
    return { success: false, error: 'Failed to list credential bindings' };
  }
}

export async function createSiteCredentialBinding(data: {
  site_id: number;
  site_environment_id: number;
  secret_id: number;
  role_name: string;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authContext = await requireOperator();
    await invokeProcWrite('sp_site_credentials_insert', {
      i_site_id: data.site_id,
      i_site_environment_id: data.site_environment_id,
      i_role_name: data.role_name,
      i_secret_id: data.secret_id,
      i_description: data.description ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'A credential binding with that role already exists for this environment' };
    }
    console.error('Create credential binding error:', error);
    return { success: false, error: 'Failed to create credential binding' };
  }
}

export async function deleteSiteCredentialBinding(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await requireOperator();
    await invokeProcWrite('sp_site_credentials_delete', { i_id: id });
    return { success: true };
  } catch (error) {
    console.error('Delete credential binding error:', error);
    return { success: false, error: 'Failed to delete credential binding' };
  }
}

// ─── Payment Profile Bindings ─────────────────────────────────────────────────

export interface PaymentProfileBinding {
  id: number;
  site_id: number;
  site_environment_id: number;
  site_env_name: string;
  payment_profile_id: number;
  payment_profile_name: string;
  payment_type: string;
  last_4: string | null;
  role_tag: string;
  description: string | null;
  is_active: boolean;
}

export async function listPaymentProfileBindings(
  siteId: number,
  envId?: number
): Promise<{ success: boolean; bindings?: PaymentProfileBinding[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_site_env_payment_bindings_list', {
      i_site_id: siteId,
      i_site_environment_id: envId ?? null,
    });
    const bindings: PaymentProfileBinding[] = result.map((row: {
      o_id: number; o_site_id: number; o_site_environment_id: number; o_site_env_name: string;
      o_payment_profile_id: number; o_payment_profile_name: string; o_payment_type: string;
      o_last_4: string | null; o_role_tag: string; o_description: string | null; o_is_active: boolean;
    }) => ({
      id: row.o_id, site_id: row.o_site_id, site_environment_id: row.o_site_environment_id,
      site_env_name: row.o_site_env_name, payment_profile_id: row.o_payment_profile_id,
      payment_profile_name: row.o_payment_profile_name, payment_type: row.o_payment_type,
      last_4: row.o_last_4, role_tag: row.o_role_tag, description: row.o_description,
      is_active: row.o_is_active,
    }));
    return { success: true, bindings };
  } catch (error) {
    console.error('List payment profile bindings error:', error);
    return { success: false, error: 'Failed to list payment profile bindings' };
  }
}

export async function createPaymentProfileBinding(data: {
  site_id: number;
  site_environment_id: number;
  payment_profile_id: number;
  role_tag: string;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authContext = await requireOperator();
    await invokeProcWrite('sp_site_env_payment_bindings_insert', {
      i_site_id: data.site_id,
      i_site_environment_id: data.site_environment_id,
      i_payment_profile_id: data.payment_profile_id,
      i_role_tag: data.role_tag,
      i_description: data.description ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'A payment profile binding with that role already exists for this environment' };
    }
    console.error('Create payment profile binding error:', error);
    return { success: false, error: 'Failed to create payment profile binding' };
  }
}

export async function deletePaymentProfileBinding(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await requireOperator();
    await invokeProcWrite('sp_site_env_payment_bindings_delete', { i_id: id });
    return { success: true };
  } catch (error) {
    console.error('Delete payment profile binding error:', error);
    return { success: false, error: 'Failed to delete payment profile binding' };
  }
}

// ─── Email Inbox Bindings ─────────────────────────────────────────────────────

export interface EmailInboxBinding {
  id: number;
  site_id: number;
  site_environment_id: number;
  site_env_name: string;
  email_inbox_id: number;
  email_inbox_name: string;
  provider: string;
  username: string;
  role_tag: string;
  description: string | null;
  is_active: boolean;
}

export async function listEmailInboxBindings(
  siteId: number,
  envId?: number
): Promise<{ success: boolean; bindings?: EmailInboxBinding[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_site_env_email_bindings_list', {
      i_site_id: siteId,
      i_site_environment_id: envId ?? null,
    });
    const bindings: EmailInboxBinding[] = result.map((row: {
      o_id: number; o_site_id: number; o_site_environment_id: number; o_site_env_name: string;
      o_email_inbox_id: number; o_email_inbox_name: string; o_provider: string; o_username: string;
      o_role_tag: string; o_description: string | null; o_is_active: boolean;
    }) => ({
      id: row.o_id, site_id: row.o_site_id, site_environment_id: row.o_site_environment_id,
      site_env_name: row.o_site_env_name, email_inbox_id: row.o_email_inbox_id,
      email_inbox_name: row.o_email_inbox_name, provider: row.o_provider, username: row.o_username,
      role_tag: row.o_role_tag, description: row.o_description, is_active: row.o_is_active,
    }));
    return { success: true, bindings };
  } catch (error) {
    console.error('List email inbox bindings error:', error);
    return { success: false, error: 'Failed to list email inbox bindings' };
  }
}

export async function createEmailInboxBinding(data: {
  site_id: number;
  site_environment_id: number;
  email_inbox_id: number;
  role_tag: string;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authContext = await requireOperator();
    await invokeProcWrite('sp_site_env_email_bindings_insert', {
      i_site_id: data.site_id,
      i_site_environment_id: data.site_environment_id,
      i_email_inbox_id: data.email_inbox_id,
      i_role_tag: data.role_tag,
      i_description: data.description ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'An email inbox binding with that role already exists for this environment' };
    }
    console.error('Create email inbox binding error:', error);
    return { success: false, error: 'Failed to create email inbox binding' };
  }
}

export async function deleteEmailInboxBinding(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await requireOperator();
    await invokeProcWrite('sp_site_env_email_bindings_delete', { i_id: id });
    return { success: true };
  } catch (error) {
    console.error('Delete email inbox binding error:', error);
    return { success: false, error: 'Failed to delete email inbox binding' };
  }
}
