'use server';

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { logAudit } from './audit';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignType =
  | 'smoke'
  | 'regression'
  | 'release_certification'
  | 'payment_certification'
  | 'accessibility_audit'
  | 'email_deliverability';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Campaign {
  id: number;
  name: string;
  campaign_type: CampaignType;
  description: string | null;
  site_id: number | null;
  site_environment_id: number | null;
  concurrency_cap: number;
  requires_approval: boolean;
  is_active: boolean;
  created_date: string;
}

export interface CampaignDetail extends Campaign {
  persona_ids: number[] | null;
  device_profile_ids: number[] | null;
  network_profile_ids: number[] | null;
  browser_types: string[] | null;
  payment_scenario_ids: number[] | null;
  email_provider_ids: number[] | null;
  flow_types: string[] | null;
  retry_on_failure: boolean;
  max_retries: number;
  approval_policy_id: number | null;
  updated_date: string;
}

export interface CampaignScenario {
  id: number;
  campaign_id: number;
  persona_id: number | null;
  device_profile_id: number | null;
  network_profile_id: number | null;
  browser_type: string | null;
  payment_scenario_id: number | null;
  email_provider_id: number | null;
  flow_type: string | null;
  scenario_hash: string;
  is_active: boolean;
  created_date: string;
}

export interface CampaignExecution {
  id: number;
  campaign_id: number;
  run_id: number | null;
  execution_type: string;
  triggered_by: string;
  status: ExecutionStatus;
  total_scenarios: number;
  executed_scenarios: number;
  successful_scenarios: number;
  failed_scenarios: number;
  skipped_scenarios: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_date: string;
}

export interface CampaignSchedule {
  id: number;
  campaign_id: number;
  schedule_type: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_date: string;
}

export interface CreateCampaignInput {
  name: string;
  campaign_type: CampaignType;
  description?: string;
  site_id?: number;
  site_environment_id?: number;
  persona_ids?: number[];
  device_profile_ids?: number[];
  network_profile_ids?: number[];
  browser_types?: string[];
  payment_scenario_ids?: number[];
  email_provider_ids?: number[];
  flow_types?: string[];
  concurrency_cap?: number;
  retry_on_failure?: boolean;
  max_retries?: number;
  requires_approval?: boolean;
  approval_policy_id?: number;
}

export interface MatrixGenerationResult {
  total_scenarios: number;
  generated: number;
  skipped: number;
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface CampaignsListResult {
  success: boolean;
  campaigns?: Campaign[];
  error?: string;
}

export interface CampaignResult {
  success: boolean;
  campaign?: CampaignDetail;
  error?: string;
}

export interface CampaignCreateResult {
  success: boolean;
  campaignId?: number;
  error?: string;
}

export interface CampaignScenariosResult {
  success: boolean;
  scenarios?: CampaignScenario[];
  error?: string;
}

export interface CampaignExecutionsResult {
  success: boolean;
  executions?: CampaignExecution[];
  error?: string;
}

export interface MatrixGenResult {
  success: boolean;
  result?: MatrixGenerationResult;
  error?: string;
}

export interface CampaignSchedulesResult {
  success: boolean;
  schedules?: CampaignSchedule[];
  error?: string;
}

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

export async function listCampaigns(
  campaignType?: string,
  siteId?: number,
  isActive?: boolean
): Promise<CampaignsListResult> {
  try {
    await requireCapability('run.read');

    const result = await invokeProc('sp_qa_campaigns_list', {
      i_campaign_type: campaignType || null,
      i_site_id: siteId || null,
      i_is_active: isActive !== undefined ? isActive : null,
      i_limit: 100,
      i_offset: 0,
    });

    const campaigns: Campaign[] = result.map((row: {
      o_id: number;
      o_name: string;
      o_campaign_type: string;
      o_description: string | null;
      o_site_id: number | null;
      o_site_environment_id: number | null;
      o_concurrency_cap: number;
      o_requires_approval: boolean;
      o_is_active: boolean;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      campaign_type: row.o_campaign_type as CampaignType,
      description: row.o_description,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      concurrency_cap: row.o_concurrency_cap,
      requires_approval: row.o_requires_approval,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
    }));

    return { success: true, campaigns };
  } catch (error) {
    console.error('List campaigns error:', error);
    return { success: false, error: 'Failed to list campaigns' };
  }
}

export async function getCampaign(id: number): Promise<CampaignResult> {
  try {
    await requireCapability('run.read');

    const result = await invokeProc('sp_qa_campaigns_get_by_id', {
      i_id: id,
    });

    if (result.length === 0) {
      return { success: false, error: 'Campaign not found' };
    }

    const row = result[0];
    const campaign: CampaignDetail = {
      id: row.o_id,
      name: row.o_name,
      campaign_type: row.o_campaign_type as CampaignType,
      description: row.o_description,
      site_id: row.o_site_id,
      site_environment_id: row.o_site_environment_id,
      persona_ids: row.o_persona_ids,
      device_profile_ids: row.o_device_profile_ids,
      network_profile_ids: row.o_network_profile_ids,
      browser_types: row.o_browser_types,
      payment_scenario_ids: row.o_payment_scenario_ids,
      email_provider_ids: row.o_email_provider_ids,
      flow_types: row.o_flow_types,
      concurrency_cap: row.o_concurrency_cap,
      retry_on_failure: row.o_retry_on_failure,
      max_retries: row.o_max_retries,
      requires_approval: row.o_requires_approval,
      approval_policy_id: row.o_approval_policy_id,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    };

    return { success: true, campaign };
  } catch (error) {
    console.error('Get campaign error:', error);
    return { success: false, error: 'Failed to get campaign' };
  }
}

export async function createCampaign(
  input: CreateCampaignInput
): Promise<CampaignCreateResult> {
  try {
    const authContext = await requireCapability('run.execute');

    const result = await invokeProcWrite('sp_qa_campaigns_insert', {
      i_name: input.name,
      i_campaign_type: input.campaign_type,
      i_description: input.description || null,
      i_site_id: input.site_id || null,
      i_site_environment_id: input.site_environment_id || null,
      i_persona_ids: input.persona_ids || null,
      i_device_profile_ids: input.device_profile_ids || null,
      i_network_profile_ids: input.network_profile_ids || null,
      i_browser_types: input.browser_types || null,
      i_payment_scenario_ids: input.payment_scenario_ids || null,
      i_email_provider_ids: input.email_provider_ids || null,
      i_flow_types: input.flow_types || null,
      i_concurrency_cap: input.concurrency_cap ?? 5,
      i_retry_on_failure: input.retry_on_failure ?? false,
      i_max_retries: input.max_retries ?? 1,
      i_requires_approval: input.requires_approval ?? false,
      i_approval_policy_id: input.approval_policy_id || null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create campaign' };
    }

    const row = result[0];

    await logAudit({
      action: 'campaign.create',
      target: `campaign:${row.o_id}`,
      status: 'success',
      details: { name: input.name, type: input.campaign_type },
    });

    return { success: true, campaignId: row.o_id };
  } catch (error) {
    console.error('Create campaign error:', error);
    return { success: false, error: 'Failed to create campaign' };
  }
}

// ─── Scenario Matrix ──────────────────────────────────────────────────────────

export async function generateScenarioMatrix(
  campaignId: number,
  regenerate: boolean = false
): Promise<MatrixGenResult> {
  try {
    const authContext = await requireCapability('run.execute');

    const result = await invokeProcWrite('sp_campaign_scenarios_generate_matrix', {
      i_campaign_id: campaignId,
      i_regenerate: regenerate,
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to generate scenario matrix' };
    }

    const row = result[0];

    await logAudit({
      action: 'campaign.generate_matrix',
      target: `campaign:${campaignId}`,
      status: 'success',
      details: { total: row.o_total_scenarios, generated: row.o_generated, skipped: row.o_skipped, regenerate },
    });

    return {
      success: true,
      result: {
        total_scenarios: row.o_total_scenarios,
        generated: row.o_generated,
        skipped: row.o_skipped,
      },
    };
  } catch (error) {
    console.error('Generate scenario matrix error:', error);
    return { success: false, error: 'Failed to generate scenario matrix' };
  }
}

export async function listCampaignScenarios(
  campaignId: number,
  isActive?: boolean,
  limit: number = 200,
  offset: number = 0
): Promise<CampaignScenariosResult> {
  try {
    await requireCapability('run.read');

    const result = await invokeProc('sp_campaign_scenarios_list', {
      i_campaign_id: campaignId,
      i_is_active: isActive !== undefined ? isActive : null,
      i_limit: limit,
      i_offset: offset,
    });

    const scenarios: CampaignScenario[] = result.map((row: {
      o_id: number;
      o_campaign_id: number;
      o_persona_id: number | null;
      o_device_profile_id: number | null;
      o_network_profile_id: number | null;
      o_browser_type: string | null;
      o_payment_scenario_id: number | null;
      o_email_provider_id: number | null;
      o_flow_type: string | null;
      o_scenario_hash: string;
      o_is_active: boolean;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      campaign_id: row.o_campaign_id,
      persona_id: row.o_persona_id,
      device_profile_id: row.o_device_profile_id,
      network_profile_id: row.o_network_profile_id,
      browser_type: row.o_browser_type,
      payment_scenario_id: row.o_payment_scenario_id,
      email_provider_id: row.o_email_provider_id,
      flow_type: row.o_flow_type,
      scenario_hash: row.o_scenario_hash,
      is_active: row.o_is_active,
      created_date: row.o_created_date,
    }));

    return { success: true, scenarios };
  } catch (error) {
    console.error('List campaign scenarios error:', error);
    return { success: false, error: 'Failed to list campaign scenarios' };
  }
}

// ─── Campaign Executions ──────────────────────────────────────────────────────

export async function createCampaignExecution(
  campaignId: number,
  executionType: 'manual' | 'scheduled' | 'webhook'
): Promise<{ success: boolean; executionId?: number; error?: string }> {
  try {
    const authContext = await requireCapability('run.execute');

    const result = await invokeProcWrite('sp_campaign_executions_insert', {
      i_campaign_id: campaignId,
      i_run_id: null,
      i_execution_type: executionType,
      i_triggered_by: authContext.operatorId.toString(),
      i_triggered_by_operator_id: authContext.operatorId,
      i_approval_id: null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create execution' };
    }

    await logAudit({
      action: 'campaign.execute',
      target: `campaign:${campaignId}`,
      status: 'success',
      details: { executionType, executionId: result[0].o_id },
    });

    return { success: true, executionId: result[0].o_id };
  } catch (error) {
    console.error('Create campaign execution error:', error);
    return { success: false, error: 'Failed to create campaign execution' };
  }
}

export async function listCampaignExecutions(
  campaignId: number
): Promise<CampaignExecutionsResult> {
  try {
    await requireCapability('run.read');

    const result = await invokeProc('sp_campaign_executions_list', {
      i_campaign_id: campaignId,
      i_limit: 50,
      i_offset: 0,
    });

    const executions: CampaignExecution[] = result.map((row: {
      o_id: number;
      o_campaign_id: number;
      o_run_id: number | null;
      o_execution_type: string;
      o_triggered_by: string;
      o_status: string;
      o_total_scenarios: number;
      o_executed_scenarios: number;
      o_successful_scenarios: number;
      o_failed_scenarios: number;
      o_skipped_scenarios: number;
      o_started_at: string | null;
      o_completed_at: string | null;
      o_duration_seconds: number | null;
      o_error_message: string | null;
      o_created_date: string;
    }) => ({
      id: row.o_id,
      campaign_id: row.o_campaign_id,
      run_id: row.o_run_id,
      execution_type: row.o_execution_type,
      triggered_by: row.o_triggered_by,
      status: row.o_status as ExecutionStatus,
      total_scenarios: row.o_total_scenarios,
      executed_scenarios: row.o_executed_scenarios,
      successful_scenarios: row.o_successful_scenarios,
      failed_scenarios: row.o_failed_scenarios,
      skipped_scenarios: row.o_skipped_scenarios,
      started_at: row.o_started_at,
      completed_at: row.o_completed_at,
      duration_seconds: row.o_duration_seconds,
      error_message: row.o_error_message,
      created_date: row.o_created_date,
    }));

    return { success: true, executions };
  } catch (error) {
    console.error('List campaign executions error:', error);
    return { success: false, error: 'Failed to list campaign executions' };
  }
}

// ─── Campaign Schedules ───────────────────────────────────────────────────────

export async function createCampaignSchedule(
  campaignId: number,
  scheduleType: string,
  scheduleConfig?: Record<string, unknown>
): Promise<{ success: boolean; scheduleId?: number; error?: string }> {
  try {
    const authContext = await requireCapability('run.execute');

    const result = await invokeProcWrite('sp_campaign_schedules_insert', {
      i_campaign_id: campaignId,
      i_schedule_type: scheduleType,
      i_schedule_config: scheduleConfig ? JSON.stringify(scheduleConfig) : null,
      i_created_by: authContext.operatorId.toString(),
    });

    if (result.length === 0) {
      return { success: false, error: 'Failed to create schedule' };
    }

    await logAudit({
      action: 'campaign.schedule_create',
      target: `campaign:${campaignId}`,
      status: 'success',
      details: { scheduleType, scheduleId: result[0].o_id },
    });

    return { success: true, scheduleId: result[0].o_id };
  } catch (error) {
    console.error('Create campaign schedule error:', error);
    return { success: false, error: 'Failed to create campaign schedule' };
  }
}
