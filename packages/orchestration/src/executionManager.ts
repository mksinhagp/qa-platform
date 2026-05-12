// Execution manager for Phase 20
import type { CampaignExecution, ExecutionStatus } from './types.js';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';

export interface CreateExecutionInput {
  campaignId: number;
  runId?: number;
  executionType: 'manual' | 'scheduled' | 'webhook';
  triggeredBy: string;
  triggeredByOperatorId?: number;
  approvalId?: number;
  createdBy: string;
}

export class ExecutionManager {
  /**
   * Create a new campaign execution
   */
  static async createExecution(input: CreateExecutionInput): Promise<CampaignExecution> {
    const result = await invokeProcWrite('sp_campaign_executions_insert', {
      i_campaign_id: input.campaignId,
      i_run_id: input.runId || null,
      i_execution_type: input.executionType,
      i_triggered_by: input.triggeredBy,
      i_triggered_by_operator_id: input.triggeredByOperatorId || null,
      i_approval_id: input.approvalId || null,
      i_created_by: input.createdBy
    });

    if (!result || result.length === 0) {
      throw new Error('Failed to create execution');
    }

    const row = result[0];
    return {
      id: row.o_id,
      campaignId: input.campaignId,
      runId: input.runId,
      executionType: input.executionType,
      triggeredBy: input.triggeredBy,
      triggeredByOperatorId: input.triggeredByOperatorId,
      status: row.o_status as ExecutionStatus,
      totalScenarios: 0,
      executedScenarios: 0,
      successfulScenarios: 0,
      failedScenarios: 0,
      skippedScenarios: 0,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date(row.o_created_date)
    };
  }

  /**
   * Update execution status
   */
  static async updateExecutionStatus(
    executionId: number,
    status: ExecutionStatus,
    metrics?: {
      totalScenarios?: number;
      executedScenarios?: number;
      successfulScenarios?: number;
      failedScenarios?: number;
      skippedScenarios?: number;
    },
    errorMessage?: string,
    updatedBy: string
  ): Promise<CampaignExecution> {
    const result = await invokeProcWrite('sp_campaign_executions_update_status', {
      i_id: executionId,
      i_status: status,
      i_total_scenarios: metrics?.totalScenarios || null,
      i_executed_scenarios: metrics?.executedScenarios || null,
      i_successful_scenarios: metrics?.successfulScenarios || null,
      i_failed_scenarios: metrics?.failedScenarios || null,
      i_skipped_scenarios: metrics?.skippedScenarios || null,
      i_error_message: errorMessage || null,
      i_updated_by: updatedBy
    });

    if (!result || result.length === 0) {
      throw new Error('Failed to update execution status');
    }

    const row = result[0];
    return {
      id: row.o_id,
      campaignId: 0,
      executionType: 'manual',
      triggeredBy: '',
      status: row.o_status as ExecutionStatus,
      totalScenarios: 0,
      executedScenarios: 0,
      successfulScenarios: 0,
      failedScenarios: 0,
      skippedScenarios: 0,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date(row.o_updated_date)
    };
  }

  /**
   * Start execution
   */
  static async startExecution(executionId: number, updatedBy: string): Promise<CampaignExecution> {
    return this.updateExecutionStatus(executionId, 'running', undefined, undefined, updatedBy);
  }

  /**
   * Complete execution
   */
  static async completeExecution(
    executionId: number,
    metrics: {
      totalScenarios: number;
      executedScenarios: number;
      successfulScenarios: number;
      failedScenarios: number;
      skippedScenarios: number;
    },
    updatedBy: string
  ): Promise<CampaignExecution> {
    return this.updateExecutionStatus(executionId, 'completed', metrics, undefined, updatedBy);
  }

  /**
   * Fail execution
   */
  static async failExecution(executionId: number, errorMessage: string, updatedBy: string): Promise<CampaignExecution> {
    return this.updateExecutionStatus(executionId, 'failed', undefined, errorMessage, updatedBy);
  }
}
