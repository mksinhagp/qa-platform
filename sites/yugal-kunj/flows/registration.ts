/**
 * Flow: registration
 * Site: Yugal Kunj QA Portal
 *
 * Covers: browse camps → select a camp → fill registration form → submit (approval-gated).
 * Approval category: registration_submit (one_click strength per §8.1).
 *
 * This flow validates:
 * - Registration form renders with expected fields
 * - Persona-aware form fill (typing speed, errors, hesitation)
 * - Submit is paused for operator approval before execution
 * - On approval: confirmation element appears
 * - On rejection: step is recorded as skipped_by_approval
 * - Email confirmation sent (checked by email module in Phase 6)
 *
 * Test accounts: stored in vault as site_credentials for role "test_registrant".
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

// Synthetic test data — real PII never used in QA runs
const TEST_REGISTRANT = {
  first_name: 'QA',
  last_name: 'Tester',
  email: 'qa@example.com',
  phone: '555-000-1234',
  dob: '01/01/1990',
};

export const registrationFlow: FlowDefinition = {
  id: 'registration',
  name: 'Camp Registration',
  steps: [
    {
      name: 'navigate_to_camp_listing',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('navigate_to_camp_listing');
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/camp/center');
        await runner.page.waitForFunction(
          '() => document.querySelector("#root")?.children.length > 0',
          { timeout: 15000 },
        );
        await runner.hesitate(250);
      },
    },

    {
      name: 'select_first_camp',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('select_first_camp');

        await runner.page.waitForSelector('.camp-card, .card, [class*="Camp"]', {
          timeout: 15000,
        });

        await runner.hesitate(200);

        // Click the first camp register / detail button
        const btn = await runner.page.$(
          '.camp-card button, .card button, ' +
          '[class*="register"], [class*="Register"], ' +
          '[class*="detail"], [class*="Detail"]',
        );

        if (!btn) {
          // Fall back: click first card
          const card = await runner.page.$('.camp-card, .card');
          if (!card) throw new Error('No camp cards found on listing page');
          await card.click();
        } else {
          await runner.hesitate(100);
          await btn.click();
        }

        // Wait for route change / modal / detail pane
        await runner.page.waitForTimeout(2000);
      },
    },

    {
      name: 'find_register_button',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('find_register_button');
        await runner.hesitate(200);

        // Look for a prominent "Register" / "Sign Up" CTA
        const registerBtn = await runner.page.$(
          'button:has-text("Register"), button:has-text("Sign Up"), ' +
          'a:has-text("Register"), a:has-text("Sign Up"), ' +
          '[class*="register-btn"], [class*="RegisterBtn"]',
        );

        if (!registerBtn) {
          // Some flows inline the form — skip this step gracefully
          return;
        }

        await registerBtn.click();
        await runner.page.waitForTimeout(1500);
      },
    },

    {
      name: 'fill_registration_form',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('fill_registration_form');

        // Wait for at least one form input to appear
        await runner.page.waitForSelector('input', { timeout: 10000 });
        await runner.hesitate(300);

        // First name
        const fnField = await runner.page.$(
          'input[name="firstName"], input[placeholder*="First"], input[name="first_name"]',
        );
        if (fnField) {
          await fnField.click();
          await runner.type(
            'input[name="firstName"], input[placeholder*="First"], input[name="first_name"]',
            TEST_REGISTRANT.first_name,
          );
        }

        // Last name
        const lnField = await runner.page.$(
          'input[name="lastName"], input[placeholder*="Last"], input[name="last_name"]',
        );
        if (lnField) {
          await runner.type(
            'input[name="lastName"], input[placeholder*="Last"], input[name="last_name"]',
            TEST_REGISTRANT.last_name,
          );
        }

        // Email
        const emailField = await runner.page.$('input[type="email"], input[name="email"]');
        if (emailField) {
          await runner.type(
            'input[type="email"], input[name="email"]',
            runner.executionContext.testEmail ?? TEST_REGISTRANT.email,
          );
        }

        // Phone
        const phoneField = await runner.page.$('input[type="tel"], input[name="phone"]');
        if (phoneField) {
          await runner.type(
            'input[type="tel"], input[name="phone"]',
            TEST_REGISTRANT.phone,
          );
        }

        // Date of birth
        const dobField = await runner.page.$(
          'input[name="dob"], input[name="dateOfBirth"], input[placeholder*="birth"]',
        );
        if (dobField) {
          await runner.type(
            'input[name="dob"], input[name="dateOfBirth"], input[placeholder*="birth"]',
            TEST_REGISTRANT.dob,
          );
        }

        await runner.hesitate(400);
      },
    },

    {
      name: 'check_form_accessibility',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('check_form_accessibility');
        await runner.checkAccessibility();
      },
    },

    {
      name: 'await_registration_approval',
      type: 'approval',
      approval_category: 'registration_submit',
      fn: async (runner: PersonaRunner) => {
        // The ExecutionManager intercepts steps with type='approval': it posts an
        // approval request to the dashboard and waits for an operator decision
        // BEFORE calling fn(). If approved, fn() runs (this brief hesitate).
        // If rejected or timed out, fn() is NOT called and the step is recorded as
        // skipped_by_approval. The actual form submit is the next step (submit_registration).
        runner.collector.setStep('await_registration_approval');
        await runner.hesitate(100); // brief pause between approval and submit
      },
    },

    {
      name: 'submit_registration',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('submit_registration');

        const submitBtn = await runner.page.$(
          'button[type="submit"], button:has-text("Submit"), button:has-text("Register")',
        );

        if (!submitBtn) {
          throw new Error('Submit button not found — form may have changed structure');
        }

        await runner.click(
          'button[type="submit"], button:has-text("Submit"), button:has-text("Register")',
        );

        // Wait for success or error response
        await runner.page.waitForTimeout(3000);
      },
    },

    {
      name: 'verify_confirmation',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_confirmation');

        // Check for success indicator
        const success = await runner.page.$(
          '[class*="success"], [class*="Success"], [class*="confirm"], ' +
          '[class*="thank"], [class*="Thank"]',
        );

        if (!success) {
          // Check for inline error
          const error = await runner.page.$(
            '[class*="error"], [class*="Error"], .alert-danger, [role="alert"]',
          );

          if (error) {
            const errorText = await error.textContent();
            throw new Error(`Registration failed with error: ${errorText?.trim() ?? 'unknown'}`);
          }

          throw new Error(
            'Registration submitted but no confirmation or error message found',
          );
        }
      },
    },
  ],
};
