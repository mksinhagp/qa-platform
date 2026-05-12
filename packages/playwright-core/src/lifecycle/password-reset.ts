/**
 * Password Reset Flow — Phase 15.4
 *
 * Handles the password reset lifecycle:
 * 1. Navigate to reset page and enter identifier
 * 2. Wait for reset email (delegated to email module)
 * 3. Follow reset link and enter new password
 * 4. Verify new login works
 */

import type { Page } from '@playwright/test';

/** Password reset selectors from site configuration */
export interface PasswordResetSelectors {
  triggerLink: string;
  emailInput: string;
  submitButton: string;
  newPasswordInput: string;
  confirmPasswordInput?: string;
  resetSubmitButton?: string;
  successIndicator: string;
  errorIndicator?: string;
}

/** Result of a password reset attempt */
export interface PasswordResetResult {
  success: boolean;
  phase: 'request' | 'email_wait' | 'reset_form' | 'verification';
  errorMessage?: string;
  durationMs: number;
  newPasswordSet: boolean;
}

/**
 * Step 1: Request a password reset by entering the user's email.
 *
 * @param page      Playwright page instance
 * @param email     The email address to reset
 * @param selectors Site-specific selectors
 * @param options   Timeout options
 */
export async function requestPasswordReset(
  page: Page,
  email: string,
  selectors: PasswordResetSelectors,
  options: { timeoutMs?: number; hesitateMs?: number } = {},
): Promise<PasswordResetResult> {
  const startTime = Date.now();
  const hesitate = options.hesitateMs ?? 200;

  try {
    // Click the "forgot password" link
    await page.waitForSelector(selectors.triggerLink, {
      timeout: options.timeoutMs ?? 10000,
    });
    await page.click(selectors.triggerLink);
    await page.waitForTimeout(1500);

    // Enter email
    await page.waitForSelector(selectors.emailInput, { timeout: 5000 });
    await page.fill(selectors.emailInput, email);
    if (hesitate > 0) await page.waitForTimeout(hesitate);

    // Submit
    await page.click(selectors.submitButton);
    await page.waitForTimeout(2000);

    return {
      success: true,
      phase: 'request',
      durationMs: Date.now() - startTime,
      newPasswordSet: false,
    };
  } catch (err) {
    return {
      success: false,
      phase: 'request',
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
      newPasswordSet: false,
    };
  }
}

/**
 * Step 3: Complete the password reset by following the link and entering a new password.
 *
 * @param page         Playwright page instance
 * @param resetLink    The password reset URL from the email
 * @param newPassword  The new password to set
 * @param selectors    Site-specific selectors
 * @param options      Timeout options
 */
export async function completePasswordReset(
  page: Page,
  resetLink: string,
  newPassword: string,
  selectors: PasswordResetSelectors,
  options: { timeoutMs?: number; hesitateMs?: number } = {},
): Promise<PasswordResetResult> {
  const startTime = Date.now();
  const hesitate = options.hesitateMs ?? 200;

  try {
    await page.goto(resetLink, { timeout: options.timeoutMs ?? 15000 });
    await page.waitForTimeout(2000);

    // Enter new password
    await page.waitForSelector(selectors.newPasswordInput, { timeout: 5000 });
    await page.fill(selectors.newPasswordInput, newPassword);
    if (hesitate > 0) await page.waitForTimeout(hesitate);

    // Confirm password (if separate field exists)
    if (selectors.confirmPasswordInput) {
      await page.fill(selectors.confirmPasswordInput, newPassword);
      if (hesitate > 0) await page.waitForTimeout(hesitate);
    }

    // Submit
    const submitBtn = selectors.resetSubmitButton ?? selectors.submitButton;
    await page.click(submitBtn);
    await page.waitForTimeout(2000);

    const success = await page.$(selectors.successIndicator);
    if (success) {
      return {
        success: true,
        phase: 'reset_form',
        durationMs: Date.now() - startTime,
        newPasswordSet: true,
      };
    }

    const errorEl = selectors.errorIndicator
      ? await page.$(selectors.errorIndicator)
      : null;
    const errorText = errorEl ? await errorEl.textContent() : null;

    return {
      success: false,
      phase: 'reset_form',
      errorMessage: errorText?.trim() ?? 'Password reset form did not show success',
      durationMs: Date.now() - startTime,
      newPasswordSet: false,
    };
  } catch (err) {
    return {
      success: false,
      phase: 'reset_form',
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
      newPasswordSet: false,
    };
  }
}

/**
 * Extract a password reset link from email HTML body.
 */
export function extractResetLink(htmlBody: string): string | null {
  const linkRegex = /href=["']([^"']*(?:reset|password|recover)[^"']*)["']/gi;
  const match = linkRegex.exec(htmlBody);
  return match ? match[1] : null;
}
