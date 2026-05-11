/**
 * Phase 8: Failure Summarization
 *
 * After an execution completes with failures or friction signals, this module
 * asks the LLM to produce a human-readable narrative summary. The summary is:
 *
 *  - Persona-aware (references the persona's traits in the analysis).
 *  - Structured (executive summary + issues list + recommendations + severity).
 *  - Advisory only (clearly labelled as LLM-generated in the UI).
 *  - Non-blocking (the runner post-step fires and forgets; result stored async).
 *
 * Uses the deep model (qwen2.5:14b) when available; falls back to 7b or 8b.
 */

import type { OllamaClient } from './client.js';
import type {
  FailureSummarizationInput,
  FailureSummarizationResult,
  FailureSummary,
  LlmModelId,
} from './types.js';
import { LLM_MODELS } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUMMARIZE_TIMEOUT_MS = 90_000;
const SUMMARIZE_MAX_TOKENS = 1_024;

/** Preferred models for summarization (quality first) */
const SUMMARY_MODEL_PREFERENCE: LlmModelId[] = [
  LLM_MODELS.QWEN25_14B,
  LLM_MODELS.LLAMA31_8B,
  LLM_MODELS.QWEN25_7B,
  LLM_MODELS.PHI3_MINI,
];

// ─── Prompt Template ──────────────────────────────────────────────────────────

function buildSummarizationPrompt(input: FailureSummarizationInput): string {
  const stepLines = input.steps
    .map((s) => `  - ${s.step_name}: ${s.status}${s.error_message ? ` — "${s.error_message}"` : ''}`)
    .join('\n');

  const frictionLines = input.friction_signals.length > 0
    ? input.friction_signals
        .map((f) => `  - ${f.signal_type} (×${f.count})${f.details ? `: ${f.details}` : ''}`)
        .join('\n')
    : '  (none)';

  const failedCount = input.steps.filter((s) => s.status === 'failed' || s.status === 'error').length;
  const passedCount = input.steps.filter((s) => s.status === 'passed').length;

  return `You are a QA analyst writing a plain-English report about a website test session.

Execution Summary:
- Site: ${input.site_name}
- Flow: ${input.flow_name}
- Persona: ${input.persona_display_name} (${input.persona_id})
- Browser: ${input.browser}
- Overall result: ${input.overall_status}
- Steps: ${passedCount} passed, ${failedCount} failed out of ${input.steps.length} total
- Friction score: ${input.friction_score.toFixed(2)} (higher = more user confusion detected)

Step Results:
${stepLines}

Friction Signals:
${frictionLines}

Write a concise QA analysis report in this EXACT format (no extra text before or after):

EXECUTIVE_SUMMARY:
<One paragraph (2-4 sentences) describing what happened, suitable for a non-technical stakeholder.>

ISSUES:
1. <Specific issue found>
2. <Specific issue found>
(List up to 5 concrete issues. If there are no issues, write "None detected.")

RECOMMENDATIONS:
1. <Actionable recommendation for the dev team>
2. <Actionable recommendation for the dev team>
(List up to 4 actionable recommendations. If no action needed, write "No action required.")

PERSONA_NOTES:
<One sentence about how this specific persona type (${input.persona_display_name}) would be affected.>

SEVERITY: <critical|high|medium|low>

Rules:
- Use plain English; avoid jargon.
- Be specific about step names and error messages where relevant.
- SEVERITY must be one of: critical, high, medium, low.
- critical = blocking failure that prevents core flow completion.
- high = major failure affecting most users.
- medium = degraded experience or friction issue.
- low = minor or informational.`;
}

// ─── Response Parser ──────────────────────────────────────────────────────────

const SECTION_RE = {
  executive_summary: /EXECUTIVE_SUMMARY:\s*([\s\S]+?)(?=\nISSUES:|$)/,
  issues: /ISSUES:\s*([\s\S]+?)(?=\nRECOMMENDATIONS:|$)/,
  recommendations: /RECOMMENDATIONS:\s*([\s\S]+?)(?=\nPERSONA_NOTES:|$)/,
  persona_notes: /PERSONA_NOTES:\s*([\s\S]+?)(?=\nSEVERITY:|$)/,
  severity: /SEVERITY:\s*(critical|high|medium|low)/i,
};

function extractSection(text: string, key: keyof typeof SECTION_RE): string {
  const match = SECTION_RE[key].exec(text);
  return match?.[1]?.trim() ?? '';
}

function parseListSection(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter((l) => l.length > 0 && l !== 'None detected.' && l !== 'No action required.');
}

/**
 * Parses the structured sections from the LLM response into a FailureSummary.
 * Falls back to safe defaults when parsing fails.
 */
export function parseSummaryResponse(
  rawText: string,
  input: FailureSummarizationInput,
): FailureSummary {
  const executiveSummary = extractSection(rawText, 'executive_summary');
  const issuesText = extractSection(rawText, 'issues');
  const recommendationsText = extractSection(rawText, 'recommendations');
  const personaNotes = extractSection(rawText, 'persona_notes');
  const severityMatch = SECTION_RE.severity.exec(rawText);
  const severity = (severityMatch?.[1]?.toLowerCase() ?? 'medium') as FailureSummary['severity'];

  const failedSteps = input.steps.filter((s) => s.status === 'failed' || s.status === 'error');
  const fallbackSummary = failedSteps.length > 0
    ? `The ${input.flow_name} flow for ${input.persona_display_name} ended with ${failedSteps.length} failed step(s). ` +
      `Failed steps: ${failedSteps.map((s) => s.step_name).join(', ')}.`
    : `The ${input.flow_name} flow for ${input.persona_display_name} completed with status: ${input.overall_status}.`;

  return {
    executive_summary: executiveSummary || fallbackSummary,
    issues: issuesText ? parseListSection(issuesText) : failedSteps.map((s) => `Step "${s.step_name}" failed: ${s.error_message ?? 'unknown error'}`),
    recommendations: recommendationsText ? parseListSection(recommendationsText) : [],
    persona_notes: personaNotes || `No specific notes for ${input.persona_display_name}.`,
    severity: ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'medium',
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generates a failure summary for a completed execution.
 *
 * @param client        - Initialized OllamaClient
 * @param input         - Execution data (steps, friction signals, persona)
 * @param modelOverride - Force a specific model (otherwise uses preference order)
 */
export async function summarizeFailure(
  client: OllamaClient,
  input: FailureSummarizationInput,
  modelOverride?: LlmModelId,
): Promise<FailureSummarizationResult> {
  const model = modelOverride ?? SUMMARY_MODEL_PREFERENCE[0] ?? LLM_MODELS.QWEN25_7B;
  const prompt = buildSummarizationPrompt(input);

  const llmCall = await client.generate({
    model,
    prompt,
    max_tokens: SUMMARIZE_MAX_TOKENS,
    temperature: 0.3,
    timeout_ms: SUMMARIZE_TIMEOUT_MS,
  });

  const summary = parseSummaryResponse(
    llmCall.success ? llmCall.response_text : '',
    input,
  );

  return {
    input,
    summary,
    model_used: model,
    llm_call: llmCall,
    raw_response: llmCall.response_text,
  };
}

// ─── Re-export ─────────────────────────────────────────────────────────────────

export { SUMMARY_MODEL_PREFERENCE };
