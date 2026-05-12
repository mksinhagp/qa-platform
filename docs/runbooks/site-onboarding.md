# Site Onboarding Runbook

## Overview

This runbook provides a complete step-by-step guide for onboarding a new website into the QA Automation Platform. It covers the entire process from initial site registration through configuration, rules definition, and smoke testing.

**Target Audience:** Manish Sinha (VP of AI) - assumes familiarity with the codebase, Docker, and database-first architecture.

## Prerequisites

Before starting site onboarding, ensure the following are in place:

- Docker Compose stack running: `docker-compose up -d`
- PostgreSQL database initialized and accessible
- Vault bootstrapped (see Step 3 if not done)
- Operator account with admin privileges exists
- Access to the target website's staging/production environments
- Test user credentials for the target site (user and admin accounts)

## Step 1: Register the Site in the Dashboard

1. Navigate to `/dashboard/sites/new`
2. Complete the 3-step wizard:

### Step 1: Site Identity
- **Site ID**: Unique slug (e.g., `my-camp-site`)
- **Display Name**: Human-readable name (e.g., "My Camp Registration Portal")
- **Base URL**: Primary URL for testing (e.g., `https://staging.mycampsite.org`)
- **Description**: Brief site description for operator reference

### Step 2: Environments
- Add at least one environment:
  - **Name**: `staging` or `production`
  - **Base URL**: Environment-specific URL
  - **Description**: Environment purpose
- Multiple environments supported (e.g., staging, production)

### Step 3: Review & Create
- Verify all configuration
- Click "Create Site" to register

## Step 2: Add Environments

After site creation, configure environments:

1. Navigate to `/dashboard/sites/[siteId]`
2. Click "Environments" tab
3. For each environment:
   - **Environment Name**: `staging`, `production`, etc.
   - **Base URL**: Full URL including protocol
   - **Is Default**: Mark primary testing environment
   - **Description**: Environment purpose and access notes

**URL Conventions:**
- Staging: `https://staging.{domain}.org` or `https://{domain}-staging.org`
- Production: `https://{domain}.org`
- Include trailing slashes only if required by the site

## Step 3: Configure the Vault (if not done)

The vault must be bootstrapped before storing credentials:

1. Navigate to `/dashboard/settings/vault`
2. If vault is locked, click "Bootstrap Vault"
3. Follow the bootstrap wizard at `/dashboard/settings/vault/bootstrap`
4. Generate master key and store securely
5. Confirm vault is unlocked

**Secrets Structure:**
- Site credentials stored under `sites/{siteId}/credentials/{credentialKey}`
- Environment-specific bindings in `/dashboard/settings/credentials`

## Step 4: Add Site Credentials

Create test account credentials for the site:

1. Navigate to `/dashboard/settings/credentials`
2. Click "New Credential"
3. Configure:
   - **Name**: Descriptive name (e.g., "Test User Account")
   - **Site**: Select the site
   - **Credential Key**: Unique key (e.g., `test_user`, `admin`)
   - **Environment**: Bind to specific environment(s)
   - **Secrets**: Add key-value pairs:
     - `username`: Test account username
     - `password`: Test account password
     - `email`: Test account email (if applicable)
     - Additional fields as needed

4. Save and verify credential appears in list

## Step 5: Configure Email Inbox

Set up email validation for registration flows:

### Option A: Mailcatcher (Development)
1. Ensure Mailcatcher service running: `docker-compose --profile dev up -d mailcatcher`
2. Navigate to `/dashboard/settings/email-inboxes`
3. Click "New Inbox"
4. Configure:
   - **Name**: "Mailcatcher Dev"
   - **Provider**: "Mailcatcher"
   - **Host**: `mailcatcher`
   - **Port**: `1025`
   - **Environment**: Bind to staging environment

### Option B: IMAP-based (Production)
1. Navigate to `/dashboard/settings/email-inboxes`
2. Click "New Inbox"
3. Configure:
   - **Name**: Descriptive name
   - **Provider**: "IMAP"
   - **Host**: IMAP server hostname
   - **Port**: 993 (SSL) or 143 (non-SSL)
   - **Username**: Email address
   - **Password**: Email password or app password
   - **Use SSL**: Enable for port 993
   - **Environment**: Bind to production environment

## Step 6: Configure Payment Profile

Set up payment testing for checkout flows:

1. Navigate to `/dashboard/settings/payment-profiles`
2. Click "New Payment Profile"
3. Configure for Authorize.net sandbox:
   - **Name**: "Authorize.net Sandbox"
   - **Provider**: "Authorize.net"
   - **Mode**: "Sandbox"
   - **API Login ID**: Sandbox API login
   - **Transaction Key**: Sandbox transaction key
   - **Environment**: Bind to staging environment
   - **Test Card Number**: `4111111111111111`
   - **Test Expiry**: `12/25`
   - **Test CVV**: `123`

## Step 7: Set Approval Policies

Configure which actions require operator approval:

1. Navigate to `/dashboard/settings/approval-policies`
2. Review default policies or create site-specific ones
3. Common categories requiring `strong` approval:
   - `registration_submit` - Form submissions
   - `checkout_submit` - Payment transactions
   - `admin_write` - Admin data modifications
   - `admin_delete` - Admin deletions

4. Categories often set to `one_click`:
   - `browse` - Page navigation
   - `login` - Authentication attempts

## Step 8: Create the Site Rules File

Create `sites/{site_slug}/rules.ts` with the site configuration:

```typescript
/**
 * Site Rules: {Display Name}
 * URL: {base_url}
 * 
 * Add any site-specific notes here:
 * - SPA vs MPA
 * - Authentication requirements
 * - Special navigation patterns
 * - Known limitations
 */

import type { SiteRules } from '@qa-platform/rules';

const rules: SiteRules = {
  site_id: '{site_slug}',
  display_name: '{Display Name}',
  base_url: '{base_url}',

  // Capacity limits for bookings/registrations
  capacity: {
    max_attendees_per_booking: 5,
    waitlist_enabled: false,
    waitlist_max_size: 20,
  },

  // Age restrictions and guardian requirements
  age_restriction: {
    min_age: 5,
    max_age: 18,
    require_guardian_if_under: 18,
  },

  // Coupon and discount configuration
  coupon: {
    enabled: true,
    max_discount_percent: 50,
    sibling_discount_percent: 10,
    sibling_discount_requires_same_event: false,
  },

  // Payment processing rules
  payment: {
    partial_payment_allowed: false,
    partial_payment_min_percent: 25,
    sandbox_mode: true, // Set to false for production testing
    accepted_methods: ['card'], // Options: 'card', 'ach', 'check', 'cash'
  },

  // Cancellation and refund policies
  cancellation: {
    allowed: true,
    window_hours: 72,
    refund_percent_within_window: 100,
    refund_percent_outside_window: 0,
    date_change_allowed: false,
    date_change_fee: 0,
  },

  // Registration flow configuration
  registration: {
    require_waiver: false,
    waiver_text: undefined,
    multi_attendee_allowed: true,
    max_attendees_per_transaction: 5,
    email_confirmation_expected: true,
    confirmation_email_subject_pattern: 'Registration Confirmation',
    confirmation_email_link_text_pattern: 'View Registration',
  },

  // Admin panel configuration (Phase 7)
  admin: {
    login_url: '/admin/login', // or '#/admin/login' for SPA
    dashboard_url: '/admin',
    booking_lookup_url: '/admin/bookings',
    registration_lookup_url: '/admin/registrations',
    reporting_url: '/admin/reports',
    separate_app: false, // true if admin is separate from main app
    credential_key: 'admin', // Must match credential key from Step 4
  },

  // CSS/ARIA selectors for Playwright automation
  selectors: {
    // Navigation elements
    camp_list_item: '.camp-card, [class*="camp"], [data-testid="camp-item"]',
    register_button: 'button[class*="register"], [data-testid="register-btn"]',
    login_button: 'button[class*="login"], a[href*="login"]',

    // Form fields
    form_first_name: 'input[name="firstName"], input[placeholder*="First"]',
    form_last_name: 'input[name="lastName"], input[placeholder*="Last"]',
    form_email: 'input[name="email"], input[type="email"]',
    form_phone: 'input[name="phone"], input[type="tel"]',
    form_dob: 'input[name="dob"], input[name="dateOfBirth"]',
    submit_button: 'button[type="submit"], [data-testid="submit"]',

    // Feedback messages
    success_message: '[class*="success"], [data-testid="success"]',
    error_message: '[class*="error"], .alert-error, [data-testid="error"]',

    // Admin selectors (Phase 7)
    admin_login_form: 'form[class*="login"], #adminLoginForm',
    admin_email_input: 'input[name="email"], input[name="username"]',
    admin_password_input: 'input[name="password"]',
    admin_login_submit: 'button[type="submit"], button[class*="login"]',
    admin_nav_menu: 'nav, [class*="sidebar"], [data-testid="admin-nav"]',
    admin_booking_table: 'table[data-testid="bookings"], .booking-list',
    admin_registration_table: 'table[data-testid="registrations"]',
    admin_search_input: 'input[type="search"], input[name="search"]',
    admin_edit_button: 'button[class*="edit"], [data-testid="edit"]',
    admin_save_button: 'button[type="submit"], button[class*="save"]',
    admin_report_container: '[class*="report"], [data-testid="report"]',
  },

  // Categories requiring elevated approval
  elevated_approval_categories: [
    'registration_submit',
    'checkout_submit',
    'admin_write',
    'admin_delete',
  ],

  // Free-form notes for operators
  notes: 'Site-specific notes: SPA navigation, auth requirements, etc.',
};

export default rules;
```

## Step 9: Configure Selectors

Find and verify CSS/ARIA selectors using browser DevTools:

1. Open target site in Chrome/Firefox
2. Use DevTools Inspector to identify elements:
   - Right-click element → Inspect
   - Copy selector: Right-click → Copy → Copy selector
   - Test in Console: `document.querySelector('selector')`

3. For dynamic sites, use:
   - `data-testid` attributes (preferred)
   - Stable class names
   - ARIA attributes: `[aria-label="Register"]`

4. Playwright Inspector for testing:
   ```bash
   npx playwright codegen {base_url}
   ```

5. Update selectors in `rules.ts` based on findings

## Step 10: Write or Adapt Flow Files

Create flow implementations in `sites/{site_slug}/flows/`:

### Required Flows
- `browse.ts` - Navigate camp/program listings
- `registration.ts` - Complete registration flow
- `checkout.ts` - Payment processing (if applicable)
- `login.ts` - User authentication

### Optional Flows (Phase 7)
- `admin-login.ts` - Admin panel access
- `booking-lookup.ts` - Search bookings
- `registration-lookup.ts` - Search registrations
- `admin-edit.ts` - Modify bookings/registrations
- `reporting-screens.ts` - Access reports

### Flow Template
```typescript
import type { PersonaRunner, FlowDefinition } from '@qa-platform/playwright-core';

export const {flowName}Flow: FlowDefinition = {
  id: '{flow_id}',
  name: '{Human Readable Name}',
  steps: [
    {
      name: 'step_name',
      type: 'navigation|action|validation',
      fn: async (runner: PersonaRunner) => {
        runner.collector.setStep('step_name');
        // Implementation here
        await runner.hesitate(250); // Simulate human delay
      },
    },
  ],
};
```

### Reference Implementation
See `sites/yugal-kunj/flows/` for complete examples.

## Step 11: Run a Smoke Test

Validate the complete setup with a minimal test:

1. Navigate to `/dashboard/runs/new`
2. Configure test run:
   - **Site**: Select newly onboarded site
   - **Environment**: Staging
   - **Personas**: Select `confident_desktop` (1 persona)
   - **Devices**: Desktop only
   - **Browsers**: Chrome only
   - **Flows**: Select `browse` flow only
   - **Run Name**: "Smoke Test - {Site Name}"

3. Start the run and monitor:
   - Check for credential binding errors
   - Verify selector matches
   - Confirm flow execution
   - Review any approval requirements

4. Expected outcome:
   - Run completes successfully
   - All steps pass
   - Screenshots captured
   - No authentication errors

## Verification Checklist

Before declaring onboarding complete, verify:

- [ ] Site registered in dashboard with correct base URL
- [ ] At least one environment configured and marked as default
- [ ] Vault is unlocked and accessible
- [ ] Test credentials created and bound to environments
- [ ] Email inbox configured (Mailcatcher for staging, IMAP for prod)
- [ ] Payment profile configured (if checkout flows exist)
- [ ] Approval policies set for all categories
- [ ] `sites/{slug}/rules.ts` file created with all required sections
- [ ] Selectors tested and verified in browser
- [ ] Core flow files implemented (browse, registration, login)
- [ ] Smoke test passes with single persona/device/browser
- [ ] No credential or environment binding errors
- [ ] Email validation working (if registration flows require it)

## Troubleshooting Quick-Reference

### Issue: Credential not found during run
**Fix:** Check credential binding in `/dashboard/settings/credentials` - ensure credential is bound to the correct environment and the credential_key matches rules.ts

### Issue: Selector not found
**Fix:** 
1. Verify selector in browser DevTools
2. Check for SPA navigation delays
3. Add waitForSelector with longer timeout
4. Consider using data-testid attributes

### Issue: Email validation failing
**Fix:**
1. Verify Mailcatcher is running: `docker-compose ps mailcatcher`
2. Check inbox configuration and test connection
3. Confirm email subject pattern matches rules.ts

### Issue: Payment flow failing
**Fix:**
1. Verify sandbox credentials are correct
2. Check test card details (4111111111111111)
3. Ensure payment profile is bound to environment

### Issue: Vault locked errors
**Fix:**
1. Navigate to `/dashboard/settings/vault`
2. Unlock vault with master key
3. Re-run credential creation if needed

For detailed troubleshooting, see the Troubleshooting Runbook.