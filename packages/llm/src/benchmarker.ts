/**
 * Phase 8: Model Benchmarking
 *
 * Runs timed benchmark probes against all registered Ollama models for each
 * task type (selector_healing, failure_summarization). Produces a structured
 * BenchmarkRunResult that the dashboard can display and store in the DB.
 *
 * Quality scoring methodology:
 *  - selector_healing: checks that response contains "CANDIDATES:" section
 *    and at least one parseable candidate line.
 *  - failure_summarization: checks that response contains all required sections
 *    (EXECUTIVE_SUMMARY, ISSUES, RECOMMENDATIONS, PERSONA_NOTES, SEVERITY).
 *
 * The benchmarker never throws; individual probe failures are recorded with
 * success=false and zero scores.
 */

import { Logger } from '@qa-platform/shared-types';
import { generate, isModelAvailable } from './client.js';
import { parseSelectorCandidates } from './selector-healer.js';
import { parseSummaryResponse } from './failure-summarizer.js';
import type {
  ModelBenchmarkProbe,
  ModelBenchmarkResult,
  BenchmarkRunResult,
  LlmModelId,
  FailureSummarizationInput,
} from './types.js';
import { BENCHMARK_MODELS } from './types.js';

const logger = new Logger('llm-benchmarker');

// ─── Probe Prompts ────────────────────────────────────────────────────────────

/** Minimal but realistic prompt for selector healing probes */
const HEALING_PROBE_PROMPT = `You are a Playwright test automation expert. A selector failed to locate an element on the page.

Failed selector: button[type="submit"]
Action attempted: click
Page context: /register

HTML snippet around the expected element:
\`\`\`html
<form class="registration-form">
  <div class="form-row">
    <input type="email" id="email" name="email" placeholder="Email address" required />
  </div>
  <div class="form-row">
    <input type="password" id="password" name="password" placeholder="Password" required />
  </div>
  <div class="form-actions">
    <button class="btn btn-primary" data-testid="register-btn" aria-label="Create account">
      Create Account
    </button>
  </div>
</form>
\`\`\`

Suggest up to 3 alternative Playwright-compatible selectors that would match the intended element.
For each candidate provide a confidence score from 0.0 to 1.0.

Respond ONLY in this exact format:

CANDIDATES:
1. SELECTOR: <selector> | CONFIDENCE: <0.0-1.0> | RATIONALE: <brief reason>
2. SELECTOR: <selector> | CONFIDENCE: <0.0-1.0> | RATIONALE: <brief reason>
3. SELECTOR: <selector> | CONFIDENCE: <0.0-1.0> | RATIONALE: <brief reason>`;

/** Minimal but realistic failure summarization prompt */
const SUMMARY_PROBE_INPUT: FailureSummarizationInput = {
  execution_id: 0,
  persona_id: 'confident_desktop',
  persona_display_name: 'Alex, 35, tech-savvy desktop user',
  browser: 'chromium',
  flow_name: 'registration',
  site_name: 'Demo Site',
  overall_status: 'failed',
  friction_score: 0.45,
  steps: [
    { step_name: 'navigate_to_register', status: 'passed', duration_ms: 320 },
    { step_name: 'fill_email', status: 'passed', duration_ms: 210 },
    { step_name: 'fill_password', status: 'passed', duration_ms: 180 },
    { step_name: 'click_submit', status: 'failed', error_message: 'Element not found: button[type="submit"]', duration_ms: 5010 },
    { step_name: 'verify_confirmation', status: 'skipped', duration_ms: null },
  ],
  friction_signals: [
    { signal_type: 'repeated_click_on_element', count: 2, details: 'click_submit' },
  ],
};

function buildSummaryProbePrompt(input: FailureSummarizationInput): string {
  // Re-use the same prompt builder as the real summarizer (imports via dynamic approach)
  // but we inline the essential parts here to avoid circular imports.
  const stepLines = input.steps
    .map((s) => `  - ${s.step_name}: ${s.status}${s.error_message ? ` — "${s.error_message}"` : ''}`)
    .join('\n');

  return `You are a QA analyst writing a plain-English report about a website test session.

Execution Summary:
- Site: ${input.site_name}
- Flow: ${input.flow_name}
- Persona: ${input.persona_display_name}
- Browser: ${input.browser}
- Overall result: ${input.overall_status}
- Friction score: ${input.friction_score.toFixed(2)}

Step Results:
${stepLines}

Write a concise QA analysis in this EXACT format:

EXECUTIVE_SUMMARY:
<One paragraph summary.>

ISSUES:
1. <Issue>

RECOMMENDATIONS:
1. <Recommendation>

PERSONA_NOTES:
<One sentence about persona impact.>

SEVERITY: <critical|high|medium|low>`;
}

// ─── Quality Scoring ──────────────────────────────────────────────────────────

function scoreHealingResponse(rawText: string): number {
  if (!rawText.includes('CANDIDATES:')) return 0;
  const candidates = parseSelectorCandidates(rawText);
  if (candidates.length === 0) return 0.1;
  // More candidates with higher confidence = higher score
  const avgConfidence = candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length;
  const coverageBonus = Math.min(candidates.length / 3, 1) * 0.3;
  return Math.min(1, avgConfidence * 0.7 + coverageBonus);
}

function scoreSummaryResponse(rawText: string, input: FailureSummarizationInput): number {
  const requiredSections = ['EXECUTIVE_SUMMARY:', 'ISSUES:', 'RECOMMENDATIONS:', 'PERSONA_NOTES:', 'SEVERITY:'];
  const presentCount = requiredSections.filter((s) => rawText.includes(s)).length;
  if (presentCount === 0) return 0;

  const structureScore = presentCount / requiredSections.length;
  // Bonus for correctly parsed severity
  const summary = parseSummaryResponse(rawText, input);
  const hasSeverity = ['critical', 'high', 'medium', 'low'].includes(summary.severity);
  const hasIssues = summary.issues.length > 0 || input.steps.every((s) => s.status === 'passed');

  return Math.min(1, structureScore * 0.7 + (hasSeverity ? 0.15 : 0) + (hasIssues ? 0.15 : 0));
}

// ─── Probe Runner ─────────────────────────────────────────────────────────────

async function runHealingProbe(
  baseUrl: string,
  model: LlmModelId,
  timeoutMs = 30_000,
): Promise<ModelBenchmarkProbe> {
  const result = await generate(
    { base_url: baseUrl, timeout_ms: timeoutMs },
    { model, prompt: HEALING_PROBE_PROMPT, max_tokens: 256, temperature: 0.1, timeout_ms: timeoutMs },
  );

  const parseable = result.success && parseSelectorCandidates(result.response_text).length > 0;
  const quality = result.success ? scoreHealingResponse(result.response_text) : 0;

  return {
    model,
    task_type: 'selector_healing',
    success: result.success,
    latency_ms: result.total_duration_ms,
    prompt_tokens: result.prompt_tokens,
    completion_tokens: result.completion_tokens,
    response_parseable: parseable,
    quality_score: quality,
    error: result.error,
    raw_response: result.response_text.slice(0, 500),
  };
}

async function runSummaryProbe(
  baseUrl: string,
  model: LlmModelId,
  timeoutMs = 60_000,
): Promise<ModelBenchmarkProbe> {
  const prompt = buildSummaryProbePrompt(SUMMARY_PROBE_INPUT);

  const result = await generate(
    { base_url: baseUrl, timeout_ms: timeoutMs },
    { model, prompt, max_tokens: 512, temperature: 0.3, timeout_ms: timeoutMs },
  );

  const parseable = result.success && result.response_text.includes('EXECUTIVE_SUMMARY:');
  const quality = result.success ? scoreSummaryResponse(result.response_text, SUMMARY_PROBE_INPUT) : 0;

  return {
    model,
    task_type: 'failure_summarization',
    success: result.success,
    latency_ms: result.total_duration_ms,
    prompt_tokens: result.prompt_tokens,
    completion_tokens: result.completion_tokens,
    response_parseable: parseable,
    quality_score: quality,
    error: result.error,
    raw_response: result.response_text.slice(0, 500),
  };
}

// ─── Main Benchmark Run ───────────────────────────────────────────────────────

export interface BenchmarkOptions {
  /** Ollama base URL */
  base_url: string;
  /** Models to benchmark; defaults to BENCHMARK_MODELS */
  models?: LlmModelId[];
  /** Per-probe timeout in ms for healing probes */
  healing_timeout_ms?: number;
  /** Per-probe timeout in ms for summary probes */
  summary_timeout_ms?: number;
}

/**
 * Runs all benchmark probes and returns an aggregated BenchmarkRunResult.
 * Does not throw — individual model failures are recorded with success=false.
 */
export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkRunResult> {
  const modelsToTest = options.models ?? BENCHMARK_MODELS;
  const healingTimeout = options.healing_timeout_ms ?? 30_000;
  const summaryTimeout = options.summary_timeout_ms ?? 60_000;
  const runAt = new Date();

  logger.info(`Starting LLM benchmark — ${modelsToTest.length} model(s), base_url=${options.base_url}`);

  const modelResults: ModelBenchmarkResult[] = [];

  for (const model of modelsToTest) {
    logger.info(`Probing model: ${model}`);
    const available = await isModelAvailable(options.base_url, model);

    if (!available) {
      logger.warn(`Model ${model} not available in Ollama — skipping probes`);
      modelResults.push({
        model,
        available: false,
        probes: [],
        avg_latency_ms: 0,
        avg_quality_score: 0,
        recommended_for: [],
      });
      continue;
    }

    const [healingProbe, summaryProbe] = await Promise.all([
      runHealingProbe(options.base_url, model, healingTimeout),
      runSummaryProbe(options.base_url, model, summaryTimeout),
    ]);

    const probes = [healingProbe, summaryProbe];
    const successfulProbes = probes.filter((p) => p.success);
    const avgLatency = successfulProbes.length > 0
      ? successfulProbes.reduce((s, p) => s + p.latency_ms, 0) / successfulProbes.length
      : 0;
    const avgQuality = successfulProbes.length > 0
      ? successfulProbes.reduce((s, p) => s + p.quality_score, 0) / successfulProbes.length
      : 0;

    modelResults.push({
      model,
      available: true,
      probes,
      avg_latency_ms: Math.round(avgLatency),
      avg_quality_score: parseFloat(avgQuality.toFixed(3)),
      recommended_for: [],   // filled below
    });
  }

  // ─── Determine recommendations ─────────────────────────────────────────────
  const availableResults = modelResults.filter((r) => r.available && r.probes.length > 0);

  // Best healing model: parseable + lowest latency
  const healingCandidates = availableResults
    .filter((r) => r.probes.find((p) => p.task_type === 'selector_healing' && p.response_parseable))
    .sort((a, b) => {
      const la = a.probes.find((p) => p.task_type === 'selector_healing')?.latency_ms ?? Infinity;
      const lb = b.probes.find((p) => p.task_type === 'selector_healing')?.latency_ms ?? Infinity;
      return la - lb;
    });
  const recommendedHealingModel = healingCandidates[0]?.model ?? null;
  if (recommendedHealingModel) {
    const r = modelResults.find((m) => m.model === recommendedHealingModel);
    if (r) r.recommended_for.push('selector_healing');
  }

  // Best summary model: parseable + highest quality
  const summaryCandidates = availableResults
    .filter((r) => r.probes.find((p) => p.task_type === 'failure_summarization' && p.response_parseable))
    .sort((a, b) => {
      const qa = a.probes.find((p) => p.task_type === 'failure_summarization')?.quality_score ?? 0;
      const qb = b.probes.find((p) => p.task_type === 'failure_summarization')?.quality_score ?? 0;
      return qb - qa;
    });
  const recommendedSummaryModel = summaryCandidates[0]?.model ?? null;
  if (recommendedSummaryModel) {
    const r = modelResults.find((m) => m.model === recommendedSummaryModel);
    if (r && !r.recommended_for.includes('failure_summarization')) {
      r.recommended_for.push('failure_summarization');
    }
  }

  logger.info(
    `Benchmark complete — healing=${recommendedHealingModel ?? 'none'} summary=${recommendedSummaryModel ?? 'none'}`,
  );

  return {
    run_at: runAt,
    ollama_base_url: options.base_url,
    models: modelResults,
    recommended_healing_model: recommendedHealingModel,
    recommended_summary_model: recommendedSummaryModel,
  };
}
