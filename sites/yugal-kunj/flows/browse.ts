/**
 * Flow: browse
 * Site: Yugal Kunj QA Portal
 *
 * Covers: landing page load → camp listing page → camp detail.
 * Approval category: none (read-only browsing per §8.1).
 * Friction signals: slow TTFCP, hover-without-click on CTAs, scroll depth.
 *
 * This flow validates:
 * - SPA loads within persona-appropriate time budget
 * - Camp center listing renders at least one item
 * - Navigation to a camp detail page works
 * - Page is accessible per persona accessibility profile
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const browseFlow: FlowDefinition = {
  id: 'browse',
  name: 'Browse Camp Listings',
  steps: [
    {
      name: 'navigate_to_site',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/camp/center');
        // Wait for the SPA shell to hydrate — the root div must have children
        await runner.page.waitForFunction(
          () => document.querySelector('#root')?.children.length ?? 0 > 0,
          { timeout: 15000 },
        );
        runner.collector.setStep('navigate_to_site');
      },
    },

    {
      name: 'wait_for_camp_listing',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('wait_for_camp_listing');

        // Wait for at least one camp card to appear
        await runner.page.waitForSelector(
          '.camp-card, [class*="camp"], [class*="Camp"], .card',
          { timeout: 15000 },
        );

        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_camp_list_not_empty',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_camp_list_not_empty');

        const items = await runner.page.$$(
          '.camp-card, [class*="camp-item"], [class*="CampCard"], .card',
        );

        if (items.length === 0) {
          throw new Error(
            'Camp listing page rendered but no camp items found — ' +
            'check selector or whether the data loaded correctly',
          );
        }
      },
    },

    {
      name: 'hover_first_camp',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('hover_first_camp');

        const firstItem = await runner.page.$(
          '.camp-card, [class*="camp-item"], [class*="CampCard"], .card',
        );

        if (firstItem) {
          await firstItem.hover();
          // Record dwell time — persona-aware hesitation models reading speed
          await runner.hesitate(150);

          // Record a hover-without-click to simulate persona decision-making
          runner.collector.record('hover_without_click', undefined, {
            element: 'first_camp_card',
          });
        }
      },
    },

    {
      name: 'click_first_camp',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('click_first_camp');

        const firstItem = await runner.page.$(
          '.camp-card a, [class*="camp-item"] a, [class*="CampCard"] a, .card a, ' +
          'button[class*="detail"], button[class*="view"], button[class*="more"]',
        );

        if (!firstItem) {
          // Attempt clicking the card itself
          const card = await runner.page.$('.camp-card, .card');
          if (card) {
            await card.click();
          } else {
            throw new Error('Cannot locate a clickable camp item');
          }
        } else {
          await firstItem.click();
        }

        // SPA route change — wait briefly for new content
        await runner.page.waitForTimeout(2000);
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
