/**
 * Flow: browse
 * Site: REPLACE_ME — Site Display Name
 *
 * Covers: home page load → listing page → listing detail.
 * Approval category: none (read-only browsing; no mutation).
 * Friction signals: slow TTFCP, hover-without-click on CTAs, scroll depth.
 *
 * This flow validates:
 * - The site loads within a persona-appropriate time budget
 * - The listing page renders at least one item
 * - Navigation to a detail page works
 * - The page meets the persona's accessibility profile
 *
 * TODO: Replace every REPLACE_ME selector and URL with values from rules.ts.
 *       Run  npx playwright codegen YOUR_SITE_URL  to generate selectors
 *       interactively, then paste them here and into rules.ts.
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const browseFlow: FlowDefinition = {
  id: 'browse',
  // TODO: Update the human-readable name to reflect what is being browsed
  //       (e.g., 'Browse Camp Listings', 'Browse Event Catalog').
  name: 'Browse Listings',
  steps: [
    {
      name: 'navigate_to_site',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('navigate_to_site');

        // TODO: Replace the URL with the listing/browse page for this site.
        //       For traditional MPA:  'https://example.org/camps'
        //       For SPA with hash:    'https://example.org/#/camp/center'
        //       The runner also exposes runner.executionContext.baseUrl which
        //       resolves to the environment's base URL from the dashboard config.
        await runner.goto('https://YOUR_SITE_URL/LISTING_PATH');

        // TODO: Update this waitForFunction to match the site's loading pattern.
        //       For React SPAs with a root div:
        //         () => (document.querySelector('#root')?.children.length ?? 0) > 0
        //       For server-rendered pages, a specific element appearing is enough:
        //         () => document.querySelector('.listing-container') !== null
        await runner.page.waitForFunction(
          () => (document.querySelector('#root')?.children.length ?? 0) > 0,
          { timeout: 15000 },
        );

        runner.collector.setStep('navigate_to_site');
      },
    },

    {
      name: 'wait_for_listing',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('wait_for_listing');

        // TODO: Replace this selector with the one from rules.ts
        //       (camp_list_item / listing card).
        //       Example: '.camp-card, [data-testid="listing-item"]'
        await runner.page.waitForSelector(
          'REPLACE_ME_LISTING_ITEM_SELECTOR',
          { timeout: 15000 },
        );

        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_listing_not_empty',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_listing_not_empty');

        // TODO: Replace selector with the listing item selector from rules.ts.
        const items = await runner.page.$$('REPLACE_ME_LISTING_ITEM_SELECTOR');

        if (items.length === 0) {
          throw new Error(
            'Listing page rendered but no items found — ' +
            'check selector or whether data loaded correctly',
          );
        }
      },
    },

    {
      name: 'hover_first_item',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('hover_first_item');

        // TODO: Replace selector with the listing item selector from rules.ts.
        const firstItem = await runner.page.$('REPLACE_ME_LISTING_ITEM_SELECTOR');

        if (firstItem) {
          await firstItem.hover();
          // Persona-aware dwell time — models human reading speed.
          await runner.hesitate(150);

          // Record hover-without-click to capture friction signals.
          runner.collector.record('hover_without_click', undefined, {
            element: 'first_listing_item',
          });
        }
      },
    },

    {
      name: 'click_first_item',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('click_first_item');

        // TODO: Replace with a selector that targets the clickable link or
        //       button inside the listing card.
        //       Try: 'LISTING_ITEM a', 'LISTING_ITEM button', 'LISTING_ITEM'
        //       If the card itself is clickable, use the card selector directly.
        const clickTarget = await runner.page.$(
          'REPLACE_ME_LISTING_ITEM_SELECTOR a, REPLACE_ME_LISTING_ITEM_SELECTOR button',
        );

        if (!clickTarget) {
          // Fall back: click the card container itself.
          const card = await runner.page.$('REPLACE_ME_LISTING_ITEM_SELECTOR');
          if (card) {
            await card.click();
          } else {
            throw new Error('Cannot locate a clickable listing item');
          }
        } else {
          await clickTarget.click();
        }

        // TODO: Adjust the wait strategy for this site's navigation pattern.
        //       For SPAs: waitForTimeout (gives the SPA time to re-render).
        //       For MPAs: waitForNavigation or waitForURL may be more reliable.
        await runner.page.waitForTimeout(2000);
        await runner.hesitate(200);
      },
    },

    {
      name: 'check_accessibility',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('check_accessibility');
        // Runs axe-core against the current page state.
        // Failures are recorded as accessibility violations in the run report.
        await runner.checkAccessibility();
      },
    },
  ],
};
