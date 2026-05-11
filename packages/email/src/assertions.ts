/**
 * Email Assertion Engine — runs individual checks against a parsed email.
 *
 * Implements master plan §12.1 checks:
 * - Subject and body pattern assertions
 * - Link extraction and reachability
 * - Brand assertions (logo selector, footer text)
 *
 * Render fidelity (headless Chromium screenshot + pixel diff) is implemented
 * as a separate function that requires the Playwright browser instance from
 * the runner; see renderFidelity.ts.
 */

import * as cheerio from 'cheerio';
import type { ParsedEmail, CheckResult, EmailAssertionSpec } from './types.js';

/**
 * Run all assertion checks against the provided email according to the spec.
 * Returns one CheckResult per assertion type attempted.
 */
export function runEmailAssertions(
  email: ParsedEmail,
  spec: EmailAssertionSpec,
): CheckResult[] {
  const results: CheckResult[] = [];

  // Subject pattern check
  if (spec.subjectPattern !== undefined) {
    results.push(checkSubjectPattern(email, spec.subjectPattern));
  }

  // Body pattern check
  if (spec.bodyPattern !== undefined) {
    results.push(checkBodyPattern(email, spec.bodyPattern));
  }

  // Link extraction (always run if checkLinks enabled or as informational)
  if (spec.checkLinks) {
    results.push(checkLinksExtracted(email));
  }

  // Brand assertions
  if (spec.brandAssertions?.logoSelector) {
    results.push(checkBrandLogo(email, spec.brandAssertions.logoSelector));
  }
  if (spec.brandAssertions?.footerText) {
    results.push(checkBrandFooter(email, spec.brandAssertions.footerText));
  }

  return results;
}

/**
 * Check email subject contains the expected pattern (substring or regex).
 */
function checkSubjectPattern(email: ParsedEmail, pattern: string): CheckResult {
  try {
    const regex = safeRegex(pattern);
    const passed = regex.test(email.subject);
    return {
      check_type: 'subject_pattern',
      status: passed ? 'passed' : 'failed',
      detail: passed
        ? `Subject "${email.subject}" matches pattern "${pattern}"`
        : `Subject "${email.subject}" does not match pattern "${pattern}"`,
      url_tested: null,
      diff_percent: null,
      http_status: null,
      artifact_path: null,
    };
  } catch (err) {
    return errorCheck('subject_pattern', err);
  }
}

/**
 * Check email body (text or HTML) contains the expected pattern.
 */
function checkBodyPattern(email: ParsedEmail, pattern: string): CheckResult {
  try {
    const regex = safeRegex(pattern);
    const bodyText = email.textBody ?? stripHtml(email.htmlBody ?? '');
    const passed = regex.test(bodyText);
    return {
      check_type: 'body_pattern',
      status: passed ? 'passed' : 'failed',
      detail: passed
        ? `Body matches pattern "${pattern}"`
        : `Body does not contain pattern "${pattern}"`,
      url_tested: null,
      diff_percent: null,
      http_status: null,
      artifact_path: null,
    };
  } catch (err) {
    return errorCheck('body_pattern', err);
  }
}

/**
 * Check that at least one link was extracted from the HTML body.
 */
function checkLinksExtracted(email: ParsedEmail): CheckResult {
  const count = email.links.length;
  return {
    check_type: 'link_extract',
    status: count > 0 ? 'passed' : 'failed',
    detail: count > 0
      ? `Extracted ${count} link(s) from email body`
      : 'No links found in email HTML body',
    url_tested: null,
    diff_percent: null,
    http_status: null,
    artifact_path: null,
  };
}

/**
 * Check the HTML body contains an element matching the logo selector.
 */
function checkBrandLogo(email: ParsedEmail, logoSelector: string): CheckResult {
  try {
    if (!email.htmlBody) {
      return {
        check_type: 'brand_logo',
        status: 'skipped',
        detail: 'No HTML body in email',
        url_tested: null,
        diff_percent: null,
        http_status: null,
        artifact_path: null,
      };
    }
    const $ = cheerio.load(email.htmlBody);
    const found = $(logoSelector).length > 0;
    return {
      check_type: 'brand_logo',
      status: found ? 'passed' : 'failed',
      detail: found
        ? `Logo element found matching "${logoSelector}"`
        : `No element found matching logo selector "${logoSelector}"`,
      url_tested: null,
      diff_percent: null,
      http_status: null,
      artifact_path: null,
    };
  } catch (err) {
    return errorCheck('brand_logo', err);
  }
}

/**
 * Check the HTML body (or text body) contains the required footer text.
 */
function checkBrandFooter(email: ParsedEmail, footerText: string): CheckResult {
  try {
    const searchIn = email.htmlBody
      ? stripHtml(email.htmlBody)
      : (email.textBody ?? '');
    const found = searchIn.toLowerCase().includes(footerText.toLowerCase());
    return {
      check_type: 'brand_footer',
      status: found ? 'passed' : 'failed',
      detail: found
        ? `Footer text "${footerText}" found in email body`
        : `Footer text "${footerText}" not found in email body`,
      url_tested: null,
      diff_percent: null,
      http_status: null,
      artifact_path: null,
    };
  } catch (err) {
    return errorCheck('brand_footer', err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a regex from a pattern string. If the string is a valid regex
 * (wrapped in /…/flags notation), parse it; otherwise treat as literal
 * case-insensitive substring.
 */
function safeRegex(pattern: string): RegExp {
  const regexMatch = /^\/(.+)\/([gimsuy]*)$/.exec(pattern);
  if (regexMatch) {
    return new RegExp(regexMatch[1], regexMatch[2]);
  }
  // Treat as literal substring — escape special chars
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function errorCheck(type: CheckResult['check_type'], err: unknown): CheckResult {
  return {
    check_type: type,
    status: 'error',
    detail: `Check threw an error: ${err instanceof Error ? err.message : String(err)}`,
    url_tested: null,
    diff_percent: null,
    http_status: null,
    artifact_path: null,
  };
}
