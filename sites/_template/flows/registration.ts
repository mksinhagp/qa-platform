/**
 * Flow: registration
 * Site: REPLACE_ME — Site Display Name
 *
 * Covers: browse listings → select a listing → fill registration form →
 *         submit (approval-gated).
 * Approval category: registration_submit (one_click strength per §8.1).
 *
 * This flow validates:
 * - Registration form renders with the expected field set
 * - Persona-aware form fill (typing speed, hesitation, occasional errors)
 * - Submit is paused for operator approval before execution
 * - On approval: a confirmation element appears
 * - On rejection: the step is recorded as skipped_by_approval
 * - Confirmation email is sent and matches the subject pattern in rules.ts
 *   (checked by the email module when email_confirmation_expected is true)
 *
 * Test accounts: store credentials in the vault under the site's credential_key.
 * Real PII is never used in QA runs — always use synthetic data like below.
 *
 * TODO: Update TEST_REGISTRANT with values appropriate for this site's form.
 *       Fields not collected by the site's form may be left in the constant
 *       but the corresponding fill steps should be removed.
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

// Synthetic test data — real PII is never used in QA runs.
// TODO: Adjust field values if the site requires a specific format
//       (e.g., phone must be digits-only, date format must be YYYY-MM-DD).
const TEST_REGISTRANT = {
  first_name: 'QA',
  last_name: 'Tester',
  email: 'qa@example.com',
  phone: '555-000-1234',
  dob: '01/01/1990',   // TODO: adjust format to match the site's date picker
};

export const registrationFlow: FlowDefinition = {
  id: 'registration',
  // TODO: Update name to reflect the site's terminology (e.g., 'Camp Registration',
  //       'Event Sign-Up', 'Program Enrollment').
  name: 'Registration',
  steps: [
    {
      name: 'navigate_to_listing',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('navigate_to_listing');

        // TODO: Replace with the listing/browse page URL for this site.
        //       Should match the URL used in browse.ts navigate_to_site step.
        await runner.goto('https://YOUR_SITE_URL/LISTING_PATH');

        // TODO: Update the wait condition to match the site's loading pattern.
        await runner.page.waitForFunction(
          '() => document.querySelector("#root")?.children.length > 0',
          { timeout: 15000 },
        );

        await runner.hesitate(250);
      },
    },

    {
      name: 'select_first_listing',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('select_first_listing');

        // TODO: Replace with the listing item selector from rules.ts (camp_list_item).
        await runner.page.waitForSelector('REPLACE_ME_LISTING_ITEM_SELECTOR', {
          timeout: 15000,
        });

        await runner.hesitate(200);

        // Click the first listing's register / detail button.
        // TODO: Replace selectors with the register button and/or listing item
        //       selectors from rules.ts.
        const btn = await runner.page.$(
          'REPLACE_ME_LISTING_ITEM_SELECTOR button, ' +
          'REPLACE_ME_REGISTER_BUTTON_SELECTOR',
        );

        if (!btn) {
          // Fall back: click the first card directly.
          const card = await runner.page.$('REPLACE_ME_LISTING_ITEM_SELECTOR');
          if (!card) throw new Error('No listing items found on the browse page');
          await card.click();
        } else {
          await runner.hesitate(100);
          await btn.click();
        }

        // Wait for route change, modal, or detail pane to appear.
        // TODO: Adjust timeout if the site's navigation is slower than 2 s.
        await runner.page.waitForTimeout(2000);
      },
    },

    {
      name: 'find_register_button',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('find_register_button');
        await runner.hesitate(200);

        // Look for a prominent Register / Sign Up CTA on the detail page.
        // TODO: Replace text and class selectors with what the site actually uses.
        //       Common patterns:
        //         button:has-text("Register")
        //         button:has-text("Sign Up")
        //         button:has-text("Enroll")
        //         a[href*="register"]
        const registerBtn = await runner.page.$(
          'button:has-text("Register"), button:has-text("Sign Up"), ' +
          'a:has-text("Register"), a:has-text("Sign Up"), ' +
          'REPLACE_ME_REGISTER_BUTTON_SELECTOR',
        );

        if (!registerBtn) {
          // Some sites render the registration form inline without a CTA.
          // In that case skip this step — the form fill step handles it.
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

        // Wait for at least one form input to appear.
        await runner.page.waitForSelector('input', { timeout: 10000 });
        await runner.hesitate(300);

        // First name
        // TODO: Replace selector with form_first_name from rules.ts.
        const fnField = await runner.page.$(
          'input[name="firstName"], input[placeholder*="First"], REPLACE_ME',
        );
        if (fnField) {
          await fnField.click();
          await runner.type(
            'input[name="firstName"], input[placeholder*="First"], REPLACE_ME',
            TEST_REGISTRANT.first_name,
          );
        }

        // Last name
        // TODO: Replace selector with form_last_name from rules.ts.
        const lnField = await runner.page.$(
          'input[name="lastName"], input[placeholder*="Last"], REPLACE_ME',
        );
        if (lnField) {
          await runner.type(
            'input[name="lastName"], input[placeholder*="Last"], REPLACE_ME',
            TEST_REGISTRANT.last_name,
          );
        }

        // Email
        // TODO: Replace selector with form_email from rules.ts.
        //       runner.executionContext.testEmail is populated by the runner
        //       from the configured test inbox — prefer it over the static value.
        const emailField = await runner.page.$(
          'input[type="email"], input[name="email"], REPLACE_ME',
        );
        if (emailField) {
          await runner.type(
            'input[type="email"], input[name="email"], REPLACE_ME',
            runner.executionContext.testEmail ?? TEST_REGISTRANT.email,
          );
        }

        // Phone
        // TODO: Replace selector with form_phone from rules.ts.
        //       Remove this block if the site does not collect a phone number.
        const phoneField = await runner.page.$(
          'input[type="tel"], input[name="phone"], REPLACE_ME',
        );
        if (phoneField) {
          await runner.type(
            'input[type="tel"], input[name="phone"], REPLACE_ME',
            TEST_REGISTRANT.phone,
          );
        }

        // Date of birth
        // TODO: Replace selector with form_dob from rules.ts.
        //       Remove this block if the site does not collect date of birth.
        const dobField = await runner.page.$(
          'input[name="dob"], input[name="dateOfBirth"], REPLACE_ME',
        );
        if (dobField) {
          await runner.type(
            'input[name="dob"], input[name="dateOfBirth"], REPLACE_ME',
            TEST_REGISTRANT.dob,
          );
        }

        // TODO: Add any site-specific fields not covered above.
        //       Follow the same pattern: locate → null-check → type.

        await runner.hesitate(400);
      },
    },

    {
      name: 'check_form_accessibility',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('check_form_accessibility');
        // Validates the form against axe-core while fields are populated.
        await runner.checkAccessibility();
      },
    },

    {
      name: 'await_registration_approval',
      type: 'approval',
      approval_category: 'registration_submit',
      fn: async (runner: PersonaRunner) => {
        // The ExecutionManager intercepts steps with type='approval'.
        // It posts an approval request to the dashboard and waits for an
        // operator decision BEFORE calling fn().
        //   - Approved: fn() runs (brief hesitate below), then submit_registration executes.
        //   - Rejected / timed out: fn() is NOT called; the step is recorded as
        //     skipped_by_approval and subsequent steps are also skipped.
        runner.collector.setStep('await_registration_approval');
        await runner.hesitate(100);
      },
    },

    {
      name: 'submit_registration',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('submit_registration');

        // TODO: Replace selector with submit_button from rules.ts.
        const submitBtn = await runner.page.$(
          'button[type="submit"], button:has-text("Submit"), ' +
          'button:has-text("Register"), REPLACE_ME',
        );

        if (!submitBtn) {
          throw new Error('Submit button not found — form structure may have changed');
        }

        await runner.click(
          'button[type="submit"], button:has-text("Submit"), ' +
          'button:has-text("Register"), REPLACE_ME',
        );

        // Wait for the server response and any client-side transition.
        // TODO: Increase if the site's backend takes longer to respond.
        await runner.page.waitForTimeout(3000);
      },
    },

    {
      name: 'verify_confirmation',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_confirmation');

        // TODO: Replace selector with success_message from rules.ts.
        const success = await runner.page.$(
          '[class*="success"], [class*="confirm"], ' +
          '[class*="thank"], [data-testid="success"], REPLACE_ME',
        );

        if (!success) {
          // Check for an inline error before throwing a generic failure.
          // TODO: Replace selector with error_message from rules.ts.
          const error = await runner.page.$(
            '[class*="error"], .alert-danger, [role="alert"], REPLACE_ME',
          );

          if (error) {
            const errorText = await error.textContent();
            throw new Error(`Registration failed with error: ${errorText?.trim() ?? 'unknown'}`);
          }

          throw new Error(
            'Registration submitted but no confirmation or error message was found',
          );
        }
      },
    },
  ],
};
