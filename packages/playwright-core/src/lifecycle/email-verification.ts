/**
 * Email Verification Flow — Phase 15.3
 *
 * Handles email verification after registration. Supports:
 * - Link extraction: clicks verification link from email
 * - Code extraction: enters verification code from email
 */

import type { Page } from '@playwright/test';

/** How verification is completed */
export type VerificationMethod = 'link_click' | 'code_entry';

/** Verification selectors from site configuration */
export interface VerificationSelectors {
  codeInput?: string;
  submitButton?: string;
  successIndicator: string;
  errorIndicator?: string;
}

/** Result of an email verification attempt */
export interface VerificationResult {
  success: boolean;
  method: VerificationMethod;
  errorMessage?: string;
  durationMs: number;
}

/**
 * Complete email verification by clicking a link from the email.
 *
 * @param page  Playwright page instance
 * @param link  Verification URL extracted from the email
 * @param selectors  Site-specific selectors for success/error detection
 * @param options  Timeout and other options
 */
export async function verifyByLink(
  page: Page,
  link: string,
  selectors: VerificationSelectors,
  options: { timeoutMs?: number } = {},
): Promise<VerificationResult> {
  const startTime = Date.now();
  const timeout = options.timeoutMs ?? 15000;

  try {
    await page.goto(link, { timeout });
    await page.waitForTimeout(3000);

    const success = await page.$(selectors.successIndicator);
    if (success) {
      return {
        success: true,
        method: 'link_click',
        durationMs: Date.now() - startTime,
      };
    }

    const errorEl = selectors.errorIndicator
      ? await page.$(selectors.errorIndicator)
      : null;
    const errorText = errorEl ? await errorEl.textContent() : null;

    return {
      success: false,
      method: 'link_click',
      errorMessage: errorText?.trim() ?? 'Verification link did not result in success',
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      method: 'link_click',
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Complete email verification by entering a code from the email.
 *
 * @param page  Playwright page instance
 * @param code  Verification code extracted from the email
 * @param selectors  Site-specific selectors for the code input and submit
 * @param options  Timeout and other options
 */
export async function verifyByCode(
  page: Page,
  code: string,
  selectors: VerificationSelectors,
  options: { timeoutMs?: number; hesitateMs?: number } = {},
): Promise<VerificationResult> {
  const startTime = Date.now();
  const hesitate = options.hesitateMs ?? 200;

  try {
    if (!selectors.codeInput) {
      return {
        success: false,
        method: 'code_entry',
        errorMessage: 'No code input selector configured',
        durationMs: Date.now() - startTime,
      };
    }

    await page.waitForSelector(selectors.codeInput, {
      timeout: options.timeoutMs ?? 10000,
    });
    await page.fill(selectors.codeInput, code);
    if (hesitate > 0) await page.waitForTimeout(hesitate);

    const submitBtn = selectors.submitButton ?? 'button[type="submit"]';
    await page.click(submitBtn);
    await page.waitForTimeout(2000);

    const success = await page.$(selectors.successIndicator);
    if (success) {
      return {
        success: true,
        method: 'code_entry',
        durationMs: Date.now() - startTime,
      };
    }

    const errorEl = selectors.errorIndicator
      ? await page.$(selectors.errorIndicator)
      : null;
    const errorText = errorEl ? await errorEl.textContent() : null;

    return {
      success: false,
      method: 'code_entry',
      errorMessage: errorText?.trim() ?? 'Code verification did not result in success',
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      method: 'code_entry',
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract a verification code from email body text.
 * Looks for common patterns: 6-digit codes, alphanumeric tokens.
 */
export function extractVerificationCode(emailBody: string): string | null {
  // Pattern 1: "verification code is 123456" or "code: 123456"
  const codeMatch = emailBody.match(/(?:code|pin|otp)\s*(?:is|:)\s*(\d{4,8})/i);
  if (codeMatch) return codeMatch[1];

  // Pattern 2: Standalone 6-digit number on its own line
  const standaloneMatch = emailBody.match(/^\s*(\d{6})\s*$/m);
  if (standaloneMatch) return standaloneMatch[1];

  // Pattern 3: Bold or emphasized code
  const boldMatch = emailBody.match(/<(?:strong|b|em)>\s*(\d{4,8})\s*<\/(?:strong|b|em)>/i);
  if (boldMatch) return boldMatch[1];

  return null;
}

/**
 * Extract a verification link from email HTML body.
 * Looks for links containing common verification URL patterns.
 */
export function extractVerificationLink(htmlBody: string): string | null {
  const linkRegex = /href=["']([^"']*(?:verify|confirm|activate|validate)[^"']*)["']/gi;
  const match = linkRegex.exec(htmlBody);
  if (match) return match[1];

  // Fallback: look for links with token/code parameters
  const tokenLinkRegex = /href=["']([^"']*(?:\?|&)(?:token|code|key)=[^"']*)["']/gi;
  const tokenMatch = tokenLinkRegex.exec(htmlBody);
  if (tokenMatch) return tokenMatch[1];

  return null;
}
