/**
 * Site Rules Template
 *
 * PURPOSE
 * -------
 * This file is the starting point for onboarding a new site into the QA
 * Automation Platform.  Copy the entire _template/ directory to a new
 * directory named after your site ID (e.g., sites/my-site/) and fill in
 * every TODO below.
 *
 * USAGE
 * -----
 * 1. Copy:  cp -r sites/_template sites/your-site-id
 * 2. Fill in every field marked "TODO" in this file.
 * 3. Repeat for flows/browse.ts, flows/registration.ts, flows/checkout.ts.
 * 4. Build:  pnpm build  (compiles .ts → .js so the runner can load rules.js)
 * 5. Register the site in the dashboard and run a smoke test (see docs/runbooks/site-onboarding.md).
 *
 * SITE ID NAMING RULE (enforced by loader.ts)
 * -------------------------------------------
 * Must match:  ^[a-z0-9][a-z0-9_-]*$
 * Good:        my-camp-site, acme_portal, portal2
 * Bad:         My Site, _private, 2ndsite
 *
 * SCHEMA REFERENCE
 * ----------------
 * All fields are defined in packages/rules/src/schema.ts.
 * Optional fields may be omitted entirely if they do not apply.
 */

import type { SiteRules } from '@qa-platform/rules';

const rules: SiteRules = {
  // TODO: Set to the exact same slug used for the dashboard site ID and the
  //       directory name under sites/.  Must match ^[a-z0-9][a-z0-9_-]*$.
  site_id: 'REPLACE_ME',

  // TODO: Human-readable name shown in the dashboard and reports.
  display_name: 'REPLACE_ME — Site Display Name',

  // TODO: Primary URL under test (staging preferred).
  //       Must be a valid absolute URL including protocol.
  //       Example: 'https://staging.example.org'
  base_url: 'https://REPLACE_ME',

  // ─── Capacity ──────────────────────────────────────────────────────────────
  // Controls how the runner oracle evaluates booking/registration limits.
  // Omit this section entirely if the site has no capacity concept.

  capacity: {
    // TODO: Maximum attendees a single user may book in one transaction.
    //       Set to undefined (or omit) if there is no hard limit.
    max_attendees_per_booking: 5,

    // TODO: Maximum total registrations the site allows per event (server-side).
    //       Omit if unknown or unlimited.
    // max_bookings_per_event: 100,

    // TODO: Does the site support a waitlist when capacity is full?
    waitlist_enabled: false,

    // TODO: Maximum waitlist slots.  Omit if waitlist_enabled is false.
    // waitlist_max_size: 20,
  },

  // ─── Age Restrictions ──────────────────────────────────────────────────────
  // Omit this section if the site has no age-based rules.

  age_restriction: {
    // TODO: Minimum allowed participant age in years.  Omit if none.
    min_age: 5,

    // TODO: Maximum allowed participant age in years.  Omit if none.
    // max_age: 18,

    // TODO: Age below which a guardian must also be listed.  Omit if none.
    require_guardian_if_under: 18,
  },

  // ─── Coupon / Discount ─────────────────────────────────────────────────────
  // Omit this section if the site has no coupon or discount functionality.

  coupon: {
    // TODO: Set to true if the site accepts coupon codes.
    enabled: false,

    // TODO: Maximum discount percentage any coupon may apply (0–100).
    //       Omit if enabled is false or there is no cap.
    // max_discount_percent: 50,

    // TODO: Sibling discount percentage applied automatically.  Omit if none.
    // sibling_discount_percent: 10,

    // TODO: Whether sibling discount requires all attendees to be in the same
    //       event.  Default is false (discount spans events).
    sibling_discount_requires_same_event: false,
  },

  // ─── Payment ───────────────────────────────────────────────────────────────
  // Omit this section if the site has no payment step.

  payment: {
    // TODO: Does the site allow partial/deposit payments?
    partial_payment_allowed: false,

    // TODO: If partial_payment_allowed is true, the minimum deposit as a
    //       percentage of the total (0–100).  Omit otherwise.
    // partial_payment_min_percent: 25,

    // TODO: How many hours a held (unpaid) booking remains reserved.
    //       Omit if no hold mechanism exists.
    // hold_expiry_hours: 24,

    // TODO: Set to true for sandbox/test environments.
    //       Set to false only when testing against live production payment.
    sandbox_mode: true,

    // TODO: Payment methods the site accepts.  Allowed values:
    //       'card' | 'ach' | 'check' | 'cash'
    accepted_methods: ['card'],
  },

  // ─── Cancellation / Refund ─────────────────────────────────────────────────
  // Omit this section if the site has no cancellation functionality.

  cancellation: {
    // TODO: Is cancellation allowed at all?
    allowed: true,

    // TODO: Hours before the event within which a full refund applies.
    //       Omit if no time-window refund rule exists.
    window_hours: 72,

    // TODO: Percentage refunded when cancellation is within window_hours (0–100).
    refund_percent_within_window: 100,

    // TODO: Percentage refunded when cancellation is outside window_hours (0–100).
    refund_percent_outside_window: 0,

    // TODO: Does the site allow changing the booking date instead of cancelling?
    date_change_allowed: false,

    // TODO: Fee charged for a date change.  Omit if date_change_allowed is false.
    // date_change_fee: 0,
  },

  // ─── Registration Flow ─────────────────────────────────────────────────────

  registration: {
    // TODO: Does completing registration require the user to accept a waiver?
    require_waiver: false,

    // TODO: If require_waiver is true, paste the waiver text here so the runner
    //       can verify the correct text is shown.  Omit otherwise.
    // waiver_text: 'I agree to the terms...',

    // TODO: Can a single registration transaction include more than one attendee?
    multi_attendee_allowed: true,

    // TODO: Maximum attendees per transaction (must be >= 1).
    max_attendees_per_transaction: 5,

    // TODO: Should the runner expect a confirmation email after a successful
    //       registration?  Requires an email inbox configured in the dashboard.
    email_confirmation_expected: true,

    // TODO: Substring or regex pattern that must appear in the subject line of
    //       the confirmation email.  Omit if email_confirmation_expected is false.
    confirmation_email_subject_pattern: 'Registration Confirmation',

    // TODO: Substring or regex pattern that must appear in a link inside the
    //       confirmation email body.  Omit if not applicable.
    // confirmation_email_link_text_pattern: 'View Registration',
  },

  // ─── Admin / Back-Office ───────────────────────────────────────────────────
  // Required for Phase 7 admin flows.  Omit this section if admin flows will
  // not be implemented for this site.

  admin: {
    // TODO: URL path or hash route to the admin login page.
    //       For SPAs with hash routing:  '#/admin/login'
    //       For traditional apps:        '/admin/login'
    login_url: '/admin/login',

    // TODO: URL path or hash route to the admin dashboard shown after login.
    dashboard_url: '/admin',

    // TODO: URL path or hash route for the booking lookup screen.
    //       Omit if the site has no booking concept.
    booking_lookup_url: '/admin/bookings',

    // TODO: URL path or hash route for the registration lookup screen.
    registration_lookup_url: '/admin/registrations',

    // TODO: URL path or hash route for the reporting screen.
    //       Omit if no reporting UI exists.
    reporting_url: '/admin/reports',

    // TODO: Set to true if the admin panel is a completely separate web
    //       application from the public-facing site.
    separate_app: false,

    // TODO: Credential vault key for admin login credentials.
    //       Must match the credential_key value configured in the dashboard
    //       under Settings > Credentials.
    credential_key: 'admin',
  },

  // ─── Selectors ─────────────────────────────────────────────────────────────
  // CSS / ARIA selectors used by Playwright in the flow files.
  // Tips:
  //   - Use browser DevTools to identify stable selectors.
  //   - Prefer data-testid attributes when the site provides them.
  //   - Use comma-separated fallbacks for resilience, ordered most-specific first.
  //   - Run:  npx playwright codegen YOUR_SITE_URL  to capture selectors
  //     interactively.
  //
  // After filling in selectors here, mirror the same values in the flow files
  // (browse.ts, registration.ts, checkout.ts).

  selectors: {
    // TODO: CSS selector matching each listing card / item on the browse page.
    camp_list_item: '[data-testid="listing-item"], .listing-card, REPLACE_ME',

    // TODO: The primary "Register" / "Sign Up" call-to-action button.
    register_button: '[data-testid="register-btn"], button[class*="register"], REPLACE_ME',

    // TODO: The login button or link visible in the site header.
    login_button: '[data-testid="login-btn"], a[href*="login"], REPLACE_ME',

    // TODO: Registration form — first name field.
    form_first_name: 'input[name="firstName"], input[placeholder*="First"], REPLACE_ME',

    // TODO: Registration form — last name field.
    form_last_name: 'input[name="lastName"], input[placeholder*="Last"], REPLACE_ME',

    // TODO: Registration form — email field.
    form_email: 'input[type="email"], input[name="email"], REPLACE_ME',

    // TODO: Registration form — phone field.
    form_phone: 'input[type="tel"], input[name="phone"], REPLACE_ME',

    // TODO: Registration form — date of birth field.
    //       Omit if the site does not collect date of birth.
    form_dob: 'input[name="dob"], input[name="dateOfBirth"], REPLACE_ME',

    // TODO: Primary form submit button (applies to both registration and checkout).
    submit_button: 'button[type="submit"], [data-testid="submit"], REPLACE_ME',

    // TODO: Element that appears on success / confirmation.
    success_message: '[data-testid="success"], [class*="success"], REPLACE_ME',

    // TODO: Element that appears when an error occurs.
    error_message: '[data-testid="error"], [class*="error"], .alert-danger, REPLACE_ME',

    // ── Admin selectors (Phase 7) — omit if admin flows are not implemented ──

    // TODO: The admin login form element.
    admin_login_form: 'form[id="adminLoginForm"], form[class*="login"], REPLACE_ME',

    // TODO: Email / username input on the admin login form.
    admin_email_input: 'input[name="email"], input[name="username"], REPLACE_ME',

    // TODO: Password input on the admin login form.
    admin_password_input: 'input[name="password"], input[type="password"]',

    // TODO: Submit button on the admin login form.
    admin_login_submit: 'button[type="submit"], button[class*="login"], REPLACE_ME',

    // TODO: Admin navigation menu or sidebar container.
    admin_nav_menu: 'nav, [class*="sidebar"], [data-testid="admin-nav"], REPLACE_ME',

    // TODO: Table or list that displays bookings in the admin panel.
    admin_booking_table: 'table, [class*="booking-list"], [data-testid="bookings"], REPLACE_ME',

    // TODO: Table or list that displays registrations in the admin panel.
    admin_registration_table: 'table, [class*="registration-list"], [data-testid="registrations"], REPLACE_ME',

    // TODO: Search input in the admin panel.
    admin_search_input: 'input[type="search"], input[name="search"], REPLACE_ME',

    // TODO: Edit button/link in admin data tables.
    admin_edit_button: 'button[class*="edit"], [data-testid="edit"], REPLACE_ME',

    // TODO: Save button on admin edit forms.
    admin_save_button: 'button[type="submit"], button[class*="save"], REPLACE_ME',

    // TODO: Container element for the admin reporting / charts screen.
    admin_report_container: '[class*="report"], [data-testid="report"], REPLACE_ME',
  },

  // ─── Elevated Approval Categories ──────────────────────────────────────────
  // List the action categories that require operator approval before the runner
  // executes them.  Standard values:
  //   'registration_submit' — submitting a registration form
  //   'checkout_submit'     — submitting a payment
  //   'admin_write'         — saving edits in the admin panel
  //   'admin_delete'        — deleting records in the admin panel
  //
  // TODO: Remove categories that do not apply to this site.

  elevated_approval_categories: [
    'registration_submit',
    'checkout_submit',
    'admin_write',
    'admin_delete',
  ],

  // ─── Notes ─────────────────────────────────────────────────────────────────
  // TODO: Replace with free-form notes about this site that will help future
  //       operators understand its quirks.
  //
  // Useful things to document here:
  //   - SPA vs MPA (and routing style: hash vs history)
  //   - Authentication requirements before viewing listings
  //   - Known flakiness or timing issues
  //   - Test account creation instructions
  //   - Links to API documentation or Swagger/OpenAPI specs

  notes:
    'TODO: Describe this site — routing style, auth requirements, known quirks, ' +
    'and where test accounts are stored.',
};

export default rules;
