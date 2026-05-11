/**
 * PersonaRunner — wraps a single execution of a flow under a persona.
 *
 * Responsibilities:
 * - Creates and owns the BrowserContext for a persona+device+network combo.
 * - Provides helpers for persona-aware interaction (type, click, hesitate).
 * - Installs friction telemetry.
 * - Runs persona-aware accessibility checks at nominated checkpoints.
 * - Reports execution status: passed | failed | friction_flagged | aborted.
 */

import type { Browser, Page } from '@playwright/test';
import type { Persona, BrowserCapturedState } from '@qa-platform/shared-types';
import { AssistiveTech, MotorProfile } from '@qa-platform/shared-types';
import { createPersonaContext } from './context.js';
import { personaType, personaHesitate, personaClick } from './typing.js';
import { runPersonaAccessibilityCheck, type AccessibilityResult } from './accessibility.js';
import { FrictionCollector, installScrollUpDetector } from './friction.js';

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface StepResult {
  step_name: string;
  step_order: number;
  status: StepStatus;
  started_at: Date;
  completed_at: Date;
  duration_ms: number;
  error_message?: string;
  accessibility?: AccessibilityResult;
}

export interface ExecutionResult {
  passed: boolean;
  status: 'passed' | 'failed' | 'aborted' | 'friction_flagged' | 'skipped_by_approval';
  steps: StepResult[];
  friction_score: number;
  friction_signals: ReturnType<FrictionCollector['getSignals']>;
  error_message?: string;
  started_at: Date;
  completed_at: Date;
}

export type FlowStep = (runner: PersonaRunner) => Promise<void>;

export interface FlowDefinition {
  id: string;
  name: string;
  steps: {
    name: string;
    type: string;
    fn: FlowStep;
    /**
     * Approval category for steps with type='approval'.
     * Passed to the dashboard when requesting operator approval.
     * Defaults to 'registration_submit' if not specified.
     */
    approval_category?: string;
  }[];
}

export interface ExecutionContext {
  baseUrl: string;
  testEmail?: string;
  /** Admin password retrieved from the vault at execution time */
  adminPassword?: string;
  correlationToken?: string;
  paymentProfile?: {
    number: string;
    expiry: string;
    cvv: string;
    zip: string;
    name: string;
  };
}

// Re-export BrowserCapturedState from shared-types (single source of truth)
export type { BrowserCapturedState } from '@qa-platform/shared-types';

export class PersonaRunner {
  private _browser: Browser;
  private _persona: Persona;
  private _page: Page | null = null;
  private _collector: FrictionCollector | null = null;
  private _cleanupFns: Array<() => void> = [];
  private _stepResults: StepResult[] = [];
  private _aborted = false;
  private _capturedState: BrowserCapturedState = { custom: {} };
  readonly executionContext: ExecutionContext;

  constructor(browser: Browser, persona: Persona, executionContext: ExecutionContext) {
    this._browser = browser;
    this._persona = persona;
    this.executionContext = executionContext;
  }

  get persona(): Persona {
    return this._persona;
  }

  get page(): Page {
    if (!this._page) throw new Error('Runner not initialized — call setup() first');
    return this._page;
  }

  get collector(): FrictionCollector {
    if (!this._collector) throw new Error('Runner not initialized — call setup() first');
    return this._collector;
  }

  /** Initialize context and page for the persona */
  async setup(): Promise<void> {
    const context = await createPersonaContext(this._browser, { persona: this._persona });
    this._page = await context.newPage();
    this._collector = new FrictionCollector(this._page, this._persona);

    // Install scroll-up detection
    const cleanup = installScrollUpDetector(this._page, this._collector);
    this._cleanupFns.push(cleanup);

    // Install console-error tracking
    this._page.on('console', msg => {
      if (msg.type() === 'error') {
        this._collector?.record('retry_after_error', undefined, {
          source: 'console_error',
          text: msg.text().slice(0, 200),
        });
      }
    });
  }

  /**
   * Executes a flow definition step by step.
   * Returns a full ExecutionResult with per-step breakdown.
   */
  async executeFlow(flow: FlowDefinition): Promise<ExecutionResult> {
    const startedAt = new Date();

    try {
      for (let i = 0; i < flow.steps.length; i++) {
        if (this._aborted) break;

        const step = flow.steps[i];
        const stepStart = new Date();
        this._collector?.setStep(step.name);

        const stepResult: StepResult = {
          step_name: step.name,
          step_order: i + 1,
          status: 'running',
          started_at: stepStart,
          completed_at: stepStart,
          duration_ms: 0,
        };

        try {
          await step.fn(this);

          // Run accessibility check at each step for relevant personas
          if (
            this._persona.assistive_tech !== AssistiveTech.NONE ||
            this._persona.motor_profile !== MotorProfile.NORMAL ||
            this._persona.comprehension_grade_level <= 6
          ) {
            const a11y = await runPersonaAccessibilityCheck(this._page!, this._persona);
            stepResult.accessibility = a11y;
            if (!a11y.passed) {
              stepResult.status = 'failed';
              stepResult.error_message = `Accessibility violations: ${a11y.violations.map(v => v.rule).join(', ')}`;
            } else {
              stepResult.status = 'passed';
            }
          } else {
            stepResult.status = 'passed';
          }
        } catch (err) {
          stepResult.status = 'failed';
          stepResult.error_message = err instanceof Error ? err.message : String(err);
        } finally {
          stepResult.completed_at = new Date();
          stepResult.duration_ms = stepResult.completed_at.getTime() - stepStart.getTime();
          this._stepResults.push(stepResult);
        }

        if (stepResult.status === 'failed') {
          break; // Stop on first failure (configurable in future)
        }
      }
    } catch (err) {
      const completedAt = new Date();
      return {
        passed: false,
        status: 'failed',
        steps: this._stepResults,
        friction_score: this._collector?.calculateScore() ?? 0,
        friction_signals: this._collector?.getSignals() ?? [],
        error_message: err instanceof Error ? err.message : String(err),
        started_at: startedAt,
        completed_at: completedAt,
      };
    }

    const completedAt = new Date();
    const frictionScore = this._collector?.calculateScore() ?? 0;
    const allPassed = this._stepResults.every(s => s.status === 'passed');
    const hasFailed = this._stepResults.some(s => s.status === 'failed');

    let status: ExecutionResult['status'] = 'passed';
    if (this._aborted) {
      status = 'aborted';
    } else if (hasFailed) {
      status = 'failed';
    } else if (this._collector?.isFrictionFlagged()) {
      status = 'friction_flagged';
    }

    return {
      passed: allPassed && !this._aborted,
      status,
      steps: this._stepResults,
      friction_score: frictionScore,
      friction_signals: this._collector?.getSignals() ?? [],
      started_at: startedAt,
      completed_at: completedAt,
    };
  }

  /** Abort the current execution */
  abort(): void {
    this._aborted = true;
  }

  /** Persona-aware type into a field */
  async type(selector: string, text: string): Promise<void> {
    await personaType(this._page!, selector, text, this._persona);
    this._collector?.recordFieldEdit(selector);
  }

  /** Persona-aware click (with tremor jitter for motor_impaired persona) */
  async click(selector: string): Promise<void> {
    await personaClick(this._page!, selector, this._persona);
    this._collector?.checkLongPause();
  }

  /** Persona-aware hesitation before an action */
  async hesitate(visibleTextLength = 200): Promise<void> {
    await personaHesitate(this._page!, visibleTextLength, this._persona);
  }

  /** Navigate to a URL */
  async goto(url: string): Promise<void> {
    await this._page!.goto(url, { waitUntil: 'networkidle' });
  }

  /** Run accessibility check for the current page state */
  async checkAccessibility(): Promise<AccessibilityResult> {
    return runPersonaAccessibilityCheck(this._page!, this._persona);
  }

  /**
   * Capture state observed during browser flow for Phase 6 API cross-validation.
   * Call this from flow steps to record values (e.g., confirmation ID, email used).
   */
  captureState(key: keyof Omit<BrowserCapturedState, 'custom'>, value: string | number): void;
  captureState(key: string, value: string): void;
  captureState(key: string, value: string | number): void {
    const knownKeys: Array<keyof Omit<BrowserCapturedState, 'custom'>> = [
      'confirmation_id', 'email_used', 'name_used', 'phone_used',
      'order_total', 'payment_status', 'session_name', 'attendee_count',
      'confirmation_url',
    ];

    if (knownKeys.includes(key as keyof Omit<BrowserCapturedState, 'custom'>)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this._capturedState as any)[key] = value;
    } else {
      this._capturedState.custom[key] = String(value);
    }
  }

  /** Get all state captured during browser flow execution */
  getCapturedState(): BrowserCapturedState {
    return { ...this._capturedState, custom: { ...this._capturedState.custom } };
  }

  /** Clean up context and listeners */
  async teardown(): Promise<void> {
    this._cleanupFns.forEach(fn => fn());
    this._collector?.dispose();
    if (this._page) {
      const context = this._page.context();
      await context.close();
    }
  }
}
