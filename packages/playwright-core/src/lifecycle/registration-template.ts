/**
 * Registration Flow Template — Phase 15.1
 *
 * Reusable registration flow that reads site-specific field mappings,
 * selectors, and persona data to fill and submit a registration form.
 * Works with any site configured via the Phase 14 generic site model.
 */

import type { Page } from '@playwright/test';

/** Registration field mapping from site rules */
export interface RegistrationFieldMapping {
  /** Maps canonical field names to CSS selectors */
  selectors: Record<string, string>;
  /** Maps canonical field names to site-specific form field names */
  fieldNames?: Record<string, string>;
}

/** Persona identity data for form filling */
export interface PersonaIdentity {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  username?: string;
  password?: string;
  [key: string]: string | undefined;
}

/** Result of a registration attempt */
export interface RegistrationResult {
  success: boolean;
  accountId?: string;
  confirmationText?: string;
  errorMessage?: string;
  durationMs: number;
  fieldsSubmitted: string[];
}

/**
 * Execute a generic registration flow using site-specific configuration.
 *
 * @param page         Playwright page instance
 * @param identity     Persona-generated identity data
 * @param fieldMapping Site-specific field mapping and selectors
 * @param options      Additional options (timeout, submit selector, etc.)
 */
export async function executeRegistration(
  page: Page,
  identity: PersonaIdentity,
  fieldMapping: RegistrationFieldMapping,
  options: {
    submitSelector?: string;
    successSelector?: string;
    errorSelector?: string;
    timeoutMs?: number;
    hesitateMs?: number;
  } = {},
): Promise<RegistrationResult> {
  const startTime = Date.now();
  const fieldsSubmitted: string[] = [];
  const timeout = options.timeoutMs ?? 10000;
  const hesitate = options.hesitateMs ?? 200;

  // Standard field-to-identity mapping
  const fieldMap: Record<string, string | undefined> = {
    form_first_name: identity.firstName,
    form_last_name: identity.lastName,
    form_email: identity.email,
    form_phone: identity.phone,
    form_username: identity.username,
    form_password: identity.password,
    form_confirm_password: identity.password,
    form_dob: identity.dateOfBirth,
  };

  // Apply custom field name overrides from site rules
  if (fieldMapping.fieldNames) {
    for (const [canonical, siteName] of Object.entries(fieldMapping.fieldNames)) {
      if (siteName && identity[canonical]) {
        fieldMap[siteName] = identity[canonical];
      }
    }
  }

  // Fill each field that has both a selector and a value
  for (const [fieldKey, value] of Object.entries(fieldMap)) {
    if (!value) continue;
    const selector = fieldMapping.selectors[fieldKey];
    if (!selector) continue;

    try {
      const field = await page.$(selector);
      if (field) {
        await field.click();
        if (hesitate > 0) await page.waitForTimeout(hesitate);
        await field.fill(value);
        fieldsSubmitted.push(fieldKey);
      }
    } catch {
      // Field not found or not interactable — skip
    }
  }

  // Submit the form
  const submitSelector = options.submitSelector
    ?? fieldMapping.selectors['submit_button']
    ?? 'button[type="submit"]';

  try {
    const submitBtn = await page.$(submitSelector);
    if (!submitBtn) {
      return {
        success: false,
        errorMessage: 'Submit button not found',
        durationMs: Date.now() - startTime,
        fieldsSubmitted,
      };
    }

    await submitBtn.click();
    await page.waitForTimeout(Math.min(timeout, 3000));
  } catch (err) {
    return {
      success: false,
      errorMessage: `Submit failed: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - startTime,
      fieldsSubmitted,
    };
  }

  // Check for success or error
  const successSelector = options.successSelector
    ?? fieldMapping.selectors['success_message']
    ?? '[class*="success"], [data-testid="success"]';

  const errorSelector = options.errorSelector
    ?? fieldMapping.selectors['error_message']
    ?? '[class*="error"], [role="alert"]';

  const successEl = await page.$(successSelector);
  if (successEl) {
    const text = await successEl.textContent();
    return {
      success: true,
      confirmationText: text?.trim() ?? undefined,
      durationMs: Date.now() - startTime,
      fieldsSubmitted,
    };
  }

  const errorEl = await page.$(errorSelector);
  if (errorEl) {
    const text = await errorEl.textContent();
    return {
      success: false,
      errorMessage: text?.trim() ?? 'Unknown error',
      durationMs: Date.now() - startTime,
      fieldsSubmitted,
    };
  }

  return {
    success: false,
    errorMessage: 'No success or error message found after submission',
    durationMs: Date.now() - startTime,
    fieldsSubmitted,
  };
}
