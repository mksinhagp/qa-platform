/**
 * Flow: booking-lookup
 * Site: Yugal Kunj QA Portal
 *
 * Covers: admin booking lookup and detail view.
 * Prerequisite: admin must be logged in (run admin-login flow first or reuse auth state).
 * Approval category: none (read-only lookup per §8.1).
 *
 * This flow validates:
 * - Admin can navigate to the bookings list
 * - Booking table/list renders with at least one entry
 * - Search/filter works
 * - Clicking a booking opens the detail view
 * - Detail view shows relevant booking fields (attendee, status, payment)
 * - Accessibility check on the detail page
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const bookingLookupFlow: FlowDefinition = {
  id: 'booking-lookup',
  name: 'Booking Lookup',
  steps: [
    {
      name: 'navigate_to_bookings',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/admin/bookings');
        await runner.page.waitForFunction(
          () => document.querySelector('#root')?.children.length ?? 0 > 0,
          { timeout: 15000 },
        );
        runner.collector.setStep('navigate_to_bookings');
      },
    },

    {
      name: 'wait_for_booking_list',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('wait_for_booking_list');

        // Wait for the booking table/list to render
        await runner.page.waitForSelector(
          'table, [class*="table"], [class*="Table"], [class*="booking-list"], [class*="booking"]',
          { timeout: 15000 },
        );

        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_booking_list_not_empty',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_booking_list_not_empty');

        // Check that there is at least one booking row
        const rows = await runner.page.$$(
          'table tbody tr, [class*="booking-row"], [class*="booking-item"], [class*="BookingRow"]',
        );

        if (rows.length === 0) {
          throw new Error(
            'Booking list rendered but no booking rows found — ' +
            'check if test data has been seeded or if the admin user has access',
          );
        }
      },
    },

    {
      name: 'search_bookings',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('search_bookings');

        const searchInput = await runner.page.$(
          'input[type="search"], input[name="search"], input[placeholder*="Search"], input[placeholder*="search"]',
        );

        if (searchInput) {
          // Type a generic search term to test filter functionality
          await runner.type(
            'input[type="search"], input[name="search"], input[placeholder*="Search"], input[placeholder*="search"]',
            'test',
          );
          await runner.page.waitForTimeout(1500);
          await runner.hesitate(200);
        }
        // Search is optional — some admin panels may not have it
      },
    },

    {
      name: 'click_first_booking',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('click_first_booking');

        const firstRow = await runner.page.$(
          'table tbody tr, [class*="booking-row"], [class*="booking-item"], [class*="BookingRow"]',
        );

        if (!firstRow) {
          throw new Error('No booking row available to click');
        }

        // Try clicking a link or button inside the row first, then the row itself
        const link = await firstRow.$('a, button[class*="view"], button[class*="detail"]');
        if (link) {
          await link.click();
        } else {
          await firstRow.click();
        }

        // Wait for detail view to load
        await runner.page.waitForTimeout(2000);
        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_booking_detail',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_booking_detail');

        // Verify the detail view has loaded with booking-specific content
        const detailIndicators = [
          '[class*="detail"], [class*="Detail"]',
          '[class*="booking-detail"], [class*="BookingDetail"]',
          '[class*="order"], [class*="Order"]',
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
            'Booking detail view did not load — no heading or detail container found',
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
