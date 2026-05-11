/**
 * Delivery Checker — polls IMAP on an interval until the email arrives or timeout.
 *
 * Follows master plan §12.1:
 * - IMAP-first integration
 * - Per-run inbox correlation token
 * - Delivery confirmation with timing metadata
 */

import { fetchEmailByToken } from './imap.js';
import type { ImapConfig, DeliveryCheckOptions, DeliveryResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_POLL_INTERVAL_MS = 15 * 1000; // 15 seconds

/**
 * Poll the IMAP inbox until an email matching the correlation token arrives
 * or the timeout is exceeded.
 *
 * @param config     IMAP credentials
 * @param token      Correlation token to search for in recipient address
 * @param startedAt  Timestamp when the flow action that triggers the email was completed
 * @param options    Polling configuration
 */
export async function waitForDelivery(
  config: ImapConfig,
  token: string,
  startedAt: Date,
  options: DeliveryCheckOptions = {},
): Promise<DeliveryResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const folder = options.folder ?? 'INBOX';

  // Anchor the deadline to now, not startedAt.
  // startedAt is the time the triggering flow action completed and is used only
  // as the IMAP SINCE boundary inside fetchEmailByToken. The polling window
  // should start from when waitForDelivery is actually called — otherwise any
  // processing delay between flow completion and this call silently shrinks the window.
  const checkStartedAt = Date.now();
  const deadline = checkStartedAt + timeoutMs;
  let pollCount = 0;

  while (Date.now() < deadline) {
    pollCount++;
    try {
      const email = await fetchEmailByToken(config, token, folder, startedAt);
      if (email) {
        return {
          delivered: true,
          email,
          latencyMs: email.date.getTime() - startedAt.getTime(),
          pollCount,
          error: null,
        };
      }
    } catch (err) {
      // Log but continue polling — transient IMAP errors are common
      const message = err instanceof Error ? err.message : String(err);
      // Only surface as error result if we've exhausted retries
      if (Date.now() >= deadline) {
        return {
          delivered: false,
          email: null,
          latencyMs: null,
          pollCount,
          error: `IMAP error on final poll attempt: ${message}`,
        };
      }
    }

    // Wait before next poll (skip wait on last iteration)
    if (Date.now() + pollIntervalMs < deadline) {
      await sleep(pollIntervalMs);
    }
  }

  return {
    delivered: false,
    email: null,
    latencyMs: null,
    pollCount,
    error: `Email not received within ${timeoutMs / 1000}s (${pollCount} polls, started ${new Date(checkStartedAt).toISOString()})`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
