'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────
// Aligned to actual stored procedure signatures

// sp_email_providers_insert: i_name, i_provider_type, i_config_json, i_secret_id, i_is_active, i_notes, i_created_by
const emailProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').max(255, 'Name too long'),
  provider_type: z.string().min(1, 'Provider type is required').max(50, 'Provider type too long'),
  config_json: z.record(z.unknown()).optional(),
  secret_id: z.number().int().positive().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

// sp_email_providers_update: i_id, i_name, i_provider_type, i_config_json, i_secret_id, i_is_active, i_notes, i_updated_by
const emailProviderUpdateSchema = z.object({
  id: z.number().int().positive('Invalid provider ID'),
  name: z.string().min(1, 'Provider name is required').max(255, 'Name too long').optional(),
  provider_type: z.string().max(50).optional(),
  config_json: z.record(z.unknown()).optional(),
  secret_id: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

// sp_email_inbox_bindings_v2_insert: i_email_provider_id, i_inbox_address, i_site_id, i_site_environment_id,
//   i_persona_id, i_flow_key, i_role_tag, i_campaign, i_priority, i_is_active, i_notes, i_created_by
const inboxBindingV2Schema = z.object({
  email_provider_id: z.number().int().positive('Invalid email provider ID'),
  inbox_address: z.string().email('Must be a valid email address').max(255, 'Inbox address too long'),
  site_id: z.number().int().positive('Invalid site ID').optional(),
  site_environment_id: z.number().int().positive('Invalid site environment ID').optional(),
  persona_id: z.string().max(100, 'Persona ID too long').optional(),
  flow_key: z.string().max(100, 'Flow key too long').optional(),
  role_tag: z.string().max(100, 'Role tag too long').optional(),
  campaign: z.string().max(255).optional(),
  priority: z.number().int().default(0),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

// sp_email_template_assertions_insert: i_site_id, i_email_type, i_assertion_name, i_assertion_type,
//   i_expected_value, i_is_regex, i_is_required, i_sort_order, i_notes, i_created_by
const templateAssertionSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  email_type: z.string().min(1, 'Email type is required').max(50, 'Email type too long'),
  assertion_name: z.string().min(1, 'Assertion name is required').max(255, 'Assertion name too long'),
  assertion_type: z.string().min(1, 'Assertion type is required').max(50, 'Assertion type too long'),
  expected_value: z.string().optional(),
  is_regex: z.boolean().default(false),
  is_required: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  notes: z.string().max(2000).optional(),
});

// sp_email_timing_slas_insert: i_site_id, i_email_type, i_max_delivery_ms, i_warn_delivery_ms,
//   i_is_active, i_notes, i_created_by
const timingSlaSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  email_type: z.string().min(1, 'Email type is required').max(50, 'Email type too long'),
  max_delivery_ms: z.number().int().positive('Max delivery ms must be positive').default(300000),
  warn_delivery_ms: z.number().int().positive('Warn delivery ms must be positive').default(60000),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

// sp_email_timing_results_insert: i_run_execution_id, i_email_type, i_delivery_latency_ms,
//   i_sla_status, i_timeout_occurred, i_correlation_token, i_provider_type, i_error_message,
//   i_email_timing_sla_id, i_created_by
const timingResultSchema = z.object({
  run_execution_id: z.number().int().positive('Invalid run execution ID'),
  email_type: z.string().min(1, 'Email type is required').max(50),
  delivery_latency_ms: z.number().int().optional(),
  sla_status: z.string().max(50).default('unknown'),
  timeout_occurred: z.boolean().default(false),
  correlation_token: z.string().max(255).optional(),
  provider_type: z.string().max(50).optional(),
  error_message: z.string().optional(),
  email_timing_sla_id: z.number().int().positive().optional(),
});

// sp_email_correlation_configs_insert: i_site_id, i_strategy, i_email_provider_id,
//   i_base_address, i_token_pattern, i_config_json, i_is_active, i_notes, i_created_by
const correlationConfigSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  strategy: z.string().min(1, 'Strategy is required').max(50, 'Strategy too long').default('plus_addressing'),
  email_provider_id: z.number().int().positive().optional(),
  base_address: z.string().max(255, 'Base address too long').optional(),
  token_pattern: z.string().max(255).optional(),
  config_json: z.record(z.unknown()).optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────
// Aligned to actual stored procedure output columns

export interface EmailProvider {
  id: number;
  name: string;
  provider_type: string;
  is_active: boolean;
  config_json: Record<string, unknown> | null;
  secret_id: number | null;
  notes: string | null;
  created_date: string;
  updated_date: string;
}

export interface EmailInboxBindingV2 {
  id: number;
  email_provider_id: number;
  provider_name: string;
  provider_type: string;
  inbox_address: string;
  site_id: number | null;
  site_environment_id: number | null;
  persona_id: string | null;
  flow_key: string | null;
  role_tag: string | null;
  campaign: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_date: string;
}

export interface EmailTemplateAssertion {
  id: number;
  email_type: string;
  assertion_name: string;
  assertion_type: string;
  expected_value: string | null;
  is_regex: boolean;
  is_required: boolean;
  sort_order: number;
  notes: string | null;
  created_date: string;
}

export interface EmailTimingSla {
  id: number;
  email_type: string;
  max_delivery_ms: number;
  warn_delivery_ms: number;
  is_active: boolean;
  notes: string | null;
  created_date: string;
}

export interface EmailTimingResult {
  id: number;
  email_type: string;
  delivery_latency_ms: number | null;
  sla_status: string;
  timeout_occurred: boolean;
  correlation_token: string | null;
  provider_type: string | null;
  error_message: string | null;
  max_delivery_ms: number | null;
  warn_delivery_ms: number | null;
  created_date: string;
}

export interface EmailCorrelationConfig {
  id: number;
  site_id: number;
  email_provider_id: number | null;
  strategy: string;
  base_address: string | null;
  token_pattern: string | null;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  notes: string | null;
}

// ─── Row Mappers ─────────────────────────────────────────────────────────────
// Aligned to sp_email_providers_list output columns

function mapEmailProviderRow(row: Record<string, unknown>): EmailProvider {
  return {
    id: row.o_id as number,
    name: row.o_name as string,
    provider_type: row.o_provider_type as string,
    is_active: row.o_is_active as boolean,
    config_json: (row.o_config_json as Record<string, unknown>) ?? null,
    secret_id: (row.o_secret_id as number) ?? null,
    notes: (row.o_notes as string) ?? null,
    created_date: row.o_created_date as string,
    updated_date: (row.o_updated_date as string) ?? '',
  };
}

// Aligned to sp_email_inbox_bindings_v2_list output columns
function mapInboxBindingV2Row(row: Record<string, unknown>): EmailInboxBindingV2 {
  return {
    id: row.o_id as number,
    email_provider_id: row.o_email_provider_id as number,
    provider_name: row.o_provider_name as string,
    provider_type: row.o_provider_type as string,
    inbox_address: row.o_inbox_address as string,
    site_id: (row.o_site_id as number) ?? null,
    site_environment_id: (row.o_site_environment_id as number) ?? null,
    persona_id: (row.o_persona_id as string) ?? null,
    flow_key: (row.o_flow_key as string) ?? null,
    role_tag: (row.o_role_tag as string) ?? null,
    campaign: (row.o_campaign as string) ?? null,
    priority: row.o_priority as number,
    is_active: row.o_is_active as boolean,
    notes: (row.o_notes as string) ?? null,
    created_date: row.o_created_date as string,
  };
}

// ─── Email Providers ─────────────────────────────────────────────────────────

export async function listEmailProviders(
  activeOnly?: boolean
): Promise<{ success: boolean; providers?: EmailProvider[]; error?: string }> {
  try {
    await requireOperator();
    // sp_email_providers_list expects i_active_only (not i_is_active)
    const result = await invokeProc('sp_email_providers_list', {
      i_active_only: activeOnly ?? false,
    });
    const providers: EmailProvider[] = result.map(mapEmailProviderRow);
    return { success: true, providers };
  } catch (error) {
    console.error('List email providers error:', error);
    return { success: false, error: 'Failed to list email providers' };
  }
}

export async function getEmailProvider(
  id: number
): Promise<{ success: boolean; provider?: EmailProvider; error?: string }> {
  try {
    await requireOperator();
    // sp_email_providers_get_by_id returns same columns as list
    const result = await invokeProc('sp_email_providers_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Email provider not found' };
    return { success: true, provider: mapEmailProviderRow(result[0]) };
  } catch (error) {
    console.error('Get email provider error:', error);
    return { success: false, error: 'Failed to get email provider' };
  }
}

export async function createEmailProvider(data: {
  name: string;
  provider_type: string;
  config_json?: Record<string, unknown>;
  secret_id?: number;
  is_active?: boolean;
  notes?: string;
}): Promise<{ success: boolean; provider?: { id: number; name: string; provider_type: string }; error?: string }> {
  try {
    const validation = emailProviderSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_providers_insert returns: o_id, o_name, o_provider_type
    const result = await invokeProcWrite('sp_email_providers_insert', {
      i_name: validation.data.name,
      i_provider_type: validation.data.provider_type,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : '{}',
      i_secret_id: validation.data.secret_id ?? null,
      i_is_active: validation.data.is_active,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      provider: {
        id: row.o_id as number,
        name: row.o_name as string,
        provider_type: row.o_provider_type as string,
      },
    };
  } catch (error) {
    console.error('Create email provider error:', error);
    return { success: false, error: 'Failed to create email provider' };
  }
}

export async function updateEmailProvider(data: {
  id: number;
  name?: string;
  provider_type?: string;
  config_json?: Record<string, unknown>;
  secret_id?: number;
  is_active?: boolean;
  notes?: string;
}): Promise<{ success: boolean; provider?: { id: number; name: string; provider_type: string }; error?: string }> {
  try {
    const validation = emailProviderUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_providers_update returns: o_id, o_name, o_provider_type
    const result = await invokeProcWrite('sp_email_providers_update', {
      i_id: validation.data.id,
      i_name: validation.data.name ?? null,
      i_provider_type: validation.data.provider_type ?? null,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_secret_id: validation.data.secret_id ?? null,
      i_is_active: validation.data.is_active ?? null,
      i_notes: validation.data.notes ?? null,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Email provider not found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      provider: {
        id: row.o_id as number,
        name: row.o_name as string,
        provider_type: row.o_provider_type as string,
      },
    };
  } catch (error) {
    console.error('Update email provider error:', error);
    return { success: false, error: 'Failed to update email provider' };
  }
}

// ─── Inbox Bindings V2 ────────────────────────────────────────────────────────

export async function createInboxBindingV2(data: {
  email_provider_id: number;
  inbox_address: string;
  site_id?: number;
  site_environment_id?: number;
  persona_id?: string;
  flow_key?: string;
  role_tag?: string;
  campaign?: string;
  priority?: number;
  is_active?: boolean;
  notes?: string;
}): Promise<{ success: boolean; binding?: { id: number; inbox_address: string; priority: number }; error?: string }> {
  try {
    const validation = inboxBindingV2Schema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_inbox_bindings_v2_insert returns: o_id, o_inbox_address, o_priority
    const result = await invokeProcWrite('sp_email_inbox_bindings_v2_insert', {
      i_email_provider_id: validation.data.email_provider_id,
      i_inbox_address: validation.data.inbox_address,
      i_site_id: validation.data.site_id ?? null,
      i_site_environment_id: validation.data.site_environment_id ?? null,
      i_persona_id: validation.data.persona_id ?? null,
      i_flow_key: validation.data.flow_key ?? null,
      i_role_tag: validation.data.role_tag ?? null,
      i_campaign: validation.data.campaign ?? null,
      i_priority: validation.data.priority,
      i_is_active: validation.data.is_active,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      binding: {
        id: row.o_id as number,
        inbox_address: row.o_inbox_address as string,
        priority: row.o_priority as number,
      },
    };
  } catch (error) {
    console.error('Create inbox binding V2 error:', error);
    return { success: false, error: 'Failed to create inbox binding' };
  }
}

export async function listInboxBindingsV2(
  siteId?: number,
  envId?: number,
  personaId?: string,
  flowKey?: string
): Promise<{ success: boolean; bindings?: EmailInboxBindingV2[]; error?: string }> {
  try {
    await requireOperator();
    // sp_email_inbox_bindings_v2_list: i_site_id, i_site_environment_id, i_persona_id, i_flow_key
    const result = await invokeProc('sp_email_inbox_bindings_v2_list', {
      i_site_id: siteId ?? null,
      i_site_environment_id: envId ?? null,
      i_persona_id: personaId ?? null,
      i_flow_key: flowKey ?? null,
    });
    const bindings: EmailInboxBindingV2[] = result.map(mapInboxBindingV2Row);
    return { success: true, bindings };
  } catch (error) {
    console.error('List inbox bindings V2 error:', error);
    return { success: false, error: 'Failed to list inbox bindings' };
  }
}

export async function resolveInboxBinding(
  siteId: number,
  envId?: number,
  personaId?: string,
  flowKey?: string,
  roleTag?: string
): Promise<{ success: boolean; binding?: { id: number; email_provider_id: number; provider_name: string; provider_type: string; inbox_address: string; priority: number }; error?: string }> {
  try {
    await requireOperator();
    // sp_email_inbox_bindings_v2_resolve returns: o_id, o_email_provider_id, o_provider_name,
    //   o_provider_type, o_inbox_address, o_priority
    const result = await invokeProc('sp_email_inbox_bindings_v2_resolve', {
      i_site_id: siteId,
      i_site_environment_id: envId ?? null,
      i_persona_id: personaId ?? null,
      i_flow_key: flowKey ?? null,
      i_role_tag: roleTag ?? null,
    });
    if (!result.length) return { success: false, error: 'No matching inbox binding found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      binding: {
        id: row.o_id as number,
        email_provider_id: row.o_email_provider_id as number,
        provider_name: row.o_provider_name as string,
        provider_type: row.o_provider_type as string,
        inbox_address: row.o_inbox_address as string,
        priority: row.o_priority as number,
      },
    };
  } catch (error) {
    console.error('Resolve inbox binding error:', error);
    return { success: false, error: 'Failed to resolve inbox binding' };
  }
}

// ─── Template Assertions ──────────────────────────────────────────────────────

export async function createTemplateAssertion(data: {
  site_id: number;
  email_type: string;
  assertion_name: string;
  assertion_type: string;
  expected_value?: string;
  is_regex?: boolean;
  is_required?: boolean;
  sort_order?: number;
  notes?: string;
}): Promise<{ success: boolean; assertion?: { id: number; email_type: string; assertion_name: string }; error?: string }> {
  try {
    const validation = templateAssertionSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_template_assertions_insert returns: o_id, o_email_type, o_assertion_name
    const result = await invokeProcWrite('sp_email_template_assertions_insert', {
      i_site_id: validation.data.site_id,
      i_email_type: validation.data.email_type,
      i_assertion_name: validation.data.assertion_name,
      i_assertion_type: validation.data.assertion_type,
      i_expected_value: validation.data.expected_value ?? null,
      i_is_regex: validation.data.is_regex,
      i_is_required: validation.data.is_required,
      i_sort_order: validation.data.sort_order,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      assertion: {
        id: row.o_id as number,
        email_type: row.o_email_type as string,
        assertion_name: row.o_assertion_name as string,
      },
    };
  } catch (error) {
    console.error('Create template assertion error:', error);
    return { success: false, error: 'Failed to create template assertion' };
  }
}

export async function listTemplateAssertions(
  siteId: number,
  emailType?: string
): Promise<{ success: boolean; assertions?: EmailTemplateAssertion[]; error?: string }> {
  try {
    await requireOperator();
    // sp_email_template_assertions_list: i_site_id, i_email_type
    const result = await invokeProc('sp_email_template_assertions_list', {
      i_site_id: siteId,
      i_email_type: emailType ?? null,
    });
    const assertions: EmailTemplateAssertion[] = result.map((row: Record<string, unknown>) => ({
      id: row.o_id as number,
      email_type: row.o_email_type as string,
      assertion_name: row.o_assertion_name as string,
      assertion_type: row.o_assertion_type as string,
      expected_value: (row.o_expected_value as string) ?? null,
      is_regex: row.o_is_regex as boolean,
      is_required: row.o_is_required as boolean,
      sort_order: row.o_sort_order as number,
      notes: (row.o_notes as string) ?? null,
      created_date: row.o_created_date as string,
    }));
    return { success: true, assertions };
  } catch (error) {
    console.error('List template assertions error:', error);
    return { success: false, error: 'Failed to list template assertions' };
  }
}

// ─── Timing SLAs ─────────────────────────────────────────────────────────────

export async function createTimingSla(data: {
  site_id: number;
  email_type: string;
  max_delivery_ms?: number;
  warn_delivery_ms?: number;
  is_active?: boolean;
  notes?: string;
}): Promise<{ success: boolean; sla?: { id: number; email_type: string; max_delivery_ms: number }; error?: string }> {
  try {
    const validation = timingSlaSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_timing_slas_insert returns: o_id, o_email_type, o_max_delivery_ms
    const result = await invokeProcWrite('sp_email_timing_slas_insert', {
      i_site_id: validation.data.site_id,
      i_email_type: validation.data.email_type,
      i_max_delivery_ms: validation.data.max_delivery_ms,
      i_warn_delivery_ms: validation.data.warn_delivery_ms,
      i_is_active: validation.data.is_active,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      sla: {
        id: row.o_id as number,
        email_type: row.o_email_type as string,
        max_delivery_ms: row.o_max_delivery_ms as number,
      },
    };
  } catch (error) {
    console.error('Create timing SLA error:', error);
    return { success: false, error: 'Failed to create timing SLA' };
  }
}

export async function listTimingSlas(
  siteId: number
): Promise<{ success: boolean; slas?: EmailTimingSla[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_timing_slas_list', { i_site_id: siteId });
    const slas: EmailTimingSla[] = result.map((row: Record<string, unknown>) => ({
      id: row.o_id as number,
      email_type: row.o_email_type as string,
      max_delivery_ms: row.o_max_delivery_ms as number,
      warn_delivery_ms: row.o_warn_delivery_ms as number,
      is_active: row.o_is_active as boolean,
      notes: (row.o_notes as string) ?? null,
      created_date: row.o_created_date as string,
    }));
    return { success: true, slas };
  } catch (error) {
    console.error('List timing SLAs error:', error);
    return { success: false, error: 'Failed to list timing SLAs' };
  }
}

// ─── Timing Results ───────────────────────────────────────────────────────────

export async function createTimingResult(data: {
  run_execution_id: number;
  email_type: string;
  delivery_latency_ms?: number;
  sla_status?: string;
  timeout_occurred?: boolean;
  correlation_token?: string;
  provider_type?: string;
  error_message?: string;
  email_timing_sla_id?: number;
}): Promise<{ success: boolean; result?: { id: number; email_type: string; sla_status: string }; error?: string }> {
  try {
    const validation = timingResultSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_timing_results_insert returns: o_id, o_email_type, o_sla_status
    const procResult = await invokeProcWrite('sp_email_timing_results_insert', {
      i_run_execution_id: validation.data.run_execution_id,
      i_email_type: validation.data.email_type,
      i_delivery_latency_ms: validation.data.delivery_latency_ms ?? null,
      i_sla_status: validation.data.sla_status,
      i_timeout_occurred: validation.data.timeout_occurred,
      i_correlation_token: validation.data.correlation_token ?? null,
      i_provider_type: validation.data.provider_type ?? null,
      i_error_message: validation.data.error_message ?? null,
      i_email_timing_sla_id: validation.data.email_timing_sla_id ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!procResult.length) return { success: false, error: 'Insert returned no row' };
    const row = procResult[0] as Record<string, unknown>;
    return {
      success: true,
      result: {
        id: row.o_id as number,
        email_type: row.o_email_type as string,
        sla_status: row.o_sla_status as string,
      },
    };
  } catch (error) {
    console.error('Create timing result error:', error);
    return { success: false, error: 'Failed to create timing result' };
  }
}

export async function listTimingResults(
  runExecutionId: number
): Promise<{ success: boolean; results?: EmailTimingResult[]; error?: string }> {
  try {
    await requireOperator();
    // sp_email_timing_results_list expects i_run_execution_id only
    const procResult = await invokeProc('sp_email_timing_results_list', {
      i_run_execution_id: runExecutionId,
    });
    const results: EmailTimingResult[] = procResult.map((row: Record<string, unknown>) => ({
      id: row.o_id as number,
      email_type: row.o_email_type as string,
      delivery_latency_ms: (row.o_delivery_latency_ms as number) ?? null,
      sla_status: row.o_sla_status as string,
      timeout_occurred: row.o_timeout_occurred as boolean,
      correlation_token: (row.o_correlation_token as string) ?? null,
      provider_type: (row.o_provider_type as string) ?? null,
      error_message: (row.o_error_message as string) ?? null,
      max_delivery_ms: (row.o_max_delivery_ms as number) ?? null,
      warn_delivery_ms: (row.o_warn_delivery_ms as number) ?? null,
      created_date: row.o_created_date as string,
    }));
    return { success: true, results };
  } catch (error) {
    console.error('List timing results error:', error);
    return { success: false, error: 'Failed to list timing results' };
  }
}

// ─── Correlation Configs ──────────────────────────────────────────────────────

export async function createCorrelationConfig(data: {
  site_id: number;
  strategy?: string;
  email_provider_id?: number;
  base_address?: string;
  token_pattern?: string;
  config_json?: Record<string, unknown>;
  is_active?: boolean;
  notes?: string;
}): Promise<{ success: boolean; config?: { id: number; strategy: string; base_address: string | null }; error?: string }> {
  try {
    const validation = correlationConfigSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    // sp_email_correlation_configs_insert returns: o_id, o_strategy, o_base_address
    const result = await invokeProcWrite('sp_email_correlation_configs_insert', {
      i_site_id: validation.data.site_id,
      i_strategy: validation.data.strategy,
      i_email_provider_id: validation.data.email_provider_id ?? null,
      i_base_address: validation.data.base_address ?? null,
      i_token_pattern: validation.data.token_pattern ?? null,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_is_active: validation.data.is_active,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      config: {
        id: row.o_id as number,
        strategy: row.o_strategy as string,
        base_address: (row.o_base_address as string) ?? null,
      },
    };
  } catch (error) {
    console.error('Create correlation config error:', error);
    return { success: false, error: 'Failed to create correlation config' };
  }
}

export async function getCorrelationConfig(
  siteId: number,
  emailProviderId?: number
): Promise<{ success: boolean; config?: EmailCorrelationConfig; error?: string }> {
  try {
    await requireOperator();
    // sp_email_correlation_configs_get (not _list): i_site_id, i_email_provider_id
    const result = await invokeProc('sp_email_correlation_configs_get', {
      i_site_id: siteId,
      i_email_provider_id: emailProviderId ?? null,
    });
    if (!result.length) return { success: false, error: 'No correlation config found' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      config: {
        id: row.o_id as number,
        site_id: row.o_site_id as number,
        email_provider_id: (row.o_email_provider_id as number) ?? null,
        strategy: row.o_strategy as string,
        base_address: (row.o_base_address as string) ?? null,
        token_pattern: (row.o_token_pattern as string) ?? null,
        config_json: (row.o_config_json as Record<string, unknown>) ?? null,
        is_active: row.o_is_active as boolean,
        notes: (row.o_notes as string) ?? null,
      },
    };
  } catch (error) {
    console.error('Get correlation config error:', error);
    return { success: false, error: 'Failed to get correlation config' };
  }
}
