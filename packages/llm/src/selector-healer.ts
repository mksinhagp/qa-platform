/**
 * Phase 8: Selector Healing
 *
 * When a Playwright selector fails during a flow, this module asks the LLM to
 * analyze the surrounding HTML and suggest alternative selectors that are more
 * likely to match the intended element.
 *
 * The module is intentionally fast-path:
 *  - Uses a "fast" model (phi3:mini or qwen2.5:7b) to minimize runner latency.
 *  - Hard-caps the HTML snippet at 4 000 chars so context fits in the prompt.
 *  - Parses candidates from a structured section format; falls back gracefully.
 *  - Never throws — always returns a result with success=false if unavailable.
 */

import type { OllamaClient } from './client.js';
import type {
  SelectorHealingInput,
  SelectorHealingResult,
  SelectorCandidate,
  LlmModelId,
} from './types.js';
import { LLM_MODELS } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HTML_CHARS = 4_000;
const MAX_CANDIDATES = 5;
const HEALING_TIMEOUT_MS = 15_000;
const HEALING_MAX_TOKENS = 512;

/** Preferred models for selector healing (ordered by preference) */
const HEALING_MODEL_PREFERENCE: LlmModelId[] = [
  LLM_MODELS.PHI3_MINI,
  LLM_MODELS.QWEN25_7B,
  LLM_MODELS.LLAMA31_8B,
];

// ─── Prompt Template ──────────────────────────────────────────────────────────

function buildHealingPrompt(input: SelectorHealingInput): string {
  const htmlSnippet = input.html_snippet.slice(0, MAX_HTML_CHARS);
  const actionLine = input.action ? `\nAction attempted: ${input.action}` : '';
  const contextLine = input.page_context ? `\nPage context: ${input.page_context}` : '';

  return `You are a Playwright test automation expert. A selector failed to locate an element on the page.

Failed selector: ${input.failed_selector}${actionLine}${contextLine}

HTML snippet around the expected element:
\`\`\`html
${htmlSnippet}
\`\`\`

Suggest up to ${MAX_CANDIDATES} alternative Playwright-compatible selectors that would match the intended element.
For each candidate provide a confidence score from 0.0 to 1.0.

Respond ONLY in this exact format (no extra text before or after):

CANDIDATES:
1. SELECTOR: <selector> | CONFIDENCE: <0.0-1.0> | RATIONALE: <brief reason>
2. SELECTOR: <selector> | CONFIDENCE: <0.0-1.0> | RATIONALE: <brief reason>
3. SELECTOR: <selector> | CONFIDENCE: <0.0-1.0> | RATIONALE: <brief reason>

Rules:
- Prefer getByRole, getByText, getByLabel, getByTestId over raw CSS
- Use data-testid attributes when present
- Order candidates from highest to lowest confidence
- Keep selectors concise and robust to minor DOM changes`;
}

// ─── Response Parser ──────────────────────────────────────────────────────────

const CANDIDATE_LINE_RE = /^\d+\.\s+SELECTOR:\s*(.+?)\s*\|\s*CONFIDENCE:\s*([\d.]+)\s*\|\s*RATIONALE:\s*(.+)$/;

/**
 * Parses the structured CANDIDATES block from the LLM response.
 * Returns an empty array on any parse failure (caller handles gracefully).
 */
export function parseSelectorCandidates(rawText: string): SelectorCandidate[] {
  // Use [1] (first split after the marker) rather than .pop() so that if the
  // LLM repeats the literal "CANDIDATES:" inside a rationale the parser does
  // not silently discard all earlier candidates.
  const candidatesSection = rawText.split('CANDIDATES:')[1] ?? '';
  const lines = candidatesSection.split('\n').map((l) => l.trim()).filter(Boolean);

  const candidates: SelectorCandidate[] = [];
  for (const line of lines) {
    const match = CANDIDATE_LINE_RE.exec(line);
    if (!match) continue;
    const [, selector, confidenceStr, rationale] = match;
    const confidence = Math.min(1, Math.max(0, parseFloat(confidenceStr ?? '0') || 0));
    if (selector && rationale) {
      candidates.push({ selector: selector.trim(), confidence, rationale: rationale.trim() });
    }
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  // Sort descending by confidence
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Attempts to heal a failed selector using the LLM.
 *
 * @param client   - Initialized OllamaClient
 * @param input    - The failed selector and surrounding HTML context
 * @param modelOverride - Force a specific model (otherwise uses preference order)
 */
export async function healSelector(
  client: OllamaClient,
  input: SelectorHealingInput,
  modelOverride?: LlmModelId,
): Promise<SelectorHealingResult> {
  const model = modelOverride ?? HEALING_MODEL_PREFERENCE[0] ?? LLM_MODELS.PHI3_MINI;
  const prompt = buildHealingPrompt(input);

  const llmCall = await client.generate({
    model,
    prompt,
    max_tokens: HEALING_MAX_TOKENS,
    temperature: 0.1,   // low temperature for deterministic selector suggestions
    timeout_ms: HEALING_TIMEOUT_MS,
  });

  const candidates = llmCall.success ? parseSelectorCandidates(llmCall.response_text) : [];

  return {
    input,
    candidates,
    model_used: model,
    llm_call: llmCall,
    raw_response: llmCall.response_text,
  };
}

// ─── Re-export ─────────────────────────────────────────────────────────────────

export { HEALING_MODEL_PREFERENCE };
