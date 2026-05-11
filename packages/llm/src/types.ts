/**
 * Phase 8: LLM Integration — Shared Types
 *
 * Defines all interfaces for the Ollama client, prompt registry,
 * selector healing, failure summarization, and model benchmarking.
 *
 * Design principles:
 *  - All LLM output is advisory only; clearly labelled in the UI.
 *  - No secret values, credentials, or PII flow into prompts.
 *  - Every LLM call is bounded: max_tokens cap, timeout, and fallback.
 *  - Results are stored in the DB so the UI can show them without re-querying Ollama.
 */

// ─── Model Registry ───────────────────────────────────────────────────────────

/**
 * Canonical model identifiers supported by this platform.
 * "fast" models are used for selector healing (low latency required).
 * "deep" models are used for failure summarization (quality preferred).
 */
export const LLM_MODELS = {
  // Fast models — suitable for real-time selector healing
  PHI3_MINI: 'phi3:mini',
  QWEN25_7B: 'qwen2.5:7b',
  LLAMA31_8B: 'llama3.1:8b',
  // Deep model — suitable for narrative failure summarization
  QWEN25_14B: 'qwen2.5:14b',
} as const;

export type LlmModelId = (typeof LLM_MODELS)[keyof typeof LLM_MODELS];

/** All model IDs used in benchmarking (defined order: fast → deep) */
export const BENCHMARK_MODELS: LlmModelId[] = [
  LLM_MODELS.PHI3_MINI,
  LLM_MODELS.QWEN25_7B,
  LLM_MODELS.LLAMA31_8B,
  LLM_MODELS.QWEN25_14B,
];

// ─── Task Types ───────────────────────────────────────────────────────────────

/**
 * The two task categories the LLM performs in v1.
 * Benchmarking exercises both task types on every registered model.
 */
export type LlmTaskType = 'selector_healing' | 'failure_summarization';

// ─── Ollama Client ────────────────────────────────────────────────────────────

/** Raw response from the Ollama /api/generate endpoint */
export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;   // nanoseconds
  load_duration?: number;    // nanoseconds
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;    // nanoseconds
}

/** Configuration for the Ollama HTTP client */
export interface OllamaClientConfig {
  /** Base URL of the Ollama service, e.g. http://localhost:11434 */
  base_url: string;
  /** Default timeout for generate calls in milliseconds (default: 60 000) */
  timeout_ms?: number;
  /** Default model to use if not specified per-call */
  default_model?: LlmModelId;
}

/** Options for a single generate call */
export interface OllamaGenerateOptions {
  model: LlmModelId;
  prompt: string;
  /** Hard cap on output tokens (default: 1 024) */
  max_tokens?: number;
  /** Temperature 0..1 (default: 0.2 for deterministic QA output) */
  temperature?: number;
  /** Per-call timeout override in milliseconds */
  timeout_ms?: number;
}

/** Normalized result returned from the client wrapper */
export interface LlmCallResult {
  model: LlmModelId;
  response_text: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_duration_ms: number;
  /** True if the call completed within the timeout with a non-empty response */
  success: boolean;
  /** Set when success=false */
  error?: string;
}

// ─── Selector Healing ─────────────────────────────────────────────────────────

/**
 * Input to the selector-healing prompt.
 * The HTML snippet must be pre-sanitized (no passwords, no tokens).
 */
export interface SelectorHealingInput {
  /** The original selector that failed (CSS or Playwright locator expression) */
  failed_selector: string;
  /** Trimmed HTML surrounding the element that could not be located */
  html_snippet: string;
  /** Optional: the action that was attempted (click, fill, etc.) */
  action?: string;
  /** Optional: page title or URL path for context */
  page_context?: string;
}

/** A single candidate alternative selector suggested by the LLM */
export interface SelectorCandidate {
  /** Proposed selector string */
  selector: string;
  /** LLM-provided rationale for this candidate */
  rationale: string;
  /** Confidence 0..1 as parsed from the LLM response */
  confidence: number;
}

/** Full result from the selector-healing module */
export interface SelectorHealingResult {
  input: SelectorHealingInput;
  candidates: SelectorCandidate[];
  model_used: LlmModelId;
  llm_call: LlmCallResult;
  /** Raw LLM text (kept for debugging; not shown in normal UI) */
  raw_response: string;
}

// ─── Failure Summarization ────────────────────────────────────────────────────

/** A minimal step record passed into the summarizer (subset of full step data) */
export interface StepSummaryInput {
  step_name: string;
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'skipped_by_approval';
  error_message?: string | null;
  duration_ms?: number | null;
}

/** Friction signal record (mirroring the DB shape) */
export interface FrictionSignalInput {
  signal_type: string;
  count: number;
  details?: string | null;
}

/** Complete input to the failure-summarization prompt */
export interface FailureSummarizationInput {
  execution_id: number;
  persona_id: string;
  persona_display_name: string;
  browser: string;
  flow_name: string;
  site_name: string;
  overall_status: string;
  friction_score: number;
  steps: StepSummaryInput[];
  friction_signals: FrictionSignalInput[];
}

/** Structured output from failure summarization */
export interface FailureSummary {
  /** One-paragraph plain-English summary for non-technical stakeholders */
  executive_summary: string;
  /** Ordered list of specific issues found */
  issues: string[];
  /** Recommended actions for the development team */
  recommendations: string[];
  /** Persona-specific observations (accessibility, friction, etc.) */
  persona_notes: string;
  /** Severity: critical | high | medium | low */
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/** Full result from the failure-summarization module */
export interface FailureSummarizationResult {
  input: FailureSummarizationInput;
  summary: FailureSummary;
  model_used: LlmModelId;
  llm_call: LlmCallResult;
  raw_response: string;
}

// ─── Benchmarking ─────────────────────────────────────────────────────────────

/** Result of a single model benchmark probe for one task type */
export interface ModelBenchmarkProbe {
  model: LlmModelId;
  task_type: LlmTaskType;
  success: boolean;
  /** Latency from first-byte to complete response */
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  /** Whether the response was structurally parseable (correct JSON / section markers) */
  response_parseable: boolean;
  /** 0..1 quality score (heuristic; see benchmarker.ts for methodology) */
  quality_score: number;
  error?: string;
  raw_response?: string;
}

/** Aggregated benchmark result for a single model across all task types */
export interface ModelBenchmarkResult {
  model: LlmModelId;
  /** Whether the model is currently available in Ollama (pulled) */
  available: boolean;
  probes: ModelBenchmarkProbe[];
  avg_latency_ms: number;
  avg_quality_score: number;
  /** Recommended model designation based on results */
  recommended_for: LlmTaskType[];
}

/** Full benchmark run result */
export interface BenchmarkRunResult {
  run_at: Date;
  ollama_base_url: string;
  models: ModelBenchmarkResult[];
  /** Model recommended for selector_healing (lowest latency + parseable) */
  recommended_healing_model: LlmModelId | null;
  /** Model recommended for failure_summarization (highest quality) */
  recommended_summary_model: LlmModelId | null;
}

// ─── DB Storage Types ─────────────────────────────────────────────────────────

/** Row shape for llm_analysis_results table */
export interface LlmAnalysisRecord {
  id: number;
  run_execution_id: number;
  task_type: LlmTaskType;
  model_used: LlmModelId;
  status: 'pending' | 'completed' | 'error' | 'skipped';
  /** JSON-serialized result (FailureSummary or SelectorHealingResult) */
  result_json: Record<string, unknown> | null;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  created_date: string;
  updated_date: string;
}

/** Row shape for llm_benchmark_results table */
export interface LlmBenchmarkRecord {
  id: number;
  run_at: string;
  model_id: string;
  task_type: LlmTaskType;
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
