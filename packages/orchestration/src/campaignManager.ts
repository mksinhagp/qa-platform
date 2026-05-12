// Campaign manager for Phase 20
import type { QaCampaign, CampaignScenario, MatrixGenerationResult } from './types.js';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';

export interface CreateCampaignInput {
  name: string;
  campaignType: 'smoke' | 'regression' | 'release_certification' | 'payment_certification' | 'accessibility_audit' | 'email_deliverability';
  description?: string;
  siteId?: number;
  siteEnvironmentId?: number;
  personaIds?: number[];
  deviceProfileIds?: number[];
  networkProfileIds?: number[];
  browserTypes?: string[];
  paymentScenarioIds?: number[];
  emailProviderIds?: number[];
  flowTypes?: string[];
  concurrencyCap?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  requiresApproval?: boolean;
  approvalPolicyId?: number;
  createdBy: string;
}

export class CampaignManager {
  /**
   * Create a new QA campaign
   */
  static async createCampaign(input: CreateCampaignInput): Promise<QaCampaign> {
    const result = await invokeProcWrite('sp_qa_campaigns_insert', {
      i_name: input.name,
      i_campaign_type: input.campaignType,
      i_description: input.description || null,
      i_site_id: input.siteId || null,
      i_site_environment_id: input.siteEnvironmentId || null,
      i_persona_ids: input.personaIds || null,
      i_device_profile_ids: input.deviceProfileIds || null,
      i_network_profile_ids: input.networkProfileIds || null,
      i_browser_types: input.browserTypes || null,
      i_payment_scenario_ids: input.paymentScenarioIds || null,
      i_email_provider_ids: input.emailProviderIds || null,
      i_flow_types: input.flowTypes || null,
      i_concurrency_cap: input.concurrencyCap || 5,
      i_retry_on_failure: input.retryOnFailure || false,
      i_max_retries: input.maxRetries || 1,
      i_requires_approval: input.requiresApproval || false,
      i_approval_policy_id: input.approvalPolicyId || null,
      i_created_by: input.createdBy
    });

    if (!result || result.length === 0) {
      throw new Error('Failed to create campaign');
    }

    const row = result[0];
    return {
      id: row.o_id,
      name: input.name,
      campaignType: input.campaignType,
      description: input.description,
      siteId: input.siteId,
      siteEnvironmentId: input.siteEnvironmentId,
      personaIds: input.personaIds,
      deviceProfileIds: input.deviceProfileIds,
      networkProfileIds: input.networkProfileIds,
      browserTypes: input.browserTypes,
      paymentScenarioIds: input.paymentScenarioIds,
      emailProviderIds: input.emailProviderIds,
      flowTypes: input.flowTypes,
      concurrencyCap: input.concurrencyCap || 5,
      retryOnFailure: input.retryOnFailure || false,
      maxRetries: input.maxRetries || 1,
      requiresApproval: input.requiresApproval || false,
      approvalPolicyId: input.approvalPolicyId,
      isActive: true,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date(row.o_created_date)
    };
  }

  /**
   * List QA campaigns
   */
  static async listCampaigns(
    campaignType?: string,
    siteId?: number,
    isActive?: boolean
  ): Promise<QaCampaign[]> {
    const result = await invokeProc('sp_qa_campaigns_list', {
      i_campaign_type: campaignType || null,
      i_site_id: siteId || null,
      i_is_active: isActive !== undefined ? isActive : null,
      i_limit: 100,
      i_offset: 0
    });

    if (!result || result.length === 0) {
      return [];
    }

    return result.map((row: any) => ({
      id: row.o_id,
      name: row.o_name,
      campaignType: row.o_campaign_type as any,
      description: row.o_description,
      siteId: row.o_site_id,
      siteEnvironmentId: row.o_site_environment_id,
      personaIds: undefined,
      deviceProfileIds: undefined,
      networkProfileIds: undefined,
      browserTypes: undefined,
      paymentScenarioIds: undefined,
      emailProviderIds: undefined,
      flowTypes: undefined,
      concurrencyCap: row.o_concurrency_cap,
      retryOnFailure: false,
      maxRetries: 1,
      requiresApproval: row.o_requires_approval,
      approvalPolicyId: undefined,
      isActive: row.o_is_active,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date(row.o_created_date)
    }));
  }

  /**
   * Get campaign by ID
   */
  static async getCampaign(id: number): Promise<QaCampaign | null> {
    const result = await invokeProc('sp_qa_campaigns_get_by_id', {
      i_id: id
    });

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.o_id,
      name: row.o_name,
      campaignType: row.o_campaign_type as any,
      description: row.o_description,
      siteId: row.o_site_id,
      siteEnvironmentId: row.o_site_environment_id,
      personaIds: row.o_persona_ids,
      deviceProfileIds: row.o_device_profile_ids,
      networkProfileIds: row.o_network_profile_ids,
      browserTypes: row.o_browser_types,
      paymentScenarioIds: row.o_payment_scenario_ids,
      emailProviderIds: row.o_email_provider_ids,
      flowTypes: row.o_flow_types,
      concurrencyCap: row.o_concurrency_cap,
      retryOnFailure: row.o_retry_on_failure,
      maxRetries: row.o_max_retries,
      requiresApproval: row.o_requires_approval,
      approvalPolicyId: row.o_approval_policy_id,
      isActive: row.o_is_active,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date(row.o_updated_date)
    };
  }

  /**
   * Generate scenario matrix for a campaign
   */
  static async generateScenarioMatrix(
    campaignId: number,
    regenerate: boolean = false
  ): Promise<MatrixGenerationResult> {
    const result = await invokeProcWrite('sp_campaign_scenarios_generate_matrix', {
      i_campaign_id: campaignId,
      i_regenerate: regenerate
    });

    if (!result || result.length === 0) {
      throw new Error('Failed to generate scenario matrix');
    }

    const row = result[0];
    return {
      totalScenarios: row.o_total_scenarios,
      generated: row.o_generated,
      skipped: row.o_skipped,
      scenarios: []
    };
  }

  /**
   * List campaign scenarios
   */
  static async listCampaignScenarios(
    campaignId: number,
    isActive?: boolean
  ): Promise<CampaignScenario[]> {
    const result = await invokeProc('sp_campaign_scenarios_list', {
      i_campaign_id: campaignId,
      i_is_active: isActive !== undefined ? isActive : null,
      i_limit: 1000,
      i_offset: 0
    });

    if (!result || result.length === 0) {
      return [];
    }

    return result.map((row: any) => ({
      id: row.o_id,
      campaignId: row.o_campaign_id,
      personaId: row.o_persona_id,
      deviceProfileId: row.o_device_profile_id,
      networkProfileId: row.o_network_profile_id,
      browserType: row.o_browser_type,
      paymentScenarioId: row.o_payment_scenario_id,
      emailProviderId: row.o_email_provider_id,
      flowType: row.o_flow_type,
      scenarioHash: row.o_scenario_hash,
      isActive: row.o_is_active,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date(row.o_created_date)
    }));
  }
}
