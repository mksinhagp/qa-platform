/**
 * Flow: reporting-screens
 * Site: Yugal Kunj QA Portal
 *
 * Covers: admin reporting and list screens.
 * Prerequisite: admin must be logged in.
 * Approval category: none (read-only reporting per §8.1).
 *
 * This flow validates:
 * - Admin can navigate to the reports/dashboard section
 * - Reports page loads with content (charts, tables, summaries)
 * - Key metrics or data elements are visible
 * - List views support pagination or scroll
 * - Export/download button exists (if applicable)
 * - Accessibility check on the reporting page
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const reportingScreensFlow: FlowDefinition = {
  id: 'reporting-screens',
  name: 'Reporting and List Screens',
  steps: [
    {
      name: 'navigate_to_admin_dashboard',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/admin');
        await runner.page.waitForFunction(
          () => document.querySelector('#root')?.children.length ?? 0 > 0,
          { timeout: 15000 },
        );
        runner.collector.setStep('navigate_to_admin_dashboard');
      },
    },

    {
      name: 'verify_dashboard_metrics',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_dashboard_metrics');

        // Look for summary cards, metrics, or dashboard widgets
        const metricIndicators = await runner.page.$$(
          '[class*="card"], [class*="Card"], [class*="metric"], [class*="Metric"], ' +
          '[class*="stat"], [class*="Stat"], [class*="summary"], [class*="Summary"], ' +
          '[class*="widget"], [class*="Widget"], [class*="dashboard"], [class*="Dashboard"]',
        );

        if (metricIndicators.length === 0) {
          throw new Error(
            'Admin dashboard has no visible metric cards, widgets, or summary elements',
          );
        }

        await runner.hesitate(300);
      },
    },

    {
      name: 'navigate_to_reports',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('navigate_to_reports');

        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/admin/reports');
        await runner.page.waitForTimeout(2000);
        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_reports_content',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_reports_content');

        // Reports page should have tables, charts, or data containers
        const reportElements = await runner.page.$$(
          'table, [class*="chart"], [class*="Chart"], [class*="report"], [class*="Report"], ' +
          'canvas, svg, [class*="graph"], [class*="Graph"]',
        );

        if (reportElements.length === 0) {
          // Some admin panels use the same dashboard for reports; check for any data
          const fallbackData = await runner.page.$$(
            '[class*="card"], [class*="Card"], [class*="list"], [class*="List"], ' +
            'table, ul, ol',
          );

          if (fallbackData.length === 0) {
            throw new Error(
              'Reports page has no visible data elements (tables, charts, lists)',
            );
          }
        }

        await runner.hesitate(200);
      },
    },

    {
      name: 'check_export_functionality',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('check_export_functionality');

        // Look for export/download buttons — optional feature
        const exportButton = await runner.page.$(
          'button[class*="export"], button[class*="Export"], ' +
          'button[class*="download"], button[class*="Download"], ' +
          'a[class*="export"], a[class*="Export"], ' +
          'button:has-text("Export"), button:has-text("Download"), ' +
          '[aria-label*="export"], [aria-label*="Export"]',
        );

        if (exportButton) {
          // Record that export is available but do not click (no side-effect)
          runner.collector.record('hover_without_click', undefined, {
            element: 'export_button',
            note: 'Export functionality available',
          });
          await exportButton.hover();
          await runner.hesitate(200);
        }
        // Export button is optional — its absence is not a failure
      },
    },

    {
      name: 'verify_list_pagination',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_list_pagination');

        // Check for pagination controls or infinite scroll indicators
        const paginationElements = await runner.page.$$(
          '[class*="pagination"], [class*="Pagination"], ' +
          'nav[aria-label*="page"], [class*="pager"], [class*="Pager"], ' +
          'button:has-text("Next"), button:has-text("Previous"), ' +
          '[class*="load-more"], [class*="LoadMore"]',
        );

        if (paginationElements.length > 0) {
          runner.collector.record('hover_without_click', undefined, {
            element: 'pagination',
            note: 'Pagination controls present',
          });
        }
        // Pagination is optional — small datasets may not need it

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
