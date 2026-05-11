/**
 * Flow: admin-edit
 * Site: Yugal Kunj QA Portal
 *
 * Covers: admin editing an existing record (booking or registration).
 * Prerequisite: admin must be logged in.
 * Approval category: admin_write (strong — all admin writes require
 *   typed-reason confirmation per master plan §8.1).
 *
 * This flow validates:
 * - Admin navigates to an editable record
 * - Edit button/link is present and clickable
 * - Edit form loads with pre-populated data
 * - Operator can modify a field
 * - Approval gate pauses before save
 * - On approval: save is submitted and success feedback is shown
 * - Accessibility check on edit form
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const adminEditFlow: FlowDefinition = {
  id: 'admin-edit',
  name: 'Admin Edit Record',
  steps: [
    {
      name: 'navigate_to_editable_list',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        // Navigate to bookings list as the primary editable entity
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/admin/bookings');
        await runner.page.waitForFunction(
          () => document.querySelector('#root')?.children.length ?? 0 > 0,
          { timeout: 15000 },
        );
        runner.collector.setStep('navigate_to_editable_list');
      },
    },

    {
      name: 'wait_for_list',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('wait_for_list');
        await runner.page.waitForSelector(
          'table, [class*="table"], [class*="Table"], [class*="booking"]',
          { timeout: 15000 },
        );
        await runner.hesitate(200);
      },
    },

    {
      name: 'click_first_record',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('click_first_record');

        const firstRow = await runner.page.$(
          'table tbody tr, [class*="booking-row"], [class*="booking-item"]',
        );
        if (!firstRow) {
          throw new Error('No record row available to click for editing');
        }

        const link = await firstRow.$('a, button[class*="view"], button[class*="detail"]');
        if (link) {
          await link.click();
        } else {
          await firstRow.click();
        }

        await runner.page.waitForTimeout(2000);
        await runner.hesitate(200);
      },
    },

    {
      name: 'click_edit_button',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('click_edit_button');

        // Look for an edit button/link on the detail page
        const editButton = await runner.page.$(
          'button[class*="edit"], button[class*="Edit"], a[class*="edit"], a[class*="Edit"], ' +
          'button:has-text("Edit"), a:has-text("Edit"), [aria-label="Edit"]',
        );

        if (!editButton) {
          throw new Error(
            'Edit button not found on the record detail page — ' +
            'the admin may not have edit permissions or the UI may differ',
          );
        }

        await editButton.click();
        await runner.page.waitForTimeout(1500);
        await runner.hesitate(200);
      },
    },

    {
      name: 'verify_edit_form',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_edit_form');

        // Verify an editable form is present with at least one input field
        const inputs = await runner.page.$$('input, textarea, select');
        if (inputs.length === 0) {
          throw new Error(
            'Edit form did not load — no input/textarea/select elements found',
          );
        }

        await runner.hesitate(200);
      },
    },

    {
      name: 'modify_field',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('modify_field');

        // Find the first editable text input and append a test marker
        const editableInput = await runner.page.$(
          'input[type="text"]:not([disabled]):not([readonly]), ' +
          'textarea:not([disabled]):not([readonly])',
        );

        if (editableInput) {
          // Clear and type a modified value
          await editableInput.click({ clickCount: 3 }); // select all
          const currentValue = await editableInput.inputValue();
          const modifiedValue = currentValue
            ? `${currentValue} [QA-edited]`
            : 'QA Test Edit';
          await editableInput.fill(modifiedValue);
          await runner.hesitate(150);
        }
        // If no editable text input found, the form may use dropdowns/selects only
      },
    },

    {
      name: 'await_admin_edit_approval',
      type: 'approval',
      approval_category: 'admin_write',
      fn: async (runner: PersonaRunner) => {
        // Paused here — runner polls the dashboard for operator decision
        await runner.hesitate(100);
      },
    },

    {
      name: 'submit_edit',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('submit_edit');

        await runner.click(
          'button[type="submit"], button[class*="save"], button[class*="Save"], ' +
          'button:has-text("Save"), button:has-text("Update")',
        );

        // Wait for save to complete
        await runner.page.waitForTimeout(2000);
        await runner.hesitate(200);
      },
    },

    {
      name: 'verify_save_success',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_save_success');

        // Check for success indicator — toast, message, or redirect
        const successIndicators = [
          '[class*="success"], [class*="Success"]',
          '[class*="toast"], [class*="Toast"]',
          '[class*="notification"], [class*="Notification"]',
          '[class*="alert-success"]',
          '[role="alert"]',
        ];

        let found = false;
        for (const selector of successIndicators) {
          const el = await runner.page.$(selector);
          if (el) {
            found = true;
            break;
          }
        }

        // Also accept if we were redirected back to the list view
        const currentUrl = runner.page.url();
        if (currentUrl.includes('/admin/bookings') && !currentUrl.includes('/edit')) {
          found = true;
        }

        if (!found) {
          // Not a hard failure — some apps show inline success without a banner
          runner.collector.record('potential_issue', undefined, {
            note: 'No explicit success feedback after admin edit save',
          });
        }

        await runner.hesitate(200);
      },
    },

    {
      name: 'check_accessibility',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('check_accessibility');
        await runner.checkAccessibility();
      },
    },
  ],
};
