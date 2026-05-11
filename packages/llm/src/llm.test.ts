/**
 * Phase 8: packages/llm — Unit Tests
 *
 * All tests run without a live Ollama instance.
 * The OllamaClient generate() method is mocked to return
 * pre-defined responses so we can test parsing logic deterministically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaClient } from './client.js';
import { parseSelectorCandidates, healSelector } from './selector-healer.js';
import { parseSummaryResponse, summarizeFailure } from './failure-summarizer.js';
import {
  LLM_MODELS,
  type FailureSummarizationInput,
  type SelectorHealingInput,
  type LlmCallResult,
} from './types.js';

// ─── Mock helpers ──────────────────────────────────────────────────────────────

function makeLlmCallResult(overrides: Partial<LlmCallResult> = {}): LlmCallResult {
  return {
    model: LLM_MODELS.PHI3_MINI,
    response_text: '',
    prompt_tokens: 100,
    completion_tokens: 50,
    total_duration_ms: 1200,
    success: true,
    ...overrides,
  };
}

function mockClientGenerate(client: OllamaClient, responseText: string, success = true) {
  vi.spyOn(client, 'generate').mockResolvedValue(
    makeLlmCallResult({ response_text: responseText, success, error: success ? undefined : 'Mock error' }),
  );
}

// ─── parseSelectorCandidates ───────────────────────────────────────────────────

describe('parseSelectorCandidates', () => {
  it('parses a well-formed CANDIDATES block', () => {
    const raw = `
CANDIDATES:
1. SELECTOR: getByRole('button', { name: 'Create Account' }) | CONFIDENCE: 0.95 | RATIONALE: Uses accessible role and label
2. SELECTOR: [data-testid="register-btn"] | CONFIDENCE: 0.9 | RATIONALE: Stable data-testid attribute
3. SELECTOR: .btn-primary | CONFIDENCE: 0.5 | RATIONALE: CSS class may not be unique
`;
    const candidates = parseSelectorCandidates(raw);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]!.selector).toBe("getByRole('button', { name: 'Create Account' })");
    expect(candidates[0]!.confidence).toBe(0.95);
    expect(candidates[1]!.selector).toBe('[data-testid="register-btn"]');
    expect(candidates[1]!.confidence).toBe(0.9);
    // Sorted descending by confidence
    expect(candidates[0]!.confidence).toBeGreaterThanOrEqual(candidates[1]!.confidence);
  });

  it('returns empty array for malformed response', () => {
    const candidates = parseSelectorCandidates('No CANDIDATES section here');
    expect(candidates).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(parseSelectorCandidates('')).toHaveLength(0);
  });

  it('clamps confidence above 1.0 to 1.0', () => {
    const raw = `
CANDIDATES:
1. SELECTOR: .foo | CONFIDENCE: 1.5 | RATIONALE: Over-confident
2. SELECTOR: .bar | CONFIDENCE: 0.99 | RATIONALE: High but valid
`;
    const candidates = parseSelectorCandidates(raw);
    // The regex only matches [digits and dot] so 1.5 parses, but is clamped
    expect(candidates[0]!.confidence).toBeLessThanOrEqual(1);
    expect(candidates[0]!.confidence).toBeGreaterThanOrEqual(0);
    expect(candidates.length).toBeGreaterThan(0);
  });

  it('respects the MAX_CANDIDATES cap of 5', () => {
    const lines = Array.from({ length: 8 }, (_, i) =>
      `${i + 1}. SELECTOR: .item-${i} | CONFIDENCE: 0.${9 - i} | RATIONALE: Option ${i}`,
    ).join('\n');
    const raw = `CANDIDATES:\n${lines}`;
    const candidates = parseSelectorCandidates(raw);
    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  it('sorts candidates by confidence descending', () => {
    const raw = `
CANDIDATES:
1. SELECTOR: .low | CONFIDENCE: 0.3 | RATIONALE: Low
2. SELECTOR: .high | CONFIDENCE: 0.9 | RATIONALE: High
3. SELECTOR: .mid | CONFIDENCE: 0.6 | RATIONALE: Mid
`;
    const candidates = parseSelectorCandidates(raw);
    expect(candidates[0]!.confidence).toBe(0.9);
    expect(candidates[1]!.confidence).toBe(0.6);
    expect(candidates[2]!.confidence).toBe(0.3);
  });
});

// ─── healSelector ──────────────────────────────────────────────────────────────

describe('healSelector', () => {
  let client: OllamaClient;

  beforeEach(() => {
    client = new OllamaClient({ base_url: 'http://localhost:11434' });
  });

  it('returns parsed candidates when LLM responds correctly', async () => {
    mockClientGenerate(client, `
CANDIDATES:
1. SELECTOR: [data-testid="submit"] | CONFIDENCE: 0.9 | RATIONALE: Stable test id
2. SELECTOR: button.btn-primary | CONFIDENCE: 0.6 | RATIONALE: CSS class selector
`);

    const input: SelectorHealingInput = {
      failed_selector: 'button[type="submit"]',
      html_snippet: '<button class="btn-primary" data-testid="submit">Submit</button>',
    };

    const result = await healSelector(client, input);

    expect(result.llm_call.success).toBe(true);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]!.selector).toBe('[data-testid="submit"]');
    expect(result.model_used).toBe(LLM_MODELS.PHI3_MINI);
  });

  it('returns empty candidates when LLM returns error result', async () => {
    mockClientGenerate(client, '', false);

    const result = await healSelector(client, {
      failed_selector: 'button',
      html_snippet: '<div></div>',
    });

    expect(result.candidates).toHaveLength(0);
    expect(result.llm_call.success).toBe(false);
  });

  it('uses modelOverride when specified', async () => {
    mockClientGenerate(client, 'CANDIDATES:\n1. SELECTOR: .x | CONFIDENCE: 0.8 | RATIONALE: test');

    const result = await healSelector(client, {
      failed_selector: 'button',
      html_snippet: '<button class="x">Click</button>',
    }, LLM_MODELS.QWEN25_7B);

    expect(result.model_used).toBe(LLM_MODELS.QWEN25_7B);
  });

  it('truncates html_snippet to MAX_HTML_CHARS in prompt', async () => {
    const generateSpy = vi.spyOn(client, 'generate').mockResolvedValue(
      makeLlmCallResult({ response_text: 'CANDIDATES:\n1. SELECTOR: .x | CONFIDENCE: 0.5 | RATIONALE: test' }),
    );

    const longHtml = 'x'.repeat(10_000);
    await healSelector(client, { failed_selector: 'button', html_snippet: longHtml });

    const callArg = generateSpy.mock.calls[0]![0];
    // The prompt should not be longer than MAX_HTML_CHARS (4000) + prompt overhead
    expect(callArg.prompt.length).toBeLessThan(6000);
  });
});

// ─── parseSummaryResponse ──────────────────────────────────────────────────────

const SAMPLE_INPUT: FailureSummarizationInput = {
  execution_id: 1,
  persona_id: 'confident_desktop',
  persona_display_name: 'Alex, 35',
  browser: 'chromium',
  flow_name: 'registration',
  site_name: 'Demo Site',
  overall_status: 'failed',
  friction_score: 0.4,
  steps: [
    { step_name: 'navigate', status: 'passed' },
    { step_name: 'fill_email', status: 'passed' },
    { step_name: 'click_submit', status: 'failed', error_message: 'Button not found' },
  ],
  friction_signals: [
    { signal_type: 'repeated_click', count: 2, details: 'submit button' },
  ],
};

describe('parseSummaryResponse', () => {
  it('parses all sections from a well-formed response', () => {
    const raw = `
EXECUTIVE_SUMMARY:
The registration flow failed when the submit button could not be located.

ISSUES:
1. Submit button selector failed on the registration page.
2. User was unable to complete registration.

RECOMMENDATIONS:
1. Add a data-testid attribute to the submit button.
2. Review recent DOM changes to the registration form.

PERSONA_NOTES:
Alex would be frustrated by this failure and likely abandon the flow.

SEVERITY: high
`;
    const summary = parseSummaryResponse(raw, SAMPLE_INPUT);

    expect(summary.executive_summary).toContain('submit button could not be located');
    expect(summary.issues).toHaveLength(2);
    expect(summary.issues[0]).toContain('Submit button');
    expect(summary.recommendations).toHaveLength(2);
    expect(summary.persona_notes).toContain('Alex');
    expect(summary.severity).toBe('high');
  });

  it('falls back to safe defaults for malformed response', () => {
    const summary = parseSummaryResponse('No structured sections here', SAMPLE_INPUT);

    // Falls back to a summary built from failed steps
    expect(summary.executive_summary.length).toBeGreaterThan(0);
    expect(summary.severity).toBe('medium');   // default
  });

  it('always produces valid severity value', () => {
    const raw = `
EXECUTIVE_SUMMARY:
Something bad happened.
ISSUES:
1. One issue.
RECOMMENDATIONS:
1. Fix it.
PERSONA_NOTES:
A note.
SEVERITY: INVALID_VALUE
`;
    const summary = parseSummaryResponse(raw, SAMPLE_INPUT);
    expect(['critical', 'high', 'medium', 'low']).toContain(summary.severity);
  });

  it('produces fallback issues from failed steps when no ISSUES section', () => {
    const raw = `EXECUTIVE_SUMMARY: Something went wrong.\nRECOMMENDATIONS:\n1. Fix it.\nPERSONA_NOTES: Note.\nSEVERITY: medium`;
    const summary = parseSummaryResponse(raw, SAMPLE_INPUT);
    // Should have fallback issues from failed steps
    expect(summary.issues.length).toBeGreaterThan(0);
  });
});

// ─── summarizeFailure ─────────────────────────────────────────────────────────

describe('summarizeFailure', () => {
  let client: OllamaClient;

  beforeEach(() => {
    client = new OllamaClient({ base_url: 'http://localhost:11434' });
  });

  it('returns a complete FailureSummarizationResult on success', async () => {
    mockClientGenerate(client, `
EXECUTIVE_SUMMARY:
The registration flow failed at the submit step.

ISSUES:
1. Button selector timed out.

RECOMMENDATIONS:
1. Update the button selector.

PERSONA_NOTES:
Alex would be frustrated.

SEVERITY: high
`);

    const result = await summarizeFailure(client, SAMPLE_INPUT);

    expect(result.llm_call.success).toBe(true);
    expect(result.summary.severity).toBe('high');
    expect(result.summary.issues.length).toBeGreaterThan(0);
    expect(result.model_used).toBe(LLM_MODELS.QWEN25_14B);   // default preference
    expect(result.input).toBe(SAMPLE_INPUT);
  });

  it('returns fallback summary when LLM fails', async () => {
    mockClientGenerate(client, '', false);

    const result = await summarizeFailure(client, SAMPLE_INPUT);

    // llm_call.success is false but result.summary still has fallback content
    expect(result.llm_call.success).toBe(false);
    expect(result.summary.executive_summary.length).toBeGreaterThan(0);
  });

  it('uses modelOverride when specified', async () => {
    mockClientGenerate(client, `
EXECUTIVE_SUMMARY: OK.
ISSUES:
1. Issue.
RECOMMENDATIONS:
1. Fix.
PERSONA_NOTES: Note.
SEVERITY: low
`);

    const result = await summarizeFailure(client, SAMPLE_INPUT, LLM_MODELS.PHI3_MINI);
    expect(result.model_used).toBe(LLM_MODELS.PHI3_MINI);
  });
});

// ─── OllamaClient error handling ──────────────────────────────────────────────

describe('OllamaClient', () => {
  it('returns error result when Ollama is unreachable (connection refused)', async () => {
    const client = new OllamaClient({ base_url: 'http://127.0.0.1:1', timeout_ms: 500 });
    const result = await client.generate({
      model: LLM_MODELS.PHI3_MINI,
      prompt: 'Hello',
      timeout_ms: 500,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.response_text).toBe('');
  });

  it('clamps timeout to the per-call override', async () => {
    const client = new OllamaClient({ base_url: 'http://127.0.0.1:1', timeout_ms: 10_000 });
    const start = Date.now();
    await client.generate({
      model: LLM_MODELS.PHI3_MINI,
      prompt: 'Hello',
      timeout_ms: 300,
    });
    const elapsed = Date.now() - start;
    // Should have timed out well before 5 seconds
    expect(elapsed).toBeLessThan(5000);
  });
});

// ─── LLM_MODELS constants ─────────────────────────────────────────────────────

describe('LLM_MODELS', () => {
  it('defines all four expected model IDs', () => {
    expect(LLM_MODELS.PHI3_MINI).toBe('phi3:mini');
    expect(LLM_MODELS.QWEN25_7B).toBe('qwen2.5:7b');
    expect(LLM_MODELS.LLAMA31_8B).toBe('llama3.1:8b');
    expect(LLM_MODELS.QWEN25_14B).toBe('qwen2.5:14b');
  });
});
