// Cleanup and retention jobs for Phase 19
import type { CleanupJob, TestDataLedgerEntry } from './types.js';
import { invokeProc, invokeProcWrite } from '@qa-platform/db';

export interface CleanupJobOptions {
  jobType: 'test_data' | 'artifacts' | 'expired_sessions' | 'payment_data';
  jobName: string;
  triggeredBy: 'system' | 'operator' | 'schedule';
  triggeredByOperatorId?: number;
  filters?: Record<string, unknown>;
  dryRun?: boolean;
  approvalId?: number;
  createdBy: string;
}

export interface CleanupResult {
  jobId: number;
  totalReviewed: number;
  totalEligible: number;
  totalDeleted: number;
  totalFailed: number;
  errors: string[];
}

export class CleanupJobManager {
  /**
   * Create a new cleanup job
   */
  static async createJob(options: CleanupJobOptions): Promise<number> {
    const result = await invokeProcWrite('sp_cleanup_jobs_insert', {
      i_job_type: options.jobType,
      i_job_name: options.jobName,
      i_triggered_by: options.triggeredBy,
      i_triggered_by_operator_id: options.triggeredByOperatorId || null,
      i_filters: options.filters || null,
      i_dry_run: options.dryRun || false,
      i_approval_id: options.approvalId || null,
      i_created_by: options.createdBy
    });

    if (!result || result.length === 0) {
      throw new Error('Failed to create cleanup job');
    }

    return result[0].o_id;
  }

  /**
   * Execute a cleanup job
   */
  static async executeJob(jobId: number): Promise<CleanupResult> {
    const result: CleanupResult = {
      jobId,
      totalReviewed: 0,
      totalEligible: 0,
      totalDeleted: 0,
      totalFailed: 0,
      errors: []
    };

    try {
      // Update job status to running
      await invokeProcWrite('sp_cleanup_jobs_update_status', {
        i_id: jobId,
        i_status: 'running',
        i_updated_by: 'system'
      });

      // Get job details
      const jobs = await invokeProc('sp_cleanup_jobs_list', {
        i_limit: 1
      });

      if (!jobs || jobs.length === 0) {
        throw new Error('Job not found');
      }

      const job = jobs[0];

      // Execute based on job type
      switch (job.o_job_type) {
        case 'test_data':
          await this.executeTestDataCleanup(job, result);
          break;
        case 'payment_data':
          await this.executePaymentDataCleanup(job, result);
          break;
        case 'artifacts':
          await this.executeArtifactsCleanup(job, result);
          break;
        default:
          throw new Error(`Unknown job type: ${job.o_job_type}`);
      }

      // Update job status to completed
      await invokeProcWrite('sp_cleanup_jobs_update_status', {
        i_id: jobId,
        i_status: 'completed',
        i_total_records_reviewed: result.totalReviewed,
        i_total_records_eligible: result.totalEligible,
        i_total_records_deleted: result.totalDeleted,
        i_total_records_failed: result.totalFailed,
        i_error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
        i_updated_by: 'system'
      });

      return result;
    } catch (error) {
      // Update job status to failed
      await invokeProcWrite('sp_cleanup_jobs_update_status', {
        i_id: jobId,
        i_status: 'failed',
        i_error_message: error instanceof Error ? error.message : 'Unknown error',
        i_updated_by: 'system'
      });

      throw error;
    }
  }

  private static async executeTestDataCleanup(job: any, result: CleanupResult): Promise<void> {
    // Get eligible test data ledger entries
    const filters = job.o_filters || {};
    const ledgerEntries = await invokeProc('sp_test_data_ledger_list', {
      i_cleanup_status: 'pending',
      i_is_cleanup_eligible: true,
      i_limit: 1000
    });

    result.totalReviewed = ledgerEntries.length;

    for (const entry of ledgerEntries) {
      try {
        // Check if entry is eligible for cleanup
        if (this.isEntryEligibleForCleanup(entry)) {
          result.totalEligible++;

          if (!job.o_dry_run) {
            // Perform actual cleanup
            await this.cleanupTestDataEntry(entry);
            result.totalDeleted++;
          }
        }
      } catch (error) {
        result.totalFailed++;
        result.errors.push(`Failed to cleanup entry ${entry.o_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private static async executePaymentDataCleanup(job: any, result: CleanupResult): Promise<void> {
    // Similar logic for payment data cleanup
    // This would clean up payment transactions, payment profiles, etc.
    // Implementation depends on specific payment data cleanup requirements
  }

  private static async executeArtifactsCleanup(job: any, result: CleanupResult): Promise<void> {
    // Similar logic for artifacts cleanup
    // This would clean up screenshots, videos, traces, etc.
    // Implementation depends on specific artifact cleanup requirements
  }

  private static isEntryEligibleForCleanup(entry: TestDataLedgerEntry): boolean {
    // Check if entry has expired
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      return true;
    }

    // Check if cleanup status is pending
    if (entry.cleanupStatus === 'pending') {
      return true;
    }

    return false;
  }

  private static async cleanupTestDataEntry(entry: TestDataLedgerEntry): Promise<void> {
    // Update cleanup status
    await invokeProcWrite('sp_test_data_ledger_update_cleanup_status', {
      i_ids: [entry.id],
      i_cleanup_status: 'cleanup_completed',
      i_updated_by: 'system'
    });

    // Perform actual data cleanup based on entity type
    // This would delete from the appropriate tables (test_accounts, test_identities, etc.)
    // Implementation depends on specific cleanup requirements
  }

  /**
   * Mark test data as eligible for cleanup
   */
  static async markDataForCleanup(runExecutionId: number): Promise<void> {
    // Update test_data_ledger to mark entries as eligible
    // This would typically be called after a run completes
    // Implementation would update is_cleanup_eligible flag
  }

  /**
   * Get cleanup job status
   */
  static async getJobStatus(jobId: number): Promise<CleanupJob | null> {
    const jobs = await invokeProc('sp_cleanup_jobs_list', {
      i_limit: 1
    });

    if (!jobs || jobs.length === 0) {
      return null;
    }

    const job = jobs[0];
    return {
      id: job.o_id,
      jobType: job.o_job_type,
      jobName: job.o_job_name,
      triggeredBy: job.o_triggered_by,
      triggeredByOperatorId: undefined,
      status: job.o_status,
      filters: undefined,
      dryRun: job.o_dry_run,
      totalRecordsReviewed: job.o_total_records_reviewed,
      totalRecordsEligible: job.o_total_records_eligible,
      totalRecordsDeleted: job.o_total_records_deleted,
      totalRecordsFailed: job.o_total_records_failed,
      startedAt: job.o_started_at ? new Date(job.o_started_at) : undefined,
      completedAt: job.o_completed_at ? new Date(job.o_completed_at) : undefined,
      errorMessage: undefined,
      approvalId: undefined,
      createdDate: new Date(job.o_created_date),
      updatedDate: new Date()
    };
  }
}
