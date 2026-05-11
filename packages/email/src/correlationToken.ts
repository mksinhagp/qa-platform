/**
 * Correlation Token Utilities
 *
 * Each test run execution gets a unique token that is embedded in the test
 * email address as a plus-suffix: user+<token>@example.com.
 * This lets the IMAP poller isolate emails for a specific execution even if
 * multiple test runs share the same inbox.
 */

import { randomBytes } from 'crypto';

/**
 * Generate a URL-safe 12-character correlation token.
 * Short enough to fit inside an email local-part but still globally unique
 * across concurrent test runs.
 */
export function generateCorrelationToken(): string {
  return randomBytes(9).toString('base64url'); // 12 chars
}

/**
 * Build a test email address by inserting the correlation token as a
 * plus-suffix into the base address.
 *
 * Examples:
 *   buildTestEmailAddress('qa@example.com', 'abc123xyz') → 'qa+abc123xyz@example.com'
 *   buildTestEmailAddress('qa+base@example.com', 'tok') → 'qa+base+tok@example.com'
 *
 * @param baseAddress  The inbox's base email address (from email_inboxes.username)
 * @param token        The correlation token
 */
export function buildTestEmailAddress(baseAddress: string, token: string): string {
  const atIdx = baseAddress.lastIndexOf('@');
  if (atIdx === -1) {
    throw new Error(`Invalid email address: "${baseAddress}"`);
  }
  const local = baseAddress.slice(0, atIdx);
  const domain = baseAddress.slice(atIdx + 1);
  return `${local}+${token}@${domain}`;
}

/**
 * Extract the correlation token from a test email address.
 * Returns null if the address has no plus-suffix.
 */
export function extractCorrelationToken(address: string): string | null {
  const atIdx = address.lastIndexOf('@');
  if (atIdx === -1) return null;
  const local = address.slice(0, atIdx);
  const plusIdx = local.lastIndexOf('+');
  if (plusIdx === -1) return null;
  return local.slice(plusIdx + 1);
}
