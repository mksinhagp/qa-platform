/**
 * Flow: admin-login
 * Site: Yugal Kunj QA Portal
 *
 * Covers: admin login via the SPA hash route (#/login).
 * Approval category: admin_write (strong approval — all admin actions require
 *   operator confirmation per master plan §8.1).
 *
 * This flow validates:
 * - Admin login page loads correctly
 * - Login form accepts credentials
 * - Approval gate pauses before login submission
 * - On approval: credentials are submitted and admin dashboard is reached
 * - Accessibility check on the admin dashboard
 */

import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const adminLoginFlow: FlowDefinition = {
  id: 'admin-login',
  name: 'Admin Login',
  steps: [
    {
      name: 'navigate_to_admin_login',
      type: 'navigation',
      fn: async (runner: PersonaRunner) => {
        await runner.goto('https://ykportalnextgenqa.yugalkunj.org/#/login');
        await runner.page.waitForFunction(
          () => (document.querySelector('#root')?.children.length ?? 0) > 0,
          { timeout: 15000 },
        );
        runner.collector.setStep('navigate_to_admin_login');
      },
    },

    {
      name: 'verify_login_form',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_login_form');

        // Wait for the login form to be visible
        await runner.page.waitForSelector(
          'form[class*="login"], form[class*="Login"], #loginForm, form',
          { timeout: 10000 },
        );

        // Verify email/username and password fields exist
        const emailField = await runner.page.$(
          'input[name="email"], input[name="username"], input[type="email"]',
        );
        const passwordField = await runner.page.$(
          'input[name="password"], input[type="password"]',
        );

        if (!emailField) {
          throw new Error('Admin login form missing email/username field');
        }
        if (!passwordField) {
          throw new Error('Admin login form missing password field');
        }

        await runner.hesitate(200);
      },
    },

    {
      name: 'fill_admin_credentials',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('fill_admin_credentials');

        // Use admin credentials from execution context (populated from the vault)
        const adminEmail = runner.executionContext.testEmail ?? 'admin@yugalkunj.org';
        const adminPassword = runner.executionContext.adminPassword;
        if (!adminPassword) {
          throw new Error(
            'Admin password not provided in execution context — ' +
            'configure the admin credential in the vault with key matching rules.admin.credential_key',
          );
        }

        await runner.type(
          'input[name="email"], input[name="username"], input[type="email"]',
          adminEmail,
        );

        await runner.hesitate(100);

        await runner.type(
          'input[name="password"], input[type="password"]',
          adminPassword,
        );

        await runner.hesitate(150);
      },
    },

    {
      name: 'await_admin_login_approval',
      type: 'approval',
      approval_category: 'admin_write',
      fn: async (runner: PersonaRunner) => {
        // Paused here — runner polls the dashboard for operator decision
        await runner.hesitate(100);
      },
    },

    {
      name: 'submit_login',
      type: 'action',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('submit_login');

        await runner.click(
          'button[type="submit"], button[class*="login"], button[class*="Login"]',
        );

        // Wait for navigation to admin dashboard
        await runner.page.waitForTimeout(3000);
        await runner.hesitate(300);
      },
    },

    {
      name: 'verify_admin_dashboard',
      type: 'assertion',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('verify_admin_dashboard');

        // Verify we landed on the admin area — look for admin-specific elements
        const currentUrl = runner.page.url();
        const hasAdminIndicator = await runner.page.$(
          'nav, [class*="sidebar"], [class*="Sidebar"], [class*="admin"], [class*="Admin"], [class*="dashboard"]',
        );

        if (!hasAdminIndicator) {
          throw new Error(
            `Admin dashboard not reached after login. Current URL: ${currentUrl}`,
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
