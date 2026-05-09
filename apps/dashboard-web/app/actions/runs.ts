'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const createRunSchema = z.object({
  site_id: z.number().int().positive('Invalid site ID'),
  site_environment_id: z.number().int().positive('Invalid environment ID'),
  name: z.string().min(1, 'Run name is required').max(255, 'Name too long'),
  description: z.string().max(1000).optional(),
  persona_ids: z.array(z.string().min(1)).min(1, 'At least one persona is required'),
  device_profile_ids: z.array(z.number().int().positive()).min(1, 'At least one device profile is required'),
  network_profile_ids: z.array(z.number().int().positive()).min(1, 'At least one network profile is required'),
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).min(1, 'At least one browser is required'),
  flow_names: z.array(z.string().min(1)).min(1, 'At least one flow is required'),
  notes: z.string().max(2000).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Run {
  id: number;
  name: string;
  description: string | null;
  site_id: number;
  site_name: string;
  site_environment_id: number;
  site_env_name: string;
  status: string;
  started_by: string;
  started_at: string | null;
  completed_at: string | null;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  skipped_executions: number;
  notes: string | null;
  is_pinned: boolean;
  created_date: string;
  updated_date: string;
}

export interface RunDetail extends Run {
  config: RunConfig;
  created_by: string;
  updated_by: string;
}

export interface RunConfig {
  persona_ids: string[];
  device_profile_ids: number[];
  network_profile_ids: number[];
  browsers: string[];
  flow_names: string[];
}

export interface RunExecution {
  id: number;
  run_id: number;
  persona_id: string;
  persona_display_name: string;
  device_profile_id: number;
  device_profile_name: string;
  network_profile_id: number;
  network_profile_name: string;
  browser: string;
  flow_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  friction_score: number | null;
  error_message: string | null;
  artifact_path: string | null;
  created_date: string;
  updated_date: string;
}

export interface PersonaOption {
  id: string;
  display_name: string;
  age_band: string;
  device_class: string;
  assistive_tech: string;
  motor_profile: string;
}

export interface DeviceProfileOption {
  id: number;
  name: string;
  device_type: string;
  viewport_width: number;
  viewport_height: number;
}

export interface NetworkProfileOption {
  id: number;
  name: string;
  download_kbps: number;
  upload_kbps: number;
  latency_ms: number;
}

// ─── Personas / Device / Network lookup (for wizard selectors) ───────────────

export async function listPersonaOptions(): Promise<{ success: boolean; personas?: PersonaOption[]; error?: string }> {
  try {
    await requireCapability('run.execute');
    const result = await invokeProc('sp_personas_list', { i_is_system: null, i_age_band: null, i_device_class: null });
    const personas: PersonaOption[] = result.map((row: {
      o_id: string; o_display_name: string; o_age_band: string; o_device_class: string;
      o_assistive_tech: string; o_motor_profile: string;
    }) => ({
      id: row.o_id,
      display_name: row.o_display_name,
      age_band: row.o_age_band,
      device_class: row.o_device_class,
      assistive_tech: row.o_assistive_tech,
      motor_profile: row.o_motor_profile,
    }));
    return { success: true, personas };
  } catch (error) {
    console.error('List persona options error:', error);
    return { success: false, error: 'Failed to load personas' };
  }
}

export async function listDeviceProfileOptions(): Promise<{ success: boolean; profiles?: DeviceProfileOption[]; error?: string }> {
  try {
    await requireCapability('run.execute');
    const result = await invokeProc('sp_device_profiles_list', { i_is_system: null });
    const profiles: DeviceProfileOption[] = result.map((row: {
      o_id: number; o_name: string; o_device_type: string; o_viewport_width: number; o_viewport_height: number;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      device_type: row.o_device_type,
      viewport_width: row.o_viewport_width,
      viewport_height: row.o_viewport_height,
    }));
    return { success: true, profiles };
  } catch (error) {
    console.error('List device profile options error:', error);
    return { success: false, error: 'Failed to load device profiles' };
  }
}

export async function listNetworkProfileOptions(): Promise<{ success: boolean; profiles?: NetworkProfileOption[]; error?: string }> {
  try {
    await requireCapability('run.execute');
    const result = await invokeProc('sp_network_profiles_list', { i_is_system: null });
    const profiles: NetworkProfileOption[] = result.map((row: {
      o_id: number; o_name: string; o_download_kbps: number; o_upload_kbps: number; o_latency_ms: number;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      download_kbps: row.o_download_kbps,
      upload_kbps: row.o_upload_kbps,
      latency_ms: row.o_latency_ms,
    }));
    return { success: true, profiles };
  } catch (error) {
    console.error('List network profile options error:', error);
    return { success: false, error: 'Failed to load network profiles' };
  }
}

// ─── Runs ────────────────────────────────────────────────────────────────────

const RUNS_PAGE_SIZE = 50;

export async function listRuns(
  siteId?: number,
  status?: string,
  page = 0,
): Promise<{ success: boolean; runs?: Run[]; hasMore?: boolean; error?: string }> {
  try {
    await requireCapability('run.read');
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 0;
    // Fetch one extra row beyond the page size to detect whether more pages exist
    // without a separate COUNT(*) query.
    const fetchLimit = RUNS_PAGE_SIZE + 1;
    const result = await invokeProc('sp_runs_list', {
      i_site_id: siteId ?? null,
      i_status: status ?? null,
      i_limit: fetchLimit,
      i_offset: safePage * RUNS_PAGE_SIZE,
    });
    const hasMore = result.length === fetchLimit;
    const rows = hasMore ? result.slice(0, RUNS_PAGE_SIZE) : result;
    const runs: Run[] = rows.map((row: {
      o_id: number; o_name: string; o_description: string | null;
      o_site_id: number; o_site_name: string; o_site_environment_id: number; o_site_env_name: string;
      o_status: string; o_started_by: string; o_started_at: string | null; o_completed_at: string | null;
      o_total_executions: number; o_successful_executions: number; o_failed_executions: number;
      o_skipped_executions: number; o_notes: string | null; o_is_pinned: boolean;
      o_created_date: string; o_updated_date: string;
    }) => ({
      id: row.o_id, name: row.o_name, description: row.o_description,
      site_id: row.o_site_id, site_name: row.o_site_name,
      site_environment_id: row.o_site_environment_id, site_env_name: row.o_site_env_name,
      status: row.o_status, started_by: row.o_started_by,
      started_at: row.o_started_at, completed_at: row.o_completed_at,
      total_executions: row.o_total_executions,
      successful_executions: row.o_successful_executions,
      failed_executions: row.o_failed_executions,
      skipped_executions: row.o_skipped_executions,
      notes: row.o_notes, is_pinned: row.o_is_pinned,
      created_date: row.o_created_date, updated_date: row.o_updated_date,
    }));
    return { success: true, runs, hasMore };
  } catch (error) {
    console.error('List runs error:', error);
    return { success: false, error: 'Failed to list runs' };
  }
}

export async function getRun(id: number): Promise<{ success: boolean; run?: RunDetail; error?: string }> {
  try {
    await requireCapability('run.read');
    const result = await invokeProc('sp_runs_get_by_id', { i_id: id });
    if (!result.length) return { success: false, error: 'Run not found' };
    const row = result[0];
    return {
      success: true,
      run: {
        id: row.o_id, name: row.o_name, description: row.o_description,
        site_id: row.o_site_id, site_name: row.o_site_name,
        site_environment_id: row.o_site_environment_id, site_env_name: row.o_site_env_name,
        status: row.o_status, started_by: row.o_started_by,
        started_at: row.o_started_at, completed_at: row.o_completed_at,
        total_executions: row.o_total_executions,
        successful_executions: row.o_successful_executions,
        failed_executions: row.o_failed_executions,
        skipped_executions: row.o_skipped_executions,
        notes: row.o_notes, is_pinned: row.o_is_pinned,
        created_date: row.o_created_date, updated_date: row.o_updated_date,
        config: typeof row.o_config === 'string' ? JSON.parse(row.o_config) : (row.o_config ?? {}),
        created_by: row.o_created_by, updated_by: row.o_updated_by,
      },
    };
  } catch (error) {
    console.error('Get run error:', error);
    return { success: false, error: 'Failed to load run' };
  }
}

export async function listRunExecutions(runId: number): Promise<{ success: boolean; executions?: RunExecution[]; error?: string }> {
  try {
    await requireCapability('run.read');
    const result = await invokeProc('sp_run_executions_list', { i_run_id: runId });
    const executions: RunExecution[] = result.map((row: {
      o_id: number; o_run_id: number; o_persona_id: string; o_persona_display_name: string;
      o_device_profile_id: number; o_device_profile_name: string;
      o_network_profile_id: number; o_network_profile_name: string;
      o_browser: string; o_flow_name: string; o_status: string;
      o_started_at: string | null; o_completed_at: string | null;
      o_friction_score: string | null; o_error_message: string | null;
      o_artifact_path: string | null; o_created_date: string; o_updated_date: string;
    }) => ({
      id: row.o_id, run_id: row.o_run_id,
      persona_id: row.o_persona_id, persona_display_name: row.o_persona_display_name,
      device_profile_id: row.o_device_profile_id, device_profile_name: row.o_device_profile_name,
      network_profile_id: row.o_network_profile_id, network_profile_name: row.o_network_profile_name,
      browser: row.o_browser, flow_name: row.o_flow_name, status: row.o_status,
      started_at: row.o_started_at, completed_at: row.o_completed_at,
      friction_score: row.o_friction_score !== null ? parseFloat(row.o_friction_score) : null,
      error_message: row.o_error_message, artifact_path: row.o_artifact_path,
      created_date: row.o_created_date, updated_date: row.o_updated_date,
    }));
    return { success: true, executions };
  } catch (error) {
    console.error('List run executions error:', error);
    return { success: false, error: 'Failed to load executions' };
  }
}

export async function createRun(data: z.infer<typeof createRunSchema>): Promise<{ success: boolean; runId?: number; error?: string; fieldErrors?: Record<string, string> }> {
  // Auth check must come BEFORE Zod validation so that unauthenticated callers
  // cannot probe the schema by observing field-level error messages.
  try {
    const authContext = await requireCapability('run.execute');

    const parsed = createRunSchema.safeParse(data);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach(e => { fieldErrors[e.path.join('.')] = e.message; });
      return { success: false, fieldErrors };
    }

    const d = parsed.data;

    // Build config JSONB
    const config = {
      persona_ids: d.persona_ids,
      device_profile_ids: d.device_profile_ids,
      network_profile_ids: d.network_profile_ids,
      browsers: d.browsers,
      flow_names: d.flow_names,
    };

    const result = await invokeProcWrite('sp_runs_insert', {
      i_site_id: d.site_id,
      i_site_environment_id: d.site_environment_id,
      i_name: d.name,
      i_description: d.description ?? null,
      i_config: JSON.stringify(config),
      i_notes: d.notes ?? null,
      i_created_by: authContext.operatorId.toString(),
    });

    const runId: number = result[0]?.o_id;
    if (!runId) throw new Error('Run creation returned no ID');

    return { success: true, runId };
  } catch (error) {
    console.error('Create run error:', error);
    return { success: false, error: 'Failed to create run' };
  }
}

export async function updateRunStatus(
  id: number,
  status: string,
  options?: { started_at?: string; completed_at?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const authContext = await requireCapability('run.execute');
    await invokeProcWrite('sp_runs_update_status', {
      i_id: id,
      i_status: status,
      i_started_at: options?.started_at ?? null,
      i_completed_at: options?.completed_at ?? null,
      i_updated_by: authContext.operatorId.toString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Update run status error:', error);
    return { success: false, error: 'Failed to update run status' };
  }
}

export async function abortRun(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const authContext = await requireCapability('run.execute');
    await invokeProcWrite('sp_runs_update_status', {
      i_id: id,
      i_status: 'aborted',
      i_started_at: null,
      i_completed_at: new Date().toISOString(),
      i_updated_by: authContext.operatorId.toString(),
    });
    return { success: true };
  } catch (error) {
    console.error('Abort run error:', error);
    return { success: false, error: 'Failed to abort run' };
  }
}
