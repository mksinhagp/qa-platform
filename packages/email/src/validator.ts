/**
 * Email Validator — orchestrates the full validation pipeline.
 *
 * Sequence:
 *   1. Wait for delivery via IMAP polling
 *   2. Run assertion checks (subject, body, brand)
 *   3. Check link reachability (if enabled)
 *   4. Render fidelity check is intentionally deferred to the runner
 *      (requires a live Playwright Page context) — see runner integration.
 *
 * Returns a full EmailValidationResult with per-check details.
 */

import { waitForDelivery } from './delivery.js';
import { runEmailAssertions } from './assertions.js';
import { checkLinkReachability } from './linkChecker.js';
import type {
  ImapConfig,
  EmailAssertionSpec,
  EmailValidationResult,
  CheckResult,
  DeliveryCheckOptions,
} from './types.js';

/**
 * Run the full email validation pipeline.
 *
 * @param config       IMAP credentials
 * @param token        Correlation token embedded in the test email address
 * @param startedAt    Time the triggering flow action completed (start of delivery window)
 * @param spec         Assertion spec from site rules
 * @param deliveryOpts IMAP polling options (timeouts, interval)
 */
export async function validateEmail(
  config: ImapConfig,
  token: string,
  startedAt: Date,
  spec: EmailAssertionSpec,
  deliveryOpts: DeliveryCheckOptions = {},
): Promise<EmailValidationResult> {
  // Step 1: Wait for delivery
  const deliveryResult = await waitForDelivery(config, token, startedAt, deliveryOpts);

  const deliveryCheck: CheckResult = {
    check_type: 'delivery',
    status: deliveryResult.delivered ? 'passed' : 'failed',
    detail: deliveryResult.delivered
      ? `Email delivered in ${deliveryResult.latencyMs}ms after ${deliveryResult.pollCount} poll(s)`
      : (deliveryResult.error ?? 'Email not delivered within the check window'),
    url_tested: null,
    diff_percent: null,
    http_status: null,
    artifact_path: null,
  };

  const allChecks: CheckResult[] = [deliveryCheck];

  if (!deliveryResult.delivered || !deliveryResult.email) {
    // Skip all downstream checks — no email to inspect
    return {
      passed: false,
      deliveryResult,
      checks: allChecks,
    };
  }

  const email = deliveryResult.email;

  // Step 2: Assertion checks (subject, body, brand)
  const assertionChecks = runEmailAssertions(email, spec);
  allChecks.push(...assertionChecks);

  // Step 3: Link reachability (if enabled)
  if (spec.checkLinks && email.links.length > 0) {
    const linkChecks = await checkLinkReachability(email);
    allChecks.push(...linkChecks);
  } else if (spec.checkLinks && email.links.length === 0) {
    allChecks.push({
      check_type: 'link_reachable',
      status: 'skipped',
      detail: 'No links extracted from email body',
      url_tested: null,
      diff_percent: null,
      http_status: null,
      artifact_path: null,
    });
  }

  // Overall pass: delivery passed AND no failed/error non-skipped checks
  const passed = allChecks.every(
    c => c.status === 'passed' || c.status === 'skipped',
  );

  return { passed, deliveryResult, checks: allChecks };
}
