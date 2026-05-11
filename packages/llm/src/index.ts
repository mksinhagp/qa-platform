/**
 * Phase 8: @qa-platform/llm — Ollama integration barrel
 *
 * Exports:
 *  - Types (all LLM interfaces)
 *  - OllamaClient + factory
 *  - Selector healing
 *  - Failure summarization
 *  - Model benchmarking
 */

// Types
export type {
  LlmModelId,
  LlmTaskType,
  OllamaClientConfig,
  OllamaGenerateOptions,
  LlmCallResult,
  SelectorHealingInput,
  SelectorHealingResult,
  SelectorCandidate,
  StepSummaryInput,
  FrictionSignalInput,
  FailureSummarizationInput,
  FailureSummarizationResult,
  FailureSummary,
  ModelBenchmarkProbe,
  ModelBenchmarkResult,
  BenchmarkRunResult,
  LlmAnalysisRecord,
  LlmBenchmarkRecord,
} from './types.js';

export { LLM_MODELS, BENCHMARK_MODELS } from './types.js';

// Client
export { OllamaClient, generate, createClientFromEnv, listAvailableModels, isModelAvailable } from './client.js';

// Selector healing
export { healSelector, parseSelectorCandidates, HEALING_MODEL_PREFERENCE } from './selector-healer.js';

// Failure summarization
export { summarizeFailure, parseSummaryResponse, SUMMARY_MODEL_PREFERENCE } from './failure-summarizer.js';

// Benchmarking
export { runBenchmark } from './benchmarker.js';
export type { BenchmarkOptions } from './benchmarker.js';
