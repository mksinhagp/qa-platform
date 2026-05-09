/**
 * ExecutionManager — manages concurrent run executions with a concurrency cap.
 *
 * Flow:
 *  1. Dashboard POSTs /run with a MatrixRunConfig + list of pre-materialized executions.
 *  2. ExecutionManager queues each child execution.
 *  3. Executions are dispatched up to CONCURRENCY_CAP in parallel.
 *  4. Each execution:
 *     a. Looks up the persona and device profile.
 *     b. Instantiates a PersonaRunner.
 *     c. Runs the requested flow.
 *     d. Reports status, friction score, and step results back to the dashboard
 *        via the configured callback URL.
 *  5. On completion, the run is marked complete/failed.
 */

import { chromium, firefox, webkit, type Browser } from '@playwright/test';
import { PersonaRunner, type ExecutionResult, type StepResult, type FrictionSignal } from '@qa-platform/playwright-core';
import type { Persona } from '@qa-platform/shared-types';
import { getPersonaById, V1_PERSONAS } from '@qa-platform/personas';
import { Logger } from '@qa-platform/shared-types';

const logger = new Logger('execution-manager');

const DEFAULT_CONCURRENCY_CAP = 4;

export function parseConcurrencyCap(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? String(DEFAULT_CONCURRENCY_CAP), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONCURRENCY_CAP;
}

// Maximum parallel executions (configurable via env)
const CONCURRENCY_CAP = parseConcurrencyCap(process.env.RUNNER_CONCURRENCY);

export interface ExecutionRequest {
  execution_id: number;
  run_id: number;
  persona_id: string;
  browser: 'chromium' | 'firefox' | 'webkit';
  flow_name: string;
  base_url: string;
  /** One-time token for the dashboard callback */
  callback_token: string;
  /** Dashboard internal URL to POST results */
  callback_url: string;
}

export interface RunRequest {
  run_id: number;
  executions: ExecutionRequest[];
}

type ExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'aborted' | 'friction_flagged' | 'skipped_by_approval';

export interface ExecutionState {
  request: ExecutionRequest;
  status: ExecutionStatus;
  result?: ExecutionResult;
  error?: string;
}

// Built-in stub flows for Phase 3 — real flows come from sites/<siteId>/flows/*.ts in Phase 4+
async function runStubFlow(runner: PersonaRunner, flowName: string, baseUrl: string): Promise<void> {
  runner.collector.setStep('navigate_home');
  await runner.goto(baseUrl);
  await runner.hesitate(150);

  runner.collector.setStep('check_accessibility');
  await runner.checkAccessibility();

  if (flowName === 'registration') {
    runner.collector.setStep('find_registration_link');
    await runner.hesitate(100);
    // Stub: just verify the page loaded
    const url = runner.page.url();
    if (!url) throw new Error('Navigation failed');
  }
}

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

async function sendCallback(
  callbackUrl: string,
  token: string,
  executionId: number,
  result: ExecutionResult,
  correlationId: string,
): Promise<void> {
  try {
    validateCallbackUrl(callbackUrl);
    const body = {
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

    const resp = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Runner-Token': token,
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      logger.warn(`Callback returned ${resp.status}`, { execution_id: executionId }, correlationId);
    }
  } catch (err) {
    logger.error('Callback failed', err instanceof Error ? err : new Error(String(err)), undefined, correlationId);
  }
}

export class ExecutionManager {
  private queue: ExecutionRequest[] = [];
  private running = 0;
  private states: Map<number, ExecutionState> = new Map();
  private _runId: number | null = null;
  private _correlationId: string;
  // Pending resolve callbacks from waitForSlot() — signalled each time running decrements
  private _slotWaiters: Array<() => void> = [];
  private _aborted = false;

  constructor(correlationId: string, runId?: number) {
    this._correlationId = correlationId;
    this._runId = runId ?? null;
  }

  /** Enqueue and start processing executions for a run */
  async startRun(req: RunRequest): Promise<void> {
    this._runId = req.run_id;
    logger.info(`Starting run ${req.run_id} with ${req.executions.length} executions`, undefined, this._correlationId);

    for (const ex of req.executions) {
      this.states.set(ex.execution_id, { request: ex, status: 'queued' });
      this.queue.push(ex);
    }

    await this.drain();
  }

  /**
   * Returns a Promise that resolves once a concurrency slot is available.
   * Callers yield here when CONCURRENCY_CAP is reached.
   */
  private waitForSlot(): Promise<void> {
    if (this.running < CONCURRENCY_CAP) return Promise.resolve();
    return new Promise(resolve => this._slotWaiters.push(resolve));
  }

  /** Signal that a slot has freed up; wake the next waiter if any. */
  private releaseSlot(): void {
    this.running--;
    const next = this._slotWaiters.shift();
    if (next) next();
  }

  /**
   * Drain the queue while respecting the concurrency cap.
   * Executions are dispatched one at a time after acquiring a slot; the
   * dispatch loop itself awaits only the slot acquisition — not the execution —
   * so up to CONCURRENCY_CAP executions run truly in parallel.
   */
  private async drain(): Promise<void> {
    const inFlight: Promise<void>[] = [];

    while (this.queue.length > 0) {
      if (this._aborted) {
        // Mark remaining queued executions as aborted
        for (const rem of this.queue) {
          const s = this.states.get(rem.execution_id);
          if (s) s.status = 'aborted';
        }
        this.queue.length = 0;
        break;
      }
      // Block here until a slot is free (resolves immediately if running < cap)
      await this.waitForSlot();
      const ex = this.queue.shift();
      if (!ex) break; // queue was emptied by a concurrent drain call (shouldn't happen, but guard anyway)
      inFlight.push(this.runExecution(ex));
    }

    // Wait for all dispatched executions to finish before returning
    await Promise.all(inFlight);
  }

  private async runExecution(ex: ExecutionRequest): Promise<void> {
    this.running++;
    const state = this.states.get(ex.execution_id)!;
    state.status = 'running';

    let browser: Browser | null = null;
    let runner: PersonaRunner | null = null;

    try {
      const persona = lookupPersona(ex.persona_id);
      browser = await getBrowser(ex.browser);
      runner = new PersonaRunner(browser, persona);
      await runner.setup();

      const result = await runner.executeFlow({
        id: ex.flow_name,
        name: ex.flow_name,
        steps: [
          {
            name: 'navigate_and_check',
            type: 'navigation',
            fn: async (r: PersonaRunner) => runStubFlow(r, ex.flow_name, ex.base_url),
          },
        ],
      });

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

      // Send failure callback
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
      // Teardown and browser close must both run even if the other throws,
      // so run them independently and collect errors.
      const cleanupErrors: unknown[] = [];
      try { await runner?.teardown(); } catch (e) { cleanupErrors.push(e); }
      try { await browser?.close(); } catch (e) { cleanupErrors.push(e); }
      // Release the concurrency slot after cleanup so the next queued execution
      // can start only after resources are fully freed.
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

  /**
   * Abort the run: mark all queued executions as aborted and prevent new ones from starting.
   * In-flight executions will complete their current step before stopping.
   */
  abort(): void {
    this._aborted = true;
    // Flush queued entries immediately
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

// Singleton active manager (one run at a time in Phase 3).
// Reads and writes are synchronous, so the check-and-set in startRun()
// is atomic within the Node.js event loop — no await between guard and assignment.
let activeManager: ExecutionManager | null = null;

export function getActiveManager(): ExecutionManager | null {
  return activeManager;
}

export function __resetActiveManagerForTests(): void {
  activeManager = null;
}

export function reserveRun(req: RunRequest, correlationId: string): ExecutionManager {
  // Check and set must be a single synchronous block (no await between them)
  // to prevent the TOCTOU race where two requests both pass the null check
  // before either assigns activeManager.
  if (activeManager) {
    throw new Error('A run is already in progress');
  }
  // Assign synchronously — subsequent calls will see a non-null manager
  // before the route acknowledges the request.
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
