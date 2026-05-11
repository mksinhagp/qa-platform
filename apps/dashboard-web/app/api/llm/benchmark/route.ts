/**
 * POST /api/llm/benchmark
 *
 * Triggers an LLM model benchmark run against the configured Ollama instance.
 * Runs probes for all BENCHMARK_MODELS × both task types.
 *
 * Returns the probe results as JSON; the client is responsible for calling
 * storeBenchmarkResults() to persist them to the DB.
 *
 * Authentication: requires an active session with run.manage capability.
 * Ollama URL: read from OLLAMA_BASE_URL env var (server-side only).
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@qa-platform/auth';
import { runBenchmark, BENCHMARK_MODELS } from '@qa-platform/llm';

export async function POST() {
  try {
    await requireCapability('run.manage');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env['OLLAMA_BASE_URL'];
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'OLLAMA_BASE_URL is not configured. Start the platform with the llm Compose profile.' },
      { status: 503 },
    );
  }

  try {
    const result = await runBenchmark({
      base_url: baseUrl,
      models: BENCHMARK_MODELS,
      healing_timeout_ms: 30_000,
      summary_timeout_ms: 60_000,
    });

    // Probe row shape — nullable numerics/booleans to accommodate unavailable models
    type ProbeRow = {
      model_id: string;
      task_type: string;
      available: boolean;
      latency_ms: number | null;
      prompt_tokens: number | null;
      completion_tokens: number | null;
      response_parseable: boolean | null;
      quality_score: number | null;
      error_message: string | null;
    };

    // Flatten model results into probe rows the client can store
    const probes: ProbeRow[] = result.models.flatMap(model =>
      model.probes.map(probe => ({
        model_id: probe.model,
        task_type: probe.task_type,
        available: model.available,
        latency_ms: probe.latency_ms,
        prompt_tokens: probe.prompt_tokens,
        completion_tokens: probe.completion_tokens,
        response_parseable: probe.response_parseable,
        quality_score: probe.quality_score,
        error_message: probe.error ?? null,
      })),
    );

    // Add unavailable-model stubs so every model is represented in the DB
    for (const model of result.models) {
      if (!model.available) {
        for (const taskType of ['selector_healing', 'failure_summarization'] as const) {
          probes.push({
            model_id: model.model,
            task_type: taskType,
            available: false,
            latency_ms: null,
            prompt_tokens: null,
            completion_tokens: null,
            response_parseable: null,
            quality_score: null,
            error_message: 'Model not available in Ollama',
          });
        }
      }
    }

    return NextResponse.json({
      run_at: result.run_at.toISOString(),
      recommended_healing_model: result.recommended_healing_model,
      recommended_summary_model: result.recommended_summary_model,
      probes,
    });
  } catch (err) {
    console.error('LLM benchmark error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Benchmark failed' },
      { status: 500 },
    );
  }
}
