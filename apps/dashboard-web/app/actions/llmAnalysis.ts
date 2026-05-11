'use server';

/**
 * LLM Analysis Server Actions — Phase 8
 *
 * Fetches LLM analysis records for a given run execution.
 * Data is written by the /api/runner/callback route when it receives
 * an 'llm_analysis_result' payload from the runner's LLM post-step.
 *
 * Results are clearly labelled as advisory/AI-generated in the UI.
 */

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LlmAnalysisRecord {
  id: number;
  run_execution_id: number;
  task_type: 'selector_healing' | 'failure_summarization';
  model_used: string;
  status: 'pending' | 'completed' | 'error' | 'skipped';
  result_json: Record<string, unknown> | null;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  created_date: string;
  updated_date: string;
}

export interface LlmBenchmarkRecord {
  id: number;
  run_at: string;
  model_id: string;
  task_type: 'selector_healing' | 'failure_summarization';
  available: boolean;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  response_parseable: boolean | null;
  quality_score: number | null;
  error_message: string | null;
  created_date: string;
  updated_date: string;
}

export interface LlmBenchmarkRunSummary {
  run_at: string;
  model_count: number;
  avg_quality_score: number | null;
  min_latency_ms: number | null;
  max_latency_ms: number | null;
}

// ─── List LLM Analysis by Execution ──────────────────────────────────────────

export async function listLlmAnalysisByExecution(
  runExecutionId: number,
): Promise<{ success: boolean; records?: LlmAnalysisRecord[]; error?: string }> {
  try {
    await requireCapability('run.read');
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    type Row = {
      o_id: number;
      o_run_execution_id: number;
      o_task_type: 'selector_healing' | 'failure_summarization';
      o_model_used: string;
      o_status: 'pending' | 'completed' | 'error' | 'skipped';
      o_result_json: Record<string, unknown> | null;
      o_error_message: string | null;
      o_prompt_tokens: number | null;
      o_completion_tokens: number | null;
      o_duration_ms: number | null;
      o_created_date: string;
      o_updated_date: string;
    };

    const rows = (await invokeProc('sp_llm_analysis_list_by_execution', {
      i_run_execution_id: runExecutionId,
    })) as Row[];

    const records: LlmAnalysisRecord[] = rows.map((r) => ({
      id: r.o_id,
      run_execution_id: r.o_run_execution_id,
      task_type: r.o_task_type,
      model_used: r.o_model_used,
      status: r.o_status,
      result_json: r.o_result_json,
      error_message: r.o_error_message,
      prompt_tokens: r.o_prompt_tokens,
      completion_tokens: r.o_completion_tokens,
      duration_ms: r.o_duration_ms,
      created_date: new Date(r.o_created_date).toISOString(),
      updated_date: new Date(r.o_updated_date).toISOString(),
    }));

    return { success: true, records };
  } catch (err) {
    console.error('Failed to list LLM analysis records:', err);
    return { success: false, error: 'Failed to load LLM analysis records' };
  }
}

// ─── List Latest Benchmark Results ───────────────────────────────────────────

export async function listLatestBenchmarkResults(): Promise<{
  success: boolean;
  records?: LlmBenchmarkRecord[];
  error?: string;
}> {
  try {
    await requireCapability('run.read');
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    type Row = {
      o_id: number;
      o_run_at: string;
      o_model_id: string;
      o_task_type: 'selector_healing' | 'failure_summarization';
      o_available: boolean;
      o_latency_ms: number | null;
      o_prompt_tokens: number | null;
      o_completion_tokens: number | null;
      o_response_parseable: boolean | null;
      o_quality_score: number | null;
      o_error_message: string | null;
      o_created_date: string;
      o_updated_date: string;
    };

    const rows = (await invokeProc('sp_llm_benchmark_list_latest', {})) as Row[];

    const records: LlmBenchmarkRecord[] = rows.map((r) => ({
      id: r.o_id,
      run_at: new Date(r.o_run_at).toISOString(),
      model_id: r.o_model_id,
      task_type: r.o_task_type,
      available: r.o_available,
      latency_ms: r.o_latency_ms,
      prompt_tokens: r.o_prompt_tokens,
      completion_tokens: r.o_completion_tokens,
      response_parseable: r.o_response_parseable,
      quality_score: r.o_quality_score !== null ? Number(r.o_quality_score) : null,
      error_message: r.o_error_message,
      created_date: new Date(r.o_created_date).toISOString(),
      updated_date: new Date(r.o_updated_date).toISOString(),
    }));

    return { success: true, records };
  } catch (err) {
    console.error('Failed to list benchmark results:', err);
    return { success: false, error: 'Failed to load benchmark results' };
  }
}

// ─── List Benchmark Run History ───────────────────────────────────────────────

export async function listBenchmarkRunHistory(): Promise<{
  success: boolean;
  runs?: LlmBenchmarkRunSummary[];
  error?: string;
}> {
  try {
    await requireCapability('run.read');
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    type Row = {
      o_run_at: string;
      o_model_count: number;
      o_avg_quality_score: number | null;
      o_min_latency_ms: number | null;
      o_max_latency_ms: number | null;
    };

    const rows = (await invokeProc('sp_llm_benchmark_list_runs', {})) as Row[];

    const runs: LlmBenchmarkRunSummary[] = rows.map((r) => ({
      run_at: new Date(r.o_run_at).toISOString(),
      model_count: Number(r.o_model_count),
      avg_quality_score: r.o_avg_quality_score !== null ? Number(r.o_avg_quality_score) : null,
      min_latency_ms: r.o_min_latency_ms,
      max_latency_ms: r.o_max_latency_ms,
    }));

    return { success: true, runs };
  } catch (err) {
    console.error('Failed to list benchmark run history:', err);
    return { success: false, error: 'Failed to load benchmark history' };
  }
}

// ─── Store Benchmark Results ──────────────────────────────────────────────────

/**
 * Stores a complete benchmark run result in the DB.
 * Called from the /api/llm/benchmark route after the runner finishes benchmarking.
 */
export async function storeBenchmarkResults(
  runAt: string,
  probes: Array<{
    model_id: string;
    task_type: 'selector_healing' | 'failure_summarization';
    available: boolean;
    latency_ms?: number | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    response_parseable?: boolean | null;
    quality_score?: number | null;
    error_message?: string | null;
  }>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireCapability('run.manage');
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    for (const probe of probes) {
      await invokeProcWrite('sp_llm_benchmark_insert', {
        i_run_at: runAt,
        i_model_id: probe.model_id,
        i_task_type: probe.task_type,
        i_available: probe.available,
        i_latency_ms: probe.latency_ms ?? null,
        i_prompt_tokens: probe.prompt_tokens ?? null,
        i_completion_tokens: probe.completion_tokens ?? null,
        i_response_parseable: probe.response_parseable ?? null,
        i_quality_score: probe.quality_score ?? null,
        i_error_message: probe.error_message ?? null,
        i_created_by: 'system',
      });
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to store benchmark results:', err);
    return { success: false, error: 'Failed to store benchmark results' };
  }
}
