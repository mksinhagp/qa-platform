/**
 * Link Reachability Checker
 *
 * For each link extracted from the email, fires an HTTP HEAD request and
 * records the status code. Any 4xx or 5xx response is a failed check.
 * Redirects are followed up to 5 hops.
 *
 * Per master plan §12.1: "Link extraction (confirmation, OTP, unsubscribe)
 * + broken-link checker against extracted links."
 */

import type { CheckResult, ParsedEmail } from './types.js';

/** Timeout per link check in milliseconds */
const LINK_CHECK_TIMEOUT_MS = 10_000;

/**
 * Check all links in the email for HTTP reachability.
 * Returns one CheckResult per link URL.
 *
 * @param email   Parsed email with extracted links array
 * @param filter  Optional filter function — return false to skip a URL
 */
export async function checkLinkReachability(
  email: ParsedEmail,
  filter?: (url: string) => boolean,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const linksToCheck = filter
    ? email.links.filter(filter)
    : email.links;

  for (const url of linksToCheck) {
    results.push(await checkSingleLink(url));
  }

  return results;
}

async function checkSingleLink(url: string): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);

    let httpStatus: number;
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'QA-Platform-LinkChecker/1.0' },
      });
      httpStatus = response.status;
    } finally {
      clearTimeout(timeoutId);
    }

    const passed = httpStatus >= 200 && httpStatus < 400;
    return {
      check_type: 'link_reachable',
      status: passed ? 'passed' : 'failed',
      detail: passed
        ? `Link returned HTTP ${httpStatus}`
        : `Link returned HTTP ${httpStatus} (expected 2xx/3xx)`,
      url_tested: url,
      diff_percent: null,
      http_status: httpStatus,
      artifact_path: null,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      check_type: 'link_reachable',
      status: 'error',
      detail: isAbort
        ? `Link check timed out after ${LINK_CHECK_TIMEOUT_MS / 1000}s: ${url}`
        : `Link check error: ${err instanceof Error ? err.message : String(err)}`,
      url_tested: url,
      diff_percent: null,
      http_status: null,
      artifact_path: null,
    };
  }
}
