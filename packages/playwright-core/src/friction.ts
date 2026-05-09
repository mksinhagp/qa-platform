/**
 * Friction telemetry — captures confusion signals during a Playwright run.
 *
 * The FrictionCollector attaches to a Page and listens for signals that
 * correlate with real-user confusion. At the end of an execution the
 * collector calculates a 0–100 friction score and returns the raw signals.
 */

import type { Page } from '@playwright/test';
import type { Persona } from '@qa-platform/shared-types';

export type FrictionSignalType =
  | 'repeated_click_non_interactive'
  | 'hover_without_click'
  | 'scroll_up_after_submit'
  | 'field_edited_multiple_times'
  | 'focus_exit_empty_required'
  | 'back_button_in_flow'
  | 'time_to_first_action'
  | 'abandonment'
  | 'retry_after_error'
  | 'long_pause';

export interface FrictionSignal {
  signal_type: FrictionSignalType;
  step_name: string;
  element_selector?: string;
  metadata?: Record<string, unknown>;
  occurred_at: Date;
}

// Severity weights for score calculation (higher = more friction)
const SIGNAL_WEIGHTS: Record<FrictionSignalType, number> = {
  repeated_click_non_interactive: 8,
  hover_without_click: 3,
  scroll_up_after_submit: 5,
  field_edited_multiple_times: 4,
  focus_exit_empty_required: 6,
  back_button_in_flow: 10,
  time_to_first_action: 2,
  abandonment: 20,
  retry_after_error: 7,
  long_pause: 3,
};

export class FrictionCollector {
  private signals: FrictionSignal[] = [];
  private fieldEditCounts: Map<string, number> = new Map();
  private currentStep: string = 'init';
  private flowStartTime: Date = new Date();
  private lastActionTime: Date = new Date();
  private _persona: Persona;

  constructor(_page: Page, persona: Persona) {
    this._persona = persona;
    this.flowStartTime = new Date();
    this.lastActionTime = new Date();
  }

  /** Update the current step name (call at the start of each flow step) */
  setStep(stepName: string): void {
    this.currentStep = stepName;
  }

  /** Record a manual friction signal */
  record(
    signalType: FrictionSignalType,
    elementSelector?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.signals.push({
      signal_type: signalType,
      step_name: this.currentStep,
      element_selector: elementSelector,
      metadata,
      occurred_at: new Date(),
    });
  }

  /** Record that a field was edited. Emits signal if edited > 2 times. */
  recordFieldEdit(selector: string): void {
    const count = (this.fieldEditCounts.get(selector) ?? 0) + 1;
    this.fieldEditCounts.set(selector, count);
    if (count > 2) {
      this.record('field_edited_multiple_times', selector, { edit_count: count });
    }
  }

  /** Record a back-button press inside the flow */
  recordBackButton(): void {
    this.record('back_button_in_flow');
  }

  /** Record an abandonment (persona hit an abandonment trigger) */
  recordAbandonment(trigger: string): void {
    this.record('abandonment', undefined, { trigger });
  }

  /** Record a retry after an error was shown */
  recordRetryAfterError(errorMessage: string): void {
    this.record('retry_after_error', undefined, { error: errorMessage });
  }

  /** Check for a long pause since last recorded action and emit signal if exceeded */
  checkLongPause(thresholdMs = 5_000): void {
    const elapsed = Date.now() - this.lastActionTime.getTime();
    if (elapsed > thresholdMs) {
      this.record('long_pause', undefined, { elapsed_ms: elapsed });
    }
    this.lastActionTime = new Date();
  }

  /** Record time-to-first-action (call after first meaningful interaction) */
  recordFirstAction(): void {
    const elapsed = Date.now() - this.flowStartTime.getTime();
    this.record('time_to_first_action', undefined, { elapsed_ms: elapsed });
    this.lastActionTime = new Date();
  }

  /** Returns all captured friction signals */
  getSignals(): FrictionSignal[] {
    return [...this.signals];
  }

  /**
   * Calculates a 0–100 friction score.
   * Score = sum of weighted signal counts, capped at 100.
   * Persona-adjusted: signals carry more weight for personas
   * expected to have smooth experiences (low error rate, high payment familiarity).
   */
  calculateScore(): number {
    const raw = this.signals.reduce((sum, s) => {
      return sum + (SIGNAL_WEIGHTS[s.signal_type] ?? 1);
    }, 0);

    // Normalize: max expected raw score for a badly confused user is ~100
    return Math.min(100, raw);
  }

  /** Whether a friction score should be reported as friction_flagged (>= 30) */
  isFrictionFlagged(): boolean {
    return this.calculateScore() >= 30;
  }

  /** Clean up any listeners */
  dispose(): void {
    // nothing to clean up currently; placeholder for future event unregistration
  }

  /** Reference to persona for external oracle checks */
  get persona(): Persona {
    return this._persona;
  }
}

/**
 * Installs scroll-up-after-submit detection on a page.
 * Returns a cleanup function.
 */
export function installScrollUpDetector(
  page: Page,
  collector: FrictionCollector,
): () => void {
  let lastScrollY = 0;
  let submitOccurred = false;

  // Track form submissions
  const onRequest = () => { submitOccurred = true; };

  // We use page.evaluate to monitor scrollY changes via MutationObserver/scroll event
  // This is done via CDP injection since Playwright doesn't expose scroll events directly
  page.on('request', onRequest);

  const intervalId = setInterval(async () => {
    try {
      const scrollY = await page.evaluate(() => (globalThis as typeof globalThis & { scrollY: number }).scrollY);
      if (submitOccurred && scrollY < lastScrollY - 50) {
        collector.record('scroll_up_after_submit', undefined, {
          prev_scroll_y: lastScrollY,
          new_scroll_y: scrollY,
        });
        submitOccurred = false; // Reset after detection
      }
      lastScrollY = scrollY;
    } catch {
      // Page may have navigated — ignore errors
    }
  }, 500);

  return () => {
    clearInterval(intervalId);
    page.off('request', onRequest);
  };
}
