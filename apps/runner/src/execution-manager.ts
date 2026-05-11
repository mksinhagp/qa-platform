/**
 * ExecutionManager — manages concurrent run executions with a concurrency cap.
 *
 * Phase 4 additions:
 *  - Real flow dispatch: loads flows from sites/<site_id>/flows/index.js
 *  - Approval gate: steps with type='approval' pause execution, post an approval
 *    request to the dashboard via callback, and poll for an operator decision.
 *  - On approved: the next step (submit) proceeds.
 *  - On rejected / timed_out: remaining steps are recorded as skipped_by_approval.
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { chromium, firefox, webkit, type Browser } from '@playwright/test';
import {
  PersonaRunner,
  type ExecutionResult,
  type StepResult,
  type FrictionSignal,
  type FlowDefinition,
} from '@qa-platform/playwright-core';
import type { Persona } from '@qa-platform/shared-types';
import { getPersonaById, V1_PERSONAS } from '@qa-platform/personas';
import { Logger } from '@qa-platform/shared-types';

const logger = new Logger('execution-manager');

const DEFAULT_CONCURRENCY_CAP = 4;

export function parseConcurrencyCap(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? String(DEFAULT_CONCURRENCY_CAP), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONCURRENCY_CAP;
}

const CONCURRENCY_CAP = parseConcurrencyCap(process.env.RUNNER_CONCURRENCY);

// ─── Approval-gate polling interval / timeout ─────────────────────────────────
const APPROVAL_POLL_INTERVAL_MS = 3000;
const APPROVAL_DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface ExecutionRequest {
  execution_id: number;
  run_id: number;
  /** Persona id from the personas library */
  persona_id: string;
  browser: 'chromium' | 'firefox' | 'webkit';
  /** Flow name, e.g. "browse" or "registration" */
  flow_name: string;
  /** Site id used to load flows from sites/<site_id>/flows/index.js */
  site_id: string;
  /** Base URL for the site */
  base_url: string;
  /** One-time token for dashboard callbacks */
  callback_token: string;
  /** Dashboard internal URL to POST execution results and approval requests */
  callback_url: string;
}

export interface RunRequest {
  run_id: number;
  executions: ExecutionRequest[];
}

type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'aborted'
  | 'friction_flagged'
  | 'skipped_by_approval';

export interface ExecutionState {
  request: ExecutionRequest;
  status: ExecutionStatus;
  result?: ExecutionResult;
  error?: string;
}

// ─── Flow registry ────────────────────────────────────────────────────────────

const flowCache = new Map<string, Record<string, FlowDefinition>>();

// Validate siteId to prevent path traversal — only allow alphanumeric, hyphens, underscores
function validateSiteId(siteId: string): void {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(siteId)) {
    throw new Error(`Invalid site ID: "${siteId}". Must be alphanumeric (hyphens/underscores allowed).`);
  }
}

/**
 * Load flows for a site from sites/<siteId>/flows/index.js.
 * Falls back to a minimal stub if the site directory is not found.
 */
async function loadFlows(siteId: string, baseUrl: string): Promise<Record<string, FlowDefinition>> {
  validateSiteId(siteId);
  const cached = flowCache.get(siteId);
  if (cached) return cached;

  try {
    const sitesRoot = process.env.BUSINESS_RULES_PATH ?? './sites';
    const resolvedRoot = path.resolve(sitesRoot);
    const jsFlowPath = path.resolve(sitesRoot, siteId, 'flows', 'index.js');
    const tsFlowPath = path.resolve(sitesRoot, siteId, 'flows', 'index.ts');
    const flowPath = existsSync(jsFlowPath) ? jsFlowPath : tsFlowPath;
    if (!flowPath.startsWith(resolvedRoot + path.sep)) {
      throw new Error(`Path traversal detected for site "${siteId}"`);
    }
    const mod = await import(flowPath) as { flows?: Record<string, FlowDefinition> };
    const flows = mod.flows ?? {};
    flowCache.set(siteId, flows);
    logger.info(`Loaded ${Object.keys(flows).length} flows for site "${siteId}"`);
    return flows;
  } catch (err) {
    logger.warn(
      `No flow module found for site "${siteId}" — using stub`,
      { error: String(err) },
    );
    // Return a minimal stub so the run can still complete
    const stub: FlowDefinition = {
      id: 'stub',
      name: 'Stub (no site flows found)',
      steps: [
        {
          name: 'navigate_home',
          type: 'navigation',
          fn: async (runner: PersonaRunner) => {
            runner.collector.setStep('navigate_home');
            await runner.goto(baseUrl);
            await runner.hesitate(150);
            await runner.checkAccessibility();
          },
        },
      ],
    };
    return { stub, browse: stub, registration: stub };
  }
}

// ─── Approval gate ────────────────────────────────────────────────────────────

/**
 * Post an approval request to the dashboard and poll for an operator decision.
 * Returns true if approved, false if rejected or timed out.
 *
 * @param approvalCategory - The category to record on the approval row (e.g.
 *   'registration_submit' or 'checkout_submit'). Derived from the step's
 *   `approval_category` field; falls back to 'registration_submit'.
 */
async function waitForApproval(
  ex: ExecutionRequest,
  stepName: string,
  stepOrder: number,
  correlationId: string,
  approvalCategory = 'registration_submit',
): Promise<boolean> {
  // POST approval_request to the dashboard callback
  const approvalPayload = {
    type: 'approval_request',
    execution_id: ex.execution_id,
    run_id: ex.run_id,
    step_name: stepName,
    step_order: stepOrder,
    category: approvalCategory,
    payload_summary: `Flow "${ex.flow_name}" — step "${stepName}" requires operator approval before executing`,
    timeout_ms: APPROVAL_DEFAULT_TIMEOUT_MS,
  };

  let approvalId: number | null = null;

  try {
    validateCallbackUrl(ex.callback_url);
    const resp = await fetch(ex.callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Runner-Token': ex.callback_token,
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify(approvalPayload),
    });

    if (!resp.ok) {
      logger.warn(`Approval request for execution ${ex.execution_id} failed (${resp.status}) — defaulting to rejected`, undefined, correlationId);
      return false;
    }

    const json = await resp.json() as { approval_id?: number };
    approvalId = json.approval_id ?? null;
  } catch (err) {
    logger.error('Approval request POST failed', err instanceof Error ? err : new Error(String(err)), undefined, correlationId);
    return false;
  }

  if (!approvalId) {
    logger.warn(`Approval request for execution ${ex.execution_id} returned no approval_id — rejecting`, undefined, correlationId);
    return false;
  }

  // Poll the dashboard approval poll endpoint until a decision or timeout.
  // Poll first, then sleep — avoids an unnecessary initial delay before the
  // first check, which matters when an operator acts immediately.
  const deadline = Date.now() + APPROVAL_DEFAULT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const pollUrl = new URL(ex.callback_url);
      // Callback URL may be the execution result endpoint; derive the approval poll endpoint
      // Convention: replace the path with /api/runner/approvals/:id/poll
      pollUrl.pathname = `/api/runner/approvals/${approvalId}/poll`;

      const pollResp = await fetch(pollUrl.toString(), {
        method: 'GET',
        headers: {
          'X-Runner-Token': ex.callback_token,
          'X-Correlation-Id': correlationId,
        },
      });

      if (!pollResp.ok) {
        logger.warn(`Approval poll returned ${pollResp.status}`, undefined, correlationId);
      } else {
        const poll = await pollResp.json() as { decided: boolean; status?: string };

        if (poll.decided) {
          logger.info(
            `Approval ${approvalId} decided: ${poll.status}`,
            { execution_id: ex.execution_id },
            correlationId,
          );
          return poll.status === 'approved';
        }
      }
    } catch (err) {
      logger.warn(`Approval poll error: ${String(err)}`, undefined, correlationId);
    }

    // Only sleep if there is still time remaining so we exit promptly on timeout.
    if (Date.now() + APPROVAL_POLL_INTERVAL_MS < deadline) {
      await sleep(APPROVAL_POLL_INTERVAL_MS);
    } else {
      break;
    }
  }

  // Timeout — treat as rejected
  logger.warn(`Approval ${approvalId} timed out — treating as rejected`, undefined, correlationId);
  return false;
}

// ─── Flow execution with approval gate ───────────────────────────────────────

async function executeFlowWithApprovals(
  runner: PersonaRunner,
  flow: FlowDefinition,
  ex: ExecutionRequest,
  correlationId: string,
): Promise<ExecutionResult> {
  const startedAt = new Date();
  const stepResults: StepResult[] = [];
  let approvalRejected = false;

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    const stepStart = new Date();
    runner.collector.setStep(step.name);

    const stepResult: StepResult = {
      step_name: step.name,
      step_order: i + 1,
      status: 'pending',
      started_at: stepStart,
      completed_at: stepStart,
      duration_ms: 0,
    };

    // If a prior approval was rejected, skip all subsequent steps
    if (approvalRejected) {
      stepResult.status = 'skipped';
      stepResult.error_message = 'Skipped — prior approval rejected';
      stepResult.completed_at = new Date();
      stepResult.duration_ms = 0;
      stepResults.push(stepResult);
      continue;
    }

    // Approval gate: pause before this step and wait for operator decision
    if (step.type === 'approval') {
      logger.info(
        `Execution ${ex.execution_id}: step "${step.name}" requires approval`,
        undefined,
        correlationId,
      );

      const approved = await waitForApproval(
        ex,
        step.name,
        i + 1,
        correlationId,
        step.approval_category ?? 'registration_submit',
      );

      if (!approved) {
        approvalRejected = true;
        stepResult.status = 'skipped';
        stepResult.error_message = 'Step skipped — approval rejected or timed out';
        stepResult.completed_at = new Date();
        stepResult.duration_ms = stepResult.completed_at.getTime() - stepStart.getTime();
        stepResults.push(stepResult);
        continue;
      }
    }

    // Execute the step
    stepResult.status = 'running';
    try {
      await step.fn(runner);
      stepResult.status = 'passed';
    } catch (err) {
      stepResult.status = 'failed';
      stepResult.error_message = err instanceof Error ? err.message : String(err);
    } finally {
      stepResult.completed_at = new Date();
      stepResult.duration_ms = stepResult.completed_at.getTime() - stepStart.getTime();
      stepResults.push(stepResult);
    }

    if (stepResult.status === 'failed') {
      break;
    }
  }

  const completedAt = new Date();
  const frictionScore = runner.collector.calculateScore();
  const hasFailed = stepResults.some(s => s.status === 'failed');

  let status: ExecutionResult['status'] = 'passed';
  if (hasFailed) {
    status = 'failed';
  } else if (approvalRejected) {
    status = 'skipped_by_approval';
  } else if (runner.collector.isFrictionFlagged()) {
    status = 'friction_flagged';
  }

  return {
    passed: !hasFailed && !approvalRejected,
    status,
    steps: stepResults,
    friction_score: frictionScore,
    friction_signals: runner.collector.getSignals(),
    started_at: startedAt,
    completed_at: completedAt,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBrowser(type: 'chromium' | 'firefox' | 'webkit'): Promise<Browser> {
  switch (type) {
    case 'firefox': return firefox.launch({ headless: true });
    case 'webkit': return webkit.launch({ headless: true });
    default: return chromium.launch({ headless: true });
  }
}

function lookupPersona(personaId: string): Persona {
  const p = getPersonaById(personaId);
  if (!p) throw new Error(`Unknown persona: ${personaId}. Available: ${V1_PERSONAS.map((v: Persona) => v.id).join(', ')}`);
  return p;
}

function validateCallbackUrl(callbackUrl: string): void {
  const allowedOrigins = (process.env.RUNNER_CALLBACK_ALLOWED_ORIGINS ?? 'http://dashboard-web:3000,http://localhost:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const parsed = new URL(callbackUrl);
  if (!['http:', 'https:'].includes(parsed.protocol) || !allowedOrigins.includes(parsed.origin)) {
    throw new Error(`Callback URL origin is not allowed: ${parsed.origin}`);
  }
}

const CALLBACK_MAX_RETRIES = 3;
const CALLBACK_BASE_DELAY_MS = 1000;

async function sendCallback(
  callbackUrl: string,
  token: string,
  executionId: number,
  result: ExecutionResult,
  correlationId: string,
): Promise<void> {
  validateCallbackUrl(callbackUrl);
  const body = {
    type: 'execution_result',
    execution_id: executionId,
    status: result.status,
    friction_score: result.friction_score,
    steps: result.steps.map((s: StepResult) => ({
      step_name: s.step_name,
      step_order: s.step_order,
      status: s.status,
      duration_ms: s.duration_ms,
      error_message: s.error_message,
      accessibility_violations: s.accessibility?.violations.length ?? 0,
      accessibility_warnings: s.accessibility?.warnings.length ?? 0,
    })),
    friction_signals: result.friction_signals.map((f: FrictionSignal) => ({
      signal_type: f.signal_type,
      step_name: f.step_name,
      element_selector: f.element_selector,
      metadata: f.metadata,
      occurred_at: f.occurred_at.toISOString(),
    })),
    error_message: result.error_message,
    started_at: result.started_at.toISOString(),
    completed_at: result.completed_at.toISOString(),
  };

  const payload = JSON.stringify(body);

  for (let attempt = 0; attempt <= CALLBACK_MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Runner-Token': token,
          'X-Correlation-Id': correlationId,
        },
        body: payload,
      });

      if (resp.ok) return;

      // 4xx errors are not retryable (client error / auth issue)
      if (resp.status >= 400 && resp.status < 500) {
        logger.warn(`Callback returned ${resp.status} (not retryable)`, { execution_id: executionId }, correlationId);
        return;
      }

      logger.warn(`Callback returned ${resp.status} (attempt ${attempt + 1}/${CALLBACK_MAX_RETRIES + 1})`, { execution_id: executionId }, correlationId);
    } catch (err) {
      logger.warn(
        `Callback attempt ${attempt + 1}/${CALLBACK_MAX_RETRIES + 1} failed: ${String(err)}`,
        { execution_id: executionId },
        correlationId,
      );
    }

    if (attempt < CALLBACK_MAX_RETRIES) {
      await sleep(CALLBACK_BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  logger.error(
    'Callback failed after all retries',
    new Error(`sendCallback exhausted ${CALLBACK_MAX_RETRIES + 1} attempts`),
    { execution_id: executionId },
    correlationId,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── ExecutionManager ─────────────────────────────────────────────────────────

export class ExecutionManager {
  private queue: ExecutionRequest[] = [];
  private running = 0;
  private states: Map<number, ExecutionState> = new Map();
  private _runId: number | null = null;
  private _correlationId: string;
  private _slotWaiters: Array<() => void> = [];
  private _aborted = false;

  constructor(correlationId: string, runId?: number) {
    this._correlationId = correlationId;
    this._runId = runId ?? null;
  }

  async startRun(req: RunRequest): Promise<void> {
    this._runId = req.run_id;
    logger.info(`Starting run ${req.run_id} with ${req.executions.length} executions`, undefined, this._correlationId);

    for (const ex of req.executions) {
      this.states.set(ex.execution_id, { request: ex, status: 'queued' });
      this.queue.push(ex);
    }

    await this.drain();
  }

  // Atomically claim a concurrency slot: increments running immediately when
  // a slot is available so no other path can over-subscribe between resolve
  // and the start of runExecution.
  private waitForSlot(): Promise<void> {
    if (this.running < CONCURRENCY_CAP) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise(resolve => this._slotWaiters.push(() => {
      this.running++;
      resolve();
    }));
  }

  private releaseSlot(): void {
    this.running--;
    const next = this._slotWaiters.shift();
    if (next) next();
  }

  private async drain(): Promise<void> {
    const inFlight: Promise<void>[] = [];

    while (this.queue.length > 0) {
      if (this._aborted) {
        for (const rem of this.queue) {
          const s = this.states.get(rem.execution_id);
          if (s) s.status = 'aborted';
        }
        this.queue.length = 0;
        break;
      }
      await this.waitForSlot();
      const ex = this.queue.shift();
      if (!ex) break;
      inFlight.push(this.runExecution(ex));
    }

    await Promise.all(inFlight);
  }

  private async runExecution(ex: ExecutionRequest): Promise<void> {
    // Slot already claimed by waitForSlot()
    const state = this.states.get(ex.execution_id)!;
    state.status = 'running';

    let browser: Browser | null = null;
    let runner: PersonaRunner | null = null;

    try {
      const persona = lookupPersona(ex.persona_id);
      browser = await getBrowser(ex.browser);
      runner = new PersonaRunner(browser, persona);
      await runner.setup();

      // Load real site flows; falls back to stub if site directory not found
      const flows = await loadFlows(ex.site_id, ex.base_url);
      const flow = flows[ex.flow_name] ?? flows['stub'];

      if (!flow) {
        throw new Error(`Flow "${ex.flow_name}" not found for site "${ex.site_id}"`);
      }

      const result = await executeFlowWithApprovals(runner, flow, ex, this._correlationId);

      state.status = result.status;
      state.result = result;

      logger.info(
        `Execution ${ex.execution_id} finished: ${result.status} (friction: ${result.friction_score})`,
        undefined,
        this._correlationId,
      );

      await sendCallback(ex.callback_url, ex.callback_token, ex.execution_id, result, this._correlationId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.status = 'failed';
      state.error = msg;
      logger.error(`Execution ${ex.execution_id} errored: ${msg}`, err instanceof Error ? err : new Error(msg), undefined, this._correlationId);

      await sendCallback(
        ex.callback_url,
        ex.callback_token,
        ex.execution_id,
        {
          passed: false,
          status: 'failed',
          steps: [],
          friction_score: 0,
          friction_signals: [],
          error_message: msg,
          started_at: new Date(),
          completed_at: new Date(),
        },
        this._correlationId,
      );
    } finally {
      const cleanupErrors: unknown[] = [];
      try { await runner?.teardown(); } catch (e) { cleanupErrors.push(e); }
      try { await browser?.close(); } catch (e) { cleanupErrors.push(e); }
      this.releaseSlot();
      if (cleanupErrors.length > 0) {
        logger.warn(
          `Execution ${ex.execution_id}: cleanup errors after completion`,
          { errors: cleanupErrors.map(e => String(e)) },
          this._correlationId,
        );
      }
    }
  }

  abort(): void {
    this._aborted = true;
    for (const ex of this.queue) {
      const s = this.states.get(ex.execution_id);
      if (s) s.status = 'aborted';
    }
    this.queue.length = 0;
    logger.info(`Run ${this._runId} abort flag set`, undefined, this._correlationId);
  }

  get isAborted(): boolean {
    return this._aborted;
  }

  getState(): Map<number, ExecutionState> {
    return this.states;
  }

  getRunId(): number | null {
    return this._runId;
  }
}

// ─── Singleton active manager ─────────────────────────────────────────────────

let activeManager: ExecutionManager | null = null;

export function getActiveManager(): ExecutionManager | null {
  return activeManager;
}

export function __resetActiveManagerForTests(): void {
  activeManager = null;
}

export function reserveRun(req: RunRequest, correlationId: string): ExecutionManager {
  if (activeManager) {
    throw new Error('A run is already in progress');
  }
  activeManager = new ExecutionManager(correlationId, req.run_id);
  return activeManager;
}

export async function runReservedRun(manager: ExecutionManager, req: RunRequest): Promise<void> {
  try {
    await manager.startRun(req);
  } finally {
    if (activeManager === manager) {
      activeManager = null;
    }
  }
}

export async function startRun(req: RunRequest, correlationId: string): Promise<void> {
  const manager = reserveRun(req, correlationId);
  await runReservedRun(manager, req);
}
