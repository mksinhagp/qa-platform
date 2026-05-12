'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireOperator } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const capabilitySchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  capability_key: z.string().min(1, 'Capability key is required').max(100),
  is_enabled: z.boolean(),
  config_json: z.record(z.unknown()).optional(),
  notes: z.string().max(1000).optional(),
});

const flowMappingSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  flow_key: z.string().min(1, 'Flow key is required').max(100),
  flow_name: z.string().min(1, 'Flow name is required').max(255),
  implementation: z.enum(['template', 'custom', 'config_driven']).default('template'),
  config_json: z.record(z.unknown()).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  notes: z.string().max(1000).optional(),
});

const selectorEntrySchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  element_key: z.string().min(1, 'Element key is required').max(100),
  label: z.string().min(1, 'Label is required').max(255),
  selector_type: z.enum(['css', 'xpath', 'aria_role', 'visible_text', 'test_id']).default('css'),
  selector_value: z.string().min(1, 'Selector value is required'),
  fallback_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  flow_key: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SiteCapability {
  id: number;
  capability_key: string;
  is_enabled: boolean;
  config_json: Record<string, unknown> | null;
  notes: string | null;
  created_date: string;
  updated_date: string;
}

export interface SiteFlowMapping {
  id: number;
  flow_key: string;
  flow_name: string;
  implementation: string;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_date: string;
  updated_date: string;
}

export interface SiteSelectorEntry {
  id: number;
  element_key: string;
  label: string;
  selector_type: string;
  selector_value: string;
  fallback_order: number;
  is_active: boolean;
  flow_key: string | null;
  notes: string | null;
  created_date: string;
  updated_date: string;
}

export interface SiteRulesVersion {
  id: number;
  version: number;
  is_active: boolean;
  published_at: string | null;
  notes: string | null;
  created_date: string;
}

type Result<T> = { success: true } & T | { success: false; error: string };

// ─── Capabilities ────────────────────────────────────────────────────────────

export async function listCapabilities(
  siteId: number,
): Promise<Result<{ capabilities: SiteCapability[] }>> {
  try {
    await requireOperator();
    const rows = await invokeProc('sp_site_capabilities_list', { i_site_id: siteId });
    const capabilities: SiteCapability[] = rows.map((r: Record<string, unknown>) => ({
      id: r.o_id as number,
      capability_key: r.o_capability_key as string,
      is_enabled: r.o_is_enabled as boolean,
      config_json: r.o_config_json as Record<string, unknown> | null,
      notes: r.o_notes as string | null,
      created_date: r.o_created_date as string,
      updated_date: r.o_updated_date as string,
    }));
    return { success: true, capabilities };
  } catch (error) {
    console.error('List capabilities error:', error);
    return { success: false, error: 'Failed to list capabilities' };
  }
}

export async function upsertCapability(data: {
  site_id: number;
  capability_key: string;
  is_enabled: boolean;
  config_json?: Record<string, unknown>;
  notes?: string;
}): Promise<Result<{ id: number }>> {
  try {
    const validation = capabilitySchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues.map(i => i.message).join(', ') };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_capabilities_insert', {
      i_site_id: validation.data.site_id,
      i_capability_key: validation.data.capability_key,
      i_is_enabled: validation.data.is_enabled,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Upsert returned no row' };
    return { success: true, id: (result[0] as Record<string, unknown>).o_id as number };
  } catch (error) {
    console.error('Upsert capability error:', error);
    return { success: false, error: 'Failed to save capability' };
  }
}

export async function batchUpsertCapabilities(data: {
  site_id: number;
  capabilities: Array<{ key: string; enabled: boolean }>;
}): Promise<Result<{ count: number }>> {
  try {
    const authContext = await requireOperator();
    const keys = data.capabilities.map(c => c.key);
    const flags = data.capabilities.map(c => c.enabled);

    const result = await invokeProcWrite('sp_site_capabilities_batch_upsert', {
      i_site_id: data.site_id,
      i_capability_keys: keys,
      i_enabled_flags: flags,
      i_created_by: authContext.operatorId.toString(),
    });
    const count = result.length > 0 ? (result[0] as Record<string, unknown>).o_upserted_count as number : 0;
    return { success: true, count };
  } catch (error) {
    console.error('Batch upsert capabilities error:', error);
    return { success: false, error: 'Failed to batch save capabilities' };
  }
}

// ─── Flow Mappings ───────────────────────────────────────────────────────────

export async function listFlowMappings(
  siteId: number,
  activeOnly = false,
): Promise<Result<{ mappings: SiteFlowMapping[] }>> {
  try {
    await requireOperator();
    const rows = await invokeProc('sp_site_flow_mappings_list', {
      i_site_id: siteId,
      i_active_only: activeOnly,
    });
    const mappings: SiteFlowMapping[] = rows.map((r: Record<string, unknown>) => ({
      id: r.o_id as number,
      flow_key: r.o_flow_key as string,
      flow_name: r.o_flow_name as string,
      implementation: r.o_implementation as string,
      config_json: r.o_config_json as Record<string, unknown> | null,
      is_active: r.o_is_active as boolean,
      sort_order: r.o_sort_order as number,
      notes: r.o_notes as string | null,
      created_date: r.o_created_date as string,
      updated_date: r.o_updated_date as string,
    }));
    return { success: true, mappings };
  } catch (error) {
    console.error('List flow mappings error:', error);
    return { success: false, error: 'Failed to list flow mappings' };
  }
}

export async function upsertFlowMapping(data: {
  site_id: number;
  flow_key: string;
  flow_name: string;
  implementation?: string;
  config_json?: Record<string, unknown>;
  is_active?: boolean;
  sort_order?: number;
  notes?: string;
}): Promise<Result<{ id: number }>> {
  try {
    const validation = flowMappingSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues.map(i => i.message).join(', ') };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_flow_mappings_insert', {
      i_site_id: validation.data.site_id,
      i_flow_key: validation.data.flow_key,
      i_flow_name: validation.data.flow_name,
      i_implementation: validation.data.implementation,
      i_config_json: validation.data.config_json ? JSON.stringify(validation.data.config_json) : null,
      i_is_active: validation.data.is_active,
      i_sort_order: validation.data.sort_order,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Upsert returned no row' };
    return { success: true, id: (result[0] as Record<string, unknown>).o_id as number };
  } catch (error) {
    console.error('Upsert flow mapping error:', error);
    return { success: false, error: 'Failed to save flow mapping' };
  }
}

// ─── Selector Entries ────────────────────────────────────────────────────────

export async function listSelectorEntries(
  siteId: number,
  elementKey?: string,
  flowKey?: string,
): Promise<Result<{ entries: SiteSelectorEntry[] }>> {
  try {
    await requireOperator();
    const rows = await invokeProc('sp_site_selector_entries_list', {
      i_site_id: siteId,
      i_element_key: elementKey ?? null,
      i_flow_key: flowKey ?? null,
    });
    const entries: SiteSelectorEntry[] = rows.map((r: Record<string, unknown>) => ({
      id: r.o_id as number,
      element_key: r.o_element_key as string,
      label: r.o_label as string,
      selector_type: r.o_selector_type as string,
      selector_value: r.o_selector_value as string,
      fallback_order: r.o_fallback_order as number,
      is_active: r.o_is_active as boolean,
      flow_key: r.o_flow_key as string | null,
      notes: r.o_notes as string | null,
      created_date: r.o_created_date as string,
      updated_date: r.o_updated_date as string,
    }));
    return { success: true, entries };
  } catch (error) {
    console.error('List selector entries error:', error);
    return { success: false, error: 'Failed to list selector entries' };
  }
}

export async function createSelectorEntry(data: {
  site_id: number;
  element_key: string;
  label: string;
  selector_type?: string;
  selector_value: string;
  fallback_order?: number;
  is_active?: boolean;
  flow_key?: string;
  notes?: string;
}): Promise<Result<{ id: number }>> {
  try {
    const validation = selectorEntrySchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues.map(i => i.message).join(', ') };
    }

    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_selector_entries_insert', {
      i_site_id: validation.data.site_id,
      i_element_key: validation.data.element_key,
      i_label: validation.data.label,
      i_selector_type: validation.data.selector_type,
      i_selector_value: validation.data.selector_value,
      i_fallback_order: validation.data.fallback_order,
      i_is_active: validation.data.is_active,
      i_flow_key: validation.data.flow_key ?? null,
      i_notes: validation.data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    return { success: true, id: (result[0] as Record<string, unknown>).o_id as number };
  } catch (error) {
    console.error('Create selector entry error:', error);
    return { success: false, error: 'Failed to create selector entry' };
  }
}

export async function updateSelectorEntry(data: {
  id: number;
  label?: string;
  selector_type?: string;
  selector_value?: string;
  fallback_order?: number;
  is_active?: boolean;
  flow_key?: string;
  notes?: string;
}): Promise<Result<{ id: number }>> {
  try {
    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_selector_entries_update', {
      i_id: data.id,
      i_label: data.label ?? null,
      i_selector_type: data.selector_type ?? null,
      i_selector_value: data.selector_value ?? null,
      i_fallback_order: data.fallback_order ?? null,
      i_is_active: data.is_active ?? null,
      i_flow_key: data.flow_key ?? null,
      i_notes: data.notes ?? null,
      i_updated_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Update returned no row' };
    return { success: true, id: (result[0] as Record<string, unknown>).o_id as number };
  } catch (error) {
    console.error('Update selector entry error:', error);
    return { success: false, error: 'Failed to update selector entry' };
  }
}

// ─── Rules Versions ──────────────────────────────────────────────────────────

export async function listRulesVersions(
  siteId: number,
): Promise<Result<{ versions: SiteRulesVersion[] }>> {
  try {
    await requireOperator();
    const rows = await invokeProc('sp_site_rules_versions_list', { i_site_id: siteId });
    const versions: SiteRulesVersion[] = rows.map((r: Record<string, unknown>) => ({
      id: r.o_id as number,
      version: r.o_version as number,
      is_active: r.o_is_active as boolean,
      published_at: r.o_published_at as string | null,
      notes: r.o_notes as string | null,
      created_date: r.o_created_date as string,
    }));
    return { success: true, versions };
  } catch (error) {
    console.error('List rules versions error:', error);
    return { success: false, error: 'Failed to list rules versions' };
  }
}

export async function createRulesVersion(data: {
  site_id: number;
  rules_json: Record<string, unknown>;
  is_active?: boolean;
  notes?: string;
}): Promise<Result<{ id: number; version: number }>> {
  try {
    const authContext = await requireOperator();
    const result = await invokeProcWrite('sp_site_rules_versions_insert', {
      i_site_id: data.site_id,
      i_rules_json: JSON.stringify(data.rules_json),
      i_is_active: data.is_active ?? false,
      i_notes: data.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });
    if (!result.length) return { success: false, error: 'Insert returned no row' };
    const row = result[0] as Record<string, unknown>;
    return {
      success: true,
      id: row.o_id as number,
      version: row.o_version as number,
    };
  } catch (error) {
    console.error('Create rules version error:', error);
    return { success: false, error: 'Failed to create rules version' };
  }
}

export async function getActiveRulesVersion(
  siteId: number,
): Promise<Result<{ version: SiteRulesVersion & { rules_json: Record<string, unknown> } } | { version: null }>> {
  try {
    await requireOperator();
    const rows = await invokeProc('sp_site_rules_versions_get_active', { i_site_id: siteId });
    if (!rows.length) return { success: true, version: null };
    const r = rows[0] as Record<string, unknown>;
    return {
      success: true,
      version: {
        id: r.o_id as number,
        version: r.o_version as number,
        rules_json: r.o_rules_json as Record<string, unknown>,
        is_active: true,
        published_at: r.o_published_at as string | null,
        notes: r.o_notes as string | null,
        created_date: '',
      },
    };
  } catch (error) {
    console.error('Get active rules version error:', error);
    return { success: false, error: 'Failed to get active rules version' };
  }
}
