/**
 * Email Template Assertions — Phase 16.3
 *
 * Validates emails against site-specific assertion templates.
 * Supports registration, verification, password reset, receipt, and notification emails.
 * Each assertion can match by exact string, substring, or regex.
 */

import type { ParsedEmail, CheckResult, CheckStatus } from './types.js';

// ─── Assertion Types ────────────────────────────────────────────────────────

/** Types of assertions that can be applied to emails */
export type TemplateAssertionType =
  | 'subject_match'
  | 'sender_match'
  | 'body_text_match'
  | 'body_html_match'
  | 'link_present'
  | 'brand_logo'
  | 'brand_footer';

/** A single assertion definition (from DB or site config) */
export interface TemplateAssertion {
  name: string;
  type: TemplateAssertionType;
  expectedValue: string | null;
  isRegex: boolean;
  isRequired: boolean;
}

/** Result of a single template assertion check */
export interface TemplateAssertionResult {
  assertionName: string;
  assertionType: TemplateAssertionType;
  status: CheckStatus;
  detail: string | null;
  expected: string | null;
  actual: string | null;
}

// ─── Assertion Runner ───────────────────────────────────────────────────────

/**
 * Run a set of template assertions against a parsed email.
 *
 * @param email       The parsed email to validate
 * @param assertions  Array of assertion definitions
 * @returns           Array of assertion results
 */
export function runTemplateAssertions(
  email: ParsedEmail,
  assertions: TemplateAssertion[],
): TemplateAssertionResult[] {
  return assertions.map(assertion => executeAssertion(email, assertion));
}

function executeAssertion(
  email: ParsedEmail,
  assertion: TemplateAssertion,
): TemplateAssertionResult {
  const { name, type, expectedValue, isRegex } = assertion;

  switch (type) {
    case 'subject_match':
      return matchField(name, type, email.subject, expectedValue, isRegex);

    case 'sender_match':
      return matchField(name, type, email.from, expectedValue, isRegex);

    case 'body_text_match':
      return matchField(name, type, email.textBody ?? '', expectedValue, isRegex);

    case 'body_html_match':
      return matchField(name, type, email.htmlBody ?? '', expectedValue, isRegex);

    case 'link_present':
      return checkLinkPresent(name, email.links, expectedValue);

    case 'brand_logo':
      return checkHtmlContains(name, type, email.htmlBody, expectedValue, 'Brand logo');

    case 'brand_footer':
      return checkHtmlContains(name, type, email.htmlBody, expectedValue, 'Footer text');

    default:
      return {
        assertionName: name,
        assertionType: type,
        status: 'skipped',
        detail: `Unknown assertion type: ${type}`,
        expected: expectedValue,
        actual: null,
      };
  }
}

function matchField(
  name: string,
  type: TemplateAssertionType,
  actual: string,
  expected: string | null,
  isRegex: boolean,
): TemplateAssertionResult {
  if (!expected) {
    return {
      assertionName: name,
      assertionType: type,
      status: 'skipped',
      detail: 'No expected value configured',
      expected: null,
      actual,
    };
  }

  let matches: boolean;
  if (isRegex) {
    try {
      matches = new RegExp(expected, 'i').test(actual);
    } catch {
      return {
        assertionName: name,
        assertionType: type,
        status: 'error',
        detail: `Invalid regex: ${expected}`,
        expected,
        actual,
      };
    }
  } else {
    matches = actual.toLowerCase().includes(expected.toLowerCase());
  }

  return {
    assertionName: name,
    assertionType: type,
    status: matches ? 'passed' : 'failed',
    detail: matches
      ? `Matched "${expected}" in ${type}`
      : `Expected "${expected}" not found in ${type}`,
    expected,
    actual: actual.length > 200 ? actual.slice(0, 200) + '...' : actual,
  };
}

function checkLinkPresent(
  name: string,
  links: string[],
  expected: string | null,
): TemplateAssertionResult {
  if (!expected) {
    return {
      assertionName: name,
      assertionType: 'link_present',
      status: links.length > 0 ? 'passed' : 'failed',
      detail: links.length > 0
        ? `Found ${links.length} link(s) in email`
        : 'No links found in email',
      expected: null,
      actual: links.length > 0 ? links[0] : null,
    };
  }

  const found = links.some(link =>
    link.toLowerCase().includes(expected.toLowerCase()),
  );

  return {
    assertionName: name,
    assertionType: 'link_present',
    status: found ? 'passed' : 'failed',
    detail: found
      ? `Found link matching "${expected}"`
      : `No link matching "${expected}" found among ${links.length} link(s)`,
    expected,
    actual: links.length > 0 ? links.join(', ').slice(0, 200) : null,
  };
}

function checkHtmlContains(
  name: string,
  type: TemplateAssertionType,
  htmlBody: string | null,
  expected: string | null,
  label: string,
): TemplateAssertionResult {
  if (!htmlBody) {
    return {
      assertionName: name,
      assertionType: type,
      status: 'failed',
      detail: `${label}: no HTML body in email`,
      expected,
      actual: null,
    };
  }

  if (!expected) {
    return {
      assertionName: name,
      assertionType: type,
      status: 'skipped',
      detail: `${label}: no expected value configured`,
      expected: null,
      actual: null,
    };
  }

  const contains = htmlBody.toLowerCase().includes(expected.toLowerCase());
  return {
    assertionName: name,
    assertionType: type,
    status: contains ? 'passed' : 'failed',
    detail: contains
      ? `${label} found: "${expected}"`
      : `${label} not found: "${expected}"`,
    expected,
    actual: null,
  };
}

/**
 * Convert template assertion results to the standard CheckResult format
 * used by the existing email validation pipeline.
 */
export function toCheckResults(results: TemplateAssertionResult[]): CheckResult[] {
  return results.map(r => ({
    check_type: r.assertionType === 'subject_match' ? 'subject_pattern'
      : r.assertionType === 'body_text_match' || r.assertionType === 'body_html_match' ? 'body_pattern'
      : r.assertionType === 'link_present' ? 'link_extract'
      : r.assertionType === 'brand_logo' ? 'brand_logo'
      : r.assertionType === 'brand_footer' ? 'brand_footer'
      : 'delivery' as const,
    status: r.status,
    detail: r.detail,
    url_tested: null,
    diff_percent: null,
    http_status: null,
    artifact_path: null,
  }));
}
