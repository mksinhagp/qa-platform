'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const emailProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').max(255, 'Name too long'),
  provider_type: z.string().min(1, 'Provider type is required').max(100, 'Provider type too long'),
  host: z.string().min(1, 'Host is required').max(255, 'Host too long'),
  port: z.number().int().min(1, 'Port must be at least 1').max(65535, 'Port must be at most 65535'),
  use_tls: z.boolean(),
  config_json: z.record(z.unknown()).optional(),
  is_active: z.boolean(),
});

const emailProviderUpdateSchema = z.object({
  id: z.number().int().positive('Invalid provider ID'),
  name: z.string().min(1, 'Provider name is required').max(255, 'Name too long'),
  host: z.string().min(1, 'Host is required').max(255, 'Host too long'),
  port: z.number().int().min(1, 'Port must be at least 1').max(65535, 'Port must be at most 65535'),
  use_tls: z.boolean(),
  config_json: z.record(z.unknown()).optional(),
  is_active: z.boolean(),
});

const inboxBindingV2Schema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  site_environment_id: z.number().int().positive('Invalid site environment ID').optional(),
  persona_id: z.number().int().positive('Invalid persona ID').optional(),
  flow_key: z.string().max(255, 'Flow key too long').optional(),
  role: z.string().max(100, 'Role too long').optional(),
  email_provider_id: z.number().int().positive('Invalid email provider ID'),
  inbox_address: z.string().email('Must be a valid email address').max(255, 'Inbox address too long'),
  correlation_strategy: z.string().min(1, 'Correlation strategy is required').max(100, 'Correlation strategy too long'),
  config_json: z.record(z.unknown()).optional(),
});

const templateAssertionSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  flow_key: z.string().min(1, 'Flow key is required').max(255, 'Flow key too long'),
  assertion_key: z.string().min(1, 'Assertion key is required').max(255, 'Assertion key too long'),
  assertion_type: z.string().min(1, 'Assertion type is required').max(100, 'Assertion type too long'),
  expected_pattern: z.string().min(1, 'Expected pattern is required'),
  config_json: z.record(z.unknown()).optional(),
});

const timingSlaSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  flow_key: z.string().min(1, 'Flow key is required').max(255, 'Flow key too long'),
  max_delivery_seconds: z.number().int().positive('Max delivery seconds must be positive'),
  warn_threshold_seconds: z.number().int().positive('Warn threshold seconds must be positive'),
});

const timingResultSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  flow_key: z.string().min(1, 'Flow key is required').max(255, 'Flow key too long'),
  run_id: z.number().int().positive('Invalid run ID').optional(),
  delivery_seconds: z.number().positive('Delivery seconds must be positive'),
  met_sla: z.boolean(),
});

const correlationConfigSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  strategy: z.string().min(1, 'Strategy is required').max(100, 'Strategy too long'),
  base_address: z.string().max(255, 'Base address too long').optional(),
  domain: z.string().max(255, 'Domain too long').optional(),
  config_json: z.record(z.unknown()).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailProvider {
  id: number;
  name: string;
  provider_type: string;
  host: string;
  port: number;
  use_tls: boolean;
  is_active: boolean;
  created_date: string;
  updated_date: string;
}

export interface EmailProviderDetail extends EmailProvider {
  config_json: Record<string, unknown> | null;
}

export interface EmailInboxBindingV2 {
  id: number;
  site_id: number;
  site_environment_id: number | null;
  persona_id: number | null;
  flow_key: string | null;
  role: string | null;
  email_provider_id: number;
  inbox_address: string;
  correlation_strategy: string;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  created_date: string;
}

export interface EmailTemplateAssertion {
  id: number;
  site_id: number;
  flow_key: string;
  assertion_key: string;
  assertion_type: string;
  expected_pattern: string;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  created_date: string;
}

export interface EmailTimingSla {
  id: number;
  site_id: number;
  flow_key: string;
  max_delivery_seconds: number;
  warn_threshold_seconds: number;
  is_active: boolean;
  created_date: string;
}

export interface EmailTimingResult {
  id: number;
  site_id: number;
  flow_key: string;
  run_id: number | null;
  delivery_seconds: number;
  met_sla: boolean;
  created_date: string;
}

export interface EmailCorrelationConfig {
  id: number;
  site_id: number;
  strategy: string;
  base_address: string | null;
  domain: string | null;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  created_date: string;
}

// ─── Row Mappers ─────────────────────────────────────────────────────────────

function mapEmailProviderRow(row: {
  o_id: number;
  o_name: string;
  o_provider_type: string;
  o_host: string;
  o_port: number;
  o_use_tls: boolean;
  o_is_active: boolean;
  o_created_date: string;
  o_updated_date: string;
}): EmailProvider {
  return {
    id: row.o_id,
    name: row.o_name,
    provider_type: row.o_provider_type,
    host: row.o_host,
    port: row.o_port,
    use_tls: row.o_use_tls,
    is_active: row.o_is_active,
    created_date: row.o_created_date,
    updated_date: row.o_updated_date ?? '',
  };
}

function mapInboxBindingV2Row(row: {
  o_id: number;
  o_site_id: number;
  o_site_environment_id: number | null;
  o_persona_id: number | null;
  o_flow_key: string | null;
  o_role: string | null;
  o_email_provider_id: number;
  o_inbox_address: string;
  o_correlation_strategy: string;
  o_config_json: Record<string, unknown> | null;
  o_is_active: boolean;
  o_created_date: string;
}): EmailInboxBindingV2 {
  return {
    id: row.o_id,
    site_id: row.o_site_id,
    site_environment_id: row.o_site_environment_id ?? null,
    persona_id: row.o_persona_id ?? null,
    flow_key: row.o_flow_key ?? null,
    role: row.o_role ?? null,
    email_provider_id: row.o_email_provider_id,
    inbox_address: row.o_inbox_address,
    correlation_strategy: row.o_correlation_strategy,
    config_json: row.o_config_json ?? null,
    is_active: row.o_is_active,
    created_date: row.o_created_date,
  };
}

// ─── Email Providers ─────────────────────────────────────────────────────────

export async function listEmailProviders(
  activeOnly?: boolean
): Promise<{ success: boolean; providers?: EmailProvider[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_providers_list', {
      i_is_active: activeOnly ?? null,
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
): Promise<{ success: boolean; provider?: EmailProviderDetail; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_providers_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Email provider not found' };
    const row = result[0];
    return {
      success: true,
      provider: {
        ...mapEmailProviderRow(row),
        config_json: row.o_config_json ?? null,
      },
    };
  } catch (error) {
    console.error('Get email provider error:', error);
    return { success: false, error: 'Failed to get email provider' };
  }
}

export async function createEmailProvider(data: {
  name: string;
  provider_type: string;
  host: string;
  port: number;
  use_tls: boolean;
  config_json?: Record<string, unknown>;
  is_active: boolean;
}): Promise<{ success: boolean; provider?: EmailProvider; error?: string }> {
  try {
    // Validate input
    const validation = emailProviderSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_email_providers_insert', {
      i_name: validation.data.name,
      i_provider_type: validation.data.provider_type,
      i_host: validation.data.host,
      i_port: validation.data.port,
      i_use_tls: validation.data.use_tls,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_is_active: validation.data.is_active,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    return { success: true, provider: mapEmailProviderRow(result[0]) };
  } catch (error) {
    console.error('Create email provider error:', error);
    return { success: false, error: 'Failed to create email provider' };
  }
}

export async function updateEmailProvider(data: {
  id: number;
  name: string;
  host: string;
  port: number;
  use_tls: boolean;
  config_json?: Record<string, unknown>;
  is_active: boolean;
}): Promise<{ success: boolean; provider?: Pick<EmailProvider, 'id' | 'name' | 'updated_date'>; error?: string }> {
  try {
    // Validate input
    const validation = emailProviderUpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_email_providers_update', {
      i_id: validation.data.id,
      i_name: validation.data.name,
      i_host: validation.data.host,
      i_port: validation.data.port,
      i_use_tls: validation.data.use_tls,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_is_active: validation.data.is_active,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Email provider not found' };
    const row = result[0];
    return {
      success: true,
      provider: { id: row.o_id, name: row.o_name, updated_date: row.o_updated_date },
    };
  } catch (error) {
    console.error('Update email provider error:', error);
    return { success: false, error: 'Failed to update email provider' };
  }
}

// ─── Inbox Bindings V2 ────────────────────────────────────────────────────────

export async function createInboxBindingV2(data: {
  site_id: number;
  site_environment_id?: number;
  persona_id?: number;
  flow_key?: string;
  role?: string;
  email_provider_id: number;
  inbox_address: string;
  correlation_strategy: string;
  config_json?: Record<string, unknown>;
}): Promise<{ success: boolean; binding?: Pick<EmailInboxBindingV2, 'id' | 'inbox_address' | 'created_date'>; error?: string }> {
  try {
    // Validate input
    const validation = inboxBindingV2Schema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_email_inbox_bindings_v2_insert', {
      i_site_id: validation.data.site_id,
      i_site_environment_id: validation.data.site_environment_id ?? null,
      i_persona_id: validation.data.persona_id ?? null,
      i_flow_key: validation.data.flow_key ?? null,
      i_role: validation.data.role ?? null,
      i_email_provider_id: validation.data.email_provider_id,
      i_inbox_address: validation.data.inbox_address,
      i_correlation_strategy: validation.data.correlation_strategy,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return {
      success: true,
      binding: { id: row.o_id, inbox_address: row.o_inbox_address, created_date: row.o_created_date },
    };
  } catch (error) {
    console.error('Create inbox binding V2 error:', error);
    return { success: false, error: 'Failed to create inbox binding' };
  }
}

export async function listInboxBindingsV2(
  siteId: number,
  envId?: number
): Promise<{ success: boolean; bindings?: EmailInboxBindingV2[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_inbox_bindings_v2_list', {
      i_site_id: siteId,
      i_site_environment_id: envId ?? null,
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
  envId: number,
  personaId?: number,
  flowKey?: string,
  role?: string
): Promise<{ success: boolean; binding?: EmailInboxBindingV2; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_inbox_bindings_v2_resolve', {
      i_site_id: siteId,
      i_site_environment_id: envId,
      i_persona_id: personaId ?? null,
      i_flow_key: flowKey ?? null,
      i_role: role ?? null,
    });
    if (!result.length) return { success: false, error: 'No matching inbox binding found' };
    return { success: true, binding: mapInboxBindingV2Row(result[0]) };
  } catch (error) {
    console.error('Resolve inbox binding error:', error);
    return { success: false, error: 'Failed to resolve inbox binding' };
  }
}

// ─── Template Assertions ──────────────────────────────────────────────────────

export async function createTemplateAssertion(data: {
  site_id: number;
  flow_key: string;
  assertion_key: string;
  assertion_type: string;
  expected_pattern: string;
  config_json?: Record<string, unknown>;
}): Promise<{ success: boolean; assertion?: Pick<EmailTemplateAssertion, 'id' | 'assertion_key' | 'created_date'>; error?: string }> {
  try {
    // Validate input
    const validation = templateAssertionSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_email_template_assertions_insert', {
      i_site_id: validation.data.site_id,
      i_flow_key: validation.data.flow_key,
      i_assertion_key: validation.data.assertion_key,
      i_assertion_type: validation.data.assertion_type,
      i_expected_pattern: validation.data.expected_pattern,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return {
      success: true,
      assertion: { id: row.o_id, assertion_key: row.o_assertion_key, created_date: row.o_created_date },
    };
  } catch (error) {
    console.error('Create template assertion error:', error);
    return { success: false, error: 'Failed to create template assertion' };
  }
}

export async function listTemplateAssertions(
  siteId: number,
  flowKey?: string
): Promise<{ success: boolean; assertions?: EmailTemplateAssertion[]; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_template_assertions_list', {
      i_site_id: siteId,
      i_flow_key: flowKey ?? null,
    });
    const assertions: EmailTemplateAssertion[] = result.map((row: {
      o_id: number; o_site_id: number; o_flow_key: string; o_assertion_key: string;
      o_assertion_type: string; o_expected_pattern: string;
      o_config_json: Record<string, unknown> | null; o_is_active: boolean; o_created_date: string;
    }) => ({
      id: row.o_id,
      site_id: row.o_site_id,
      flow_key: row.o_flow_key,
      assertion_key: row.o_assertion_key,
      assertion_type: row.o_assertion_type,
      expected_pattern: row.o_expected_pattern,
      config_json: row.o_config_json ?? null,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
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
  flow_key: string;
  max_delivery_seconds: number;
  warn_threshold_seconds: number;
}): Promise<{ success: boolean; sla?: Pick<EmailTimingSla, 'id' | 'created_date'>; error?: string }> {
  try {
    // Validate input
    const validation = timingSlaSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_email_timing_slas_insert', {
      i_site_id: validation.data.site_id,
      i_flow_key: validation.data.flow_key,
      i_max_delivery_seconds: validation.data.max_delivery_seconds,
      i_warn_threshold_seconds: validation.data.warn_threshold_seconds,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return { success: true, sla: { id: row.o_id, created_date: row.o_created_date } };
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
    const slas: EmailTimingSla[] = result.map((row: {
      o_id: number; o_site_id: number; o_flow_key: string;
      o_max_delivery_seconds: number; o_warn_threshold_seconds: number;
      o_is_active: boolean; o_created_date: string;
    }) => ({
      id: row.o_id,
      site_id: row.o_site_id,
      flow_key: row.o_flow_key,
      max_delivery_seconds: row.o_max_delivery_seconds,
      warn_threshold_seconds: row.o_warn_threshold_seconds,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
    }));
    return { success: true, slas };
  } catch (error) {
    console.error('List timing SLAs error:', error);
    return { success: false, error: 'Failed to list timing SLAs' };
  }
}

// ─── Timing Results ───────────────────────────────────────────────────────────

export async function createTimingResult(data: {
  site_id: number;
  flow_key: string;
  run_id?: number;
  delivery_seconds: number;
  met_sla: boolean;
}): Promise<{ success: boolean; result?: Pick<EmailTimingResult, 'id' | 'created_date'>; error?: string }> {
  try {
    // Validate input
    const validation = timingResultSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const procResult = await invokeProcWrite('sp_email_timing_results_insert', {
      i_site_id: validation.data.site_id,
      i_flow_key: validation.data.flow_key,
      i_run_id: validation.data.run_id ?? null,
      i_delivery_seconds: validation.data.delivery_seconds,
      i_met_sla: validation.data.met_sla,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!procResult.length) return { success: false, error: 'Insert returned no row' };
    const row = procResult[0];
    return { success: true, result: { id: row.o_id, created_date: row.o_created_date } };
  } catch (error) {
    console.error('Create timing result error:', error);
    return { success: false, error: 'Failed to create timing result' };
  }
}

export async function listTimingResults(
  siteId: number,
  flowKey?: string,
  limit?: number
): Promise<{ success: boolean; results?: EmailTimingResult[]; error?: string }> {
  try {
    await requireOperator();
    const procResult = await invokeProc('sp_email_timing_results_list', {
      i_site_id: siteId,
      i_flow_key: flowKey ?? null,
      i_limit: limit ?? null,
    });
    const results: EmailTimingResult[] = procResult.map((row: {
      o_id: number; o_site_id: number; o_flow_key: string;
      o_run_id: number | null; o_delivery_seconds: number; o_met_sla: boolean; o_created_date: string;
    }) => ({
      id: row.o_id,
      site_id: row.o_site_id,
      flow_key: row.o_flow_key,
      run_id: row.o_run_id ?? null,
      delivery_seconds: row.o_delivery_seconds,
      met_sla: row.o_met_sla,
      created_date: row.o_created_date,
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
  strategy: string;
  base_address?: string;
  domain?: string;
  config_json?: Record<string, unknown>;
}): Promise<{ success: boolean; config?: Pick<EmailCorrelationConfig, 'id' | 'created_date'>; error?: string }> {
  try {
    // Validate input
    const validation = correlationConfigSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.issues.map((issue: { message: string }) => issue.message).join(', ');
      return { success: false, error: errors };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_email_correlation_configs_insert', {
      i_site_id: validation.data.site_id,
      i_strategy: validation.data.strategy,
      i_base_address: validation.data.base_address ?? null,
      i_domain: validation.data.domain ?? null,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0];
    return { success: true, config: { id: row.o_id, created_date: row.o_created_date } };
  } catch (error) {
    console.error('Create correlation config error:', error);
    return { success: false, error: 'Failed to create correlation config' };
  }
}

export async function getCorrelationConfig(
  siteId: number
): Promise<{ success: boolean; config?: EmailCorrelationConfig; error?: string }> {
  try {
    await requireOperator();
    const result = await invokeProc('sp_email_correlation_configs_get', { i_site_id: siteId });
    if (!result.length) return { success: false, error: 'Correlation config not found' };
    const row = result[0];
    return {
      success: true,
      config: {
        id: row.o_id,
        site_id: row.o_site_id,
        strategy: row.o_strategy,
        base_address: row.o_base_address ?? null,
        domain: row.o_domain ?? null,
        config_json: row.o_config_json ?? null,
        is_active: row.o_is_active,
        created_date: row.o_created_date,
      },
    };
  } catch (error) {
    console.error('Get correlation config error:', error);
    return { success: false, error: 'Failed to get correlation config' };
  }
}
