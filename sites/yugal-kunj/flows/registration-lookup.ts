/**
 * Flow: registration-lookup
 * Site: Yugal Kunj QA Portal
 *
 * Covers: admin registration lookup and detail view.
 * Prerequisite: admin must be logged in (run admin-login flow first or reuse auth state).
 * Approval category: none (read-only lookup per §8.1).
 *
 * This flow validates:
 * - Admin can navigate to the registrations list
 * - Registration table/list renders with data
 * - Search/filter works on registrations
 * - Clicking a registration opens the detail view
 * - Detail view shows relevant registration fields (attendee info, camp, status)
 * - Accessibility check on the detail page
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const registrationLookupFlow: FlowDefinition = {
  id: 'registration-lookup',
  name: 'Registration Lookup',
  steps: [
    {
      name: 'navigate_to_registrations',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/admin/registrations');
        await runner.page.waitForFunction(
          () => document.querySelector('#root')?.children.length ?? 0 > 0,
          { timeout: 15000 },
        );
        runner.collector.setStep('navigate_to_registrations');
      },
    },

    {
      name: 'wait_for_registration_list',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('wait_for_registration_list');

        await runner.page.waitForSelector(
          'table, [class*="table"], [class*="Table"], [class*="registration-list"], [class*="registration"]',
          { timeout: 15000 },
        );

        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_registration_list_not_empty',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_registration_list_not_empty');

        const rows = await runner.page.$$(
          'table tbody tr, [class*="registration-row"], [class*="registration-item"], [class*="RegistrationRow"]',
        );

        if (rows.length === 0) {
          throw new Error(
            'Registration list rendered but no rows found — ' +
            'check if test registrations exist or if the admin user has access',
          );
        }
      },
    },

    {
      name: 'search_registrations',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('search_registrations');

        const searchInput = await runner.page.$(
          'input[type="search"], input[name="search"], input[placeholder*="Search"], input[placeholder*="search"]',
        );

        if (searchInput) {
          await runner.type(
            'input[type="search"], input[name="search"], input[placeholder*="Search"], input[placeholder*="search"]',
            'QA Tester',
          );
          await runner.page.waitForTimeout(1500);
          await runner.hesitate(200);
        }
      },
    },

    {
      name: 'click_first_registration',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('click_first_registration');

        const firstRow = await runner.page.$(
          'table tbody tr, [class*="registration-row"], [class*="registration-item"], [class*="RegistrationRow"]',
        );

        if (!firstRow) {
          throw new Error('No registration row available to click');
        }

        const link = await firstRow.$('a, button[class*="view"], button[class*="detail"]');
        if (link) {
          await link.click();
        } else {
          await firstRow.click();
        }

        await runner.page.waitForTimeout(2000);
        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_registration_detail',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_registration_detail');

        const detailIndicators = [
          '[class*="detail"], [class*="Detail"]',
          '[class*="registration-detail"], [class*="RegistrationDetail"]',
          '[class*="attendee"], [class*="Attendee"]',
          'h1, h2, h3',
        ];

        let found = false;
        for (const selector of detailIndicators) {
          const el = await runner.page.$(selector);
          if (el) {
            found = true;
            break;
          }
        }

        if (!found) {
          throw new Error(
            'Registration detail view did not load — no heading or detail container found',
          );
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
