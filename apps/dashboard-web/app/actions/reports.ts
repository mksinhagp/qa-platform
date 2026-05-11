'use server';

import { invokeProc } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import type {
  PersonaSummary,
  AccessibilitySummary,
  DeduplicatedIssue,
  FrictionSignalAggregate,
  ExecutionDetail,
  RunSummary,
  NarrativeReport,
} from '@qa-platform/shared-types';
import { listLlmAnalysisByExecution, type LlmAnalysisRecord } from './llmAnalysis';

// Re-export types so callers can import them directly from this action module
export type {
  PersonaSummary,
  AccessibilitySummary,
  DeduplicatedIssue,
  FrictionSignalAggregate,
  ExecutionDetail,
  RunSummary,
  NarrativeReport,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Run Summary ─────────────────────────────────────────────────────────────

export async function getRunSummary(
  runId: number
): Promise<ReportActionResult<RunSummary>> {
  try {
    const result = await invokeProc('sp_report_run_summary', { i_run_id: runId });
    
    if (!result || result.length === 0) {
      return { success: false, error: 'Run not found' };
    }

    const summary = result[0] as RunSummary;
    return { success: true, data: summary };
  } catch (error) {
    console.error('Error fetching run summary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch run summary' 
    };
  }
}

// ─── Persona Summaries ─────────────────────────────────────────────────────────

export async function getPersonaSummaries(
  runId: number
): Promise<ReportActionResult<PersonaSummary[]>> {
  try {
    const result = await invokeProc('sp_report_persona_summary', { i_run_id: runId });
    
    if (!result) {
      return { success: false, error: 'Failed to fetch persona summaries' };
    }

    return { success: true, data: result as PersonaSummary[] };
  } catch (error) {
    console.error('Error fetching persona summaries:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch persona summaries' 
    };
  }
}

// ─── Accessibility Summary ────────────────────────────────────────────────────

export async function getAccessibilitySummary(
  runId: number
): Promise<ReportActionResult<AccessibilitySummary>> {
  try {
    const result = await invokeProc('sp_report_accessibility_summary', { i_run_id: runId });
    
    if (!result || result.length === 0) {
      return { success: false, error: 'Failed to fetch accessibility summary' };
    }

    const summary = result[0] as AccessibilitySummary;
    return { success: true, data: summary };
  } catch (error) {
    console.error('Error fetching accessibility summary:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch accessibility summary' 
    };
  }
}

// ─── Deduplicated Issues ─────────────────────────────────────────────────────

export async function getDeduplicatedIssues(
  runId: number
): Promise<ReportActionResult<DeduplicatedIssue[]>> {
  try {
    const result = await invokeProc('sp_report_issues_deduplicated', { i_run_id: runId });
    
    if (!result) {
      return { success: false, error: 'Failed to fetch issues' };
    }

    return { success: true, data: result as DeduplicatedIssue[] };
  } catch (error) {
    console.error('Error fetching deduplicated issues:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch issues' 
    };
  }
}

// ─── Friction Signals ────────────────────────────────────────────────────────

export async function getFrictionSignals(
  runId: number
): Promise<ReportActionResult<FrictionSignalAggregate[]>> {
  try {
    const result = await invokeProc('sp_report_friction_signals', { i_run_id: runId });
    
    if (!result) {
      return { success: false, error: 'Failed to fetch friction signals' };
    }

    return { success: true, data: result as FrictionSignalAggregate[] };
  } catch (error) {
    console.error('Error fetching friction signals:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch friction signals' 
    };
  }
}

// ─── Execution Detail ─────────────────────────────────────────────────────────

export async function getExecutionDetail(
  executionId: number
): Promise<ReportActionResult<ExecutionDetail[]>> {
  try {
    const result = await invokeProc('sp_report_execution_detail', { i_execution_id: executionId });
    
    if (!result) {
      return { success: false, error: 'Failed to fetch execution detail' };
    }

    return { success: true, data: result as ExecutionDetail[] };
  } catch (error) {
    console.error('Error fetching execution detail:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch execution detail' 
    };
  }
}

// ─── Complete Narrative Report ────────────────────────────────────────────────

export async function getNarrativeReport(
  runId: number
): Promise<ReportActionResult<NarrativeReport>> {
  try {
    const [summaryRes, personasRes, accessibilityRes, issuesRes, frictionRes] = 
      await Promise.all([
        getRunSummary(runId),
        getPersonaSummaries(runId),
        getAccessibilitySummary(runId),
        getDeduplicatedIssues(runId),
        getFrictionSignals(runId),
      ]);

    if (!summaryRes.success || !summaryRes.data) {
      return { success: false, error: 'Failed to fetch run summary' };
    }

    if (!personasRes.success) {
      return { success: false, error: 'Failed to fetch persona summaries' };
    }

    if (!accessibilityRes.success || !accessibilityRes.data) {
      return { success: false, error: 'Failed to fetch accessibility summary' };
    }

    if (!issuesRes.success) {
      return { success: false, error: 'Failed to fetch issues' };
    }

    if (!frictionRes.success) {
      return { success: false, error: 'Failed to fetch friction signals' };
    }

    const report: NarrativeReport = {
      run_summary: summaryRes.data,
      persona_summaries: personasRes.data || [],
      accessibility_summary: accessibilityRes.data,
      issues: issuesRes.data || [],
      friction_signals: frictionRes.data || [],
    };

    return { success: true, data: report };
  } catch (error) {
    console.error('Error fetching narrative report:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch narrative report' 
    };
  }
}

// ─── LLM Analysis for Run ─────────────────────────────────────────────────────

export async function getLlmAnalysisForRun(
  runId: number
): Promise<ReportActionResult<LlmAnalysisRecord[]>> {
  try {
    // First get all executions for the run
    // We'll need to query run_executions to get execution IDs
    const executions = await invokeProc('sp_run_executions_list', { i_run_id: runId });
    
    if (!executions || executions.length === 0) {
      return { success: true, data: [] };
    }

    const executionIds = executions.map((e: any) => e.id);
    
    // Fetch LLM analysis for each execution
    const analysisPromises = executionIds.map(async (execId: number) => {
      const result = await listLlmAnalysisByExecution(execId);
      return result.success ? result.records || [] : [];
    });

    const allAnalysis = await Promise.all(analysisPromises);
    const flattenedAnalysis = allAnalysis.flat();

    return { success: true, data: flattenedAnalysis as LlmAnalysisRecord[] };
  } catch (error) {
    console.error('Error fetching LLM analysis:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch LLM analysis' 
    };
  }
}
