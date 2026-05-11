/**
 * Site Rules: Yugal Kunj QA Portal (Next-Gen)
 * URL: https://ykportalnextgenqa.yugalkunj.org
 *
 * This is a React SPA using hash routing (#/camp/center, #/login, etc.).
 * All navigation must wait for hash changes rather than full page loads.
 */

import type { SiteRules } from '@qa-platform/rules';

const rules: SiteRules = {
  site_id: 'yugal-kunj',
  display_name: 'Yugal Kunj QA Portal',
  base_url: 'https://ykportalnextgenqa.yugalkunj.org',

  capacity: {
    max_attendees_per_booking: 5,
    waitlist_enabled: false,
  },

  age_restriction: {
    min_age: 5,
    require_guardian_if_under: 18,
  },

  coupon: {
    enabled: true,
    sibling_discount_percent: 10,
    sibling_discount_requires_same_event: false,
  },

  payment: {
    partial_payment_allowed: false,
    sandbox_mode: true,
    accepted_methods: ['card'],
  },

  cancellation: {
    allowed: true,
    window_hours: 72,
    refund_percent_within_window: 100,
    refund_percent_outside_window: 0,
    date_change_allowed: false,
  },

  registration: {
    require_waiver: false,
    multi_attendee_allowed: true,
    max_attendees_per_transaction: 5,
    email_confirmation_expected: true,
    confirmation_email_subject_pattern: 'Registration Confirmation',
  },

  admin: {
    login_url: '#/login',
    dashboard_url: '#/admin',
    booking_lookup_url: '#/admin/bookings',
    registration_lookup_url: '#/admin/registrations',
    reporting_url: '#/admin/reports',
    separate_app: false,
    credential_key: 'admin',
  },

  selectors: {
    // SPA top-level nav — hash-based routing
    camp_list_item: '.camp-card, [class*="camp"], [class*="Camp"]',
    register_button: 'button[class*="register"], button[class*="Register"], a[class*="register"]',
    login_button: 'button[class*="login"], button[class*="Login"], a[href*="login"]',

    // Registration form fields
    form_first_name: 'input[name="firstName"], input[placeholder*="First"]',
    form_last_name: 'input[name="lastName"], input[placeholder*="Last"]',
    form_email: 'input[name="email"], input[type="email"]',
    form_phone: 'input[name="phone"], input[type="tel"]',
    form_dob: 'input[name="dob"], input[name="dateOfBirth"]',
    submit_button: 'button[type="submit"]',

    // Feedback
    success_message: '[class*="success"], [class*="Success"], [class*="confirm"]',
    error_message: '[class*="error"], [class*="Error"], .alert-danger',

    // Admin / back-office selectors — Phase 7
    admin_login_form: 'form[class*="login"], form[class*="Login"], #loginForm',
    admin_email_input: 'input[name="email"], input[name="username"], input[type="email"]',
    admin_password_input: 'input[name="password"], input[type="password"]',
    admin_login_submit: 'button[type="submit"], button[class*="login"], button[class*="Login"]',
    admin_nav_menu: 'nav, [class*="sidebar"], [class*="Sidebar"], [class*="nav"]',
    admin_booking_table: 'table, [class*="table"], [class*="Table"], [class*="booking-list"]',
    admin_registration_table: 'table, [class*="table"], [class*="Table"], [class*="registration-list"]',
    admin_search_input: 'input[type="search"], input[name="search"], input[placeholder*="Search"]',
    admin_edit_button: 'button[class*="edit"], button[class*="Edit"], a[class*="edit"]',
    admin_save_button: 'button[type="submit"], button[class*="save"], button[class*="Save"]',
    admin_report_container: '[class*="report"], [class*="Report"], [class*="chart"], [class*="Chart"]',
  },

  elevated_approval_categories: ['registration_submit', 'checkout_submit', 'admin_write', 'admin_delete'],

  notes:
    'QA-only portal at ykportalnextgenqa.yugalkunj.org. ' +
    'React SPA with hash routing — always use waitForURL with hash patterns. ' +
    'Registration may require an existing account; create test accounts in the vault.',
};

export default rules;
