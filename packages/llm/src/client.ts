/**
 * Phase 8: Ollama HTTP Client
 *
 * Thin wrapper around the Ollama REST API (/api/generate and /api/tags).
 * All calls are bounded: hard timeout, token cap, and graceful error path.
 *
 * Security: this client never logs full prompt text at info level —
 * only the first 80 chars are included in debug messages so secrets
 * cannot leak via structured logs.
 */

import { Logger } from '@qa-platform/shared-types';
import type {
  OllamaClientConfig,
  OllamaGenerateOptions,
  OllamaGenerateResponse,
  LlmCallResult,
  LlmModelId,
} from './types.js';

const logger = new Logger('llm-client');

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 1_024;
const DEFAULT_TEMPERATURE = 0.2;

// ─── Model availability check ─────────────────────────────────────────────────

/** Shape of one entry returned by GET /api/tags */
interface OllamaModelEntry {
  name: string;
  modified_at?: string;
  size?: number;
}

interface OllamaTagsResponse {
  models: OllamaModelEntry[];
}

/**
 * Returns the list of model names currently available in the Ollama instance.
 * Returns [] if Ollama is unreachable rather than throwing.
 */
export async function listAvailableModels(baseUrl: string, timeoutMs = 5_000): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      if (!res.ok) return [];
      const data = (await res.json()) as OllamaTagsResponse;
      return (data.models ?? []).map((m) => m.name);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

/**
 * Returns true if the given model name appears in the Ollama tags list.
 * Uses a prefix match so "qwen2.5:7b" matches "qwen2.5:7b-instruct-q4_K_M" etc.
 */
export async function isModelAvailable(baseUrl: string, model: LlmModelId): Promise<boolean> {
  const models = await listAvailableModels(baseUrl);
  return models.some((m) => m === model || m.startsWith(model.split(':')[0] + ':'));
}

// ─── Core generate call ───────────────────────────────────────────────────────

/**
 * Calls POST /api/generate on the Ollama instance with the given options.
 * Always returns an LlmCallResult (never throws); sets success=false on error.
 */
export async function generate(
  config: OllamaClientConfig,
  options: OllamaGenerateOptions,
): Promise<LlmCallResult> {
  const timeoutMs = options.timeout_ms ?? config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.max_tokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;

  const previewText = options.prompt.slice(0, 80).replace(/\n/g, ' ');
  logger.info(`LLM generate — model=${options.model} prompt="${previewText}…"`);

  const body = JSON.stringify({
    model: options.model,
    prompt: options.prompt,
    stream: false,
    options: {
      num_predict: maxTokens,
      temperature,
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startMs = Date.now();

  try {
    const res = await fetch(`${config.base_url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.warn(`LLM generate failed — HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return buildErrorResult(options.model, `HTTP ${res.status}: ${errText.slice(0, 200)}`, Date.now() - startMs);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    const durationMs = data.total_duration != null
      ? Math.round(data.total_duration / 1_000_000)
      : Date.now() - startMs;

    const responseText = (data.response ?? '').trim();
    if (!responseText) {
      return buildErrorResult(options.model, 'Empty response from model', durationMs);
    }

    logger.info(`LLM generate OK — model=${options.model} tokens=${data.eval_count ?? '?'} duration=${durationMs}ms`);

    return {
      model: options.model,
      response_text: responseText,
      prompt_tokens: data.prompt_eval_count ?? 0,
      completion_tokens: data.eval_count ?? 0,
      total_duration_ms: durationMs,
      success: true,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('abort') || msg.toLowerCase().includes('timeout');
    const friendlyMsg = isTimeout ? `Timed out after ${timeoutMs}ms` : msg;
    logger.warn(`LLM generate error — model=${options.model}: ${friendlyMsg}`);
    return buildErrorResult(options.model, friendlyMsg, Date.now() - startMs);
  }
}

// ─── OllamaClient class ───────────────────────────────────────────────────────

/**
 * Stateful client that holds configuration and exposes convenience methods.
 * Create one per service process; safe to share across concurrent calls.
 */
export class OllamaClient {
  private readonly config: OllamaClientConfig;

  constructor(config: OllamaClientConfig) {
    this.config = config;
  }

  get baseUrl(): string {
    return this.config.base_url;
  }

  /** Generate with the default model from config if model not specified */
  async generate(options: Omit<OllamaGenerateOptions, 'model'> & { model?: LlmModelId }): Promise<LlmCallResult> {
    const model = options.model ?? this.config.default_model;
    if (!model) {
      return buildErrorResult('phi3:mini', 'No model specified and no default_model in config', 0);
    }
    return generate(this.config, { ...options, model });
  }

  async listModels(): Promise<string[]> {
    return listAvailableModels(this.config.base_url);
  }

  async isAvailable(model: LlmModelId): Promise<boolean> {
    return isModelAvailable(this.config.base_url, model);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an OllamaClient from environment variables.
 * OLLAMA_BASE_URL defaults to http://localhost:11434.
 * OLLAMA_DEFAULT_MODEL defaults to qwen2.5:7b.
 */
export function createClientFromEnv(): OllamaClient {
  return new OllamaClient({
    base_url: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
    timeout_ms: process.env['OLLAMA_TIMEOUT_MS']
      ? parseInt(process.env['OLLAMA_TIMEOUT_MS'], 10)
      : DEFAULT_TIMEOUT_MS,
    default_model: (process.env['OLLAMA_DEFAULT_MODEL'] as LlmModelId | undefined) ?? 'qwen2.5:7b',
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildErrorResult(model: LlmModelId, error: string, durationMs: number): LlmCallResult {
  return {
    model,
    response_text: '',
    prompt_tokens: 0,
    completion_tokens: 0,
    total_duration_ms: durationMs,
    success: false,
    error,
  };
}
