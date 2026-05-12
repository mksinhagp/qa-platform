/**
 * SiteRules — typed Zod schema for per-site business rules.
 * Each site under test defines a rules.ts file that exports a SiteRules object.
 * These rules drive both runner oracles and API validation per master plan §13.
 *
 * Phase 14 additions:
 *   - capabilities: per-site capability declarations
 *   - login_strategy: supported login methods
 *   - email_expectations: email verification and notification config
 *   - cleanup_policy: test account cleanup rules
 *   - admin_reconciliation: admin reconciliation rules
 */

import { z } from 'zod';

// ─── Capacity ────────────────────────────────────────────────────────────────

const CapacityRulesSchema = z.object({
  max_attendees_per_booking: z.number().int().positive().optional(),
  max_bookings_per_event: z.number().int().positive().optional(),
  waitlist_enabled: z.boolean().default(false),
  waitlist_max_size: z.number().int().nonnegative().optional(),
});

// ─── Age Restrictions ────────────────────────────────────────────────────────

const AgeRestrictionSchema = z.object({
  min_age: z.number().int().nonnegative().optional(),
  max_age: z.number().int().positive().optional(),
  require_guardian_if_under: z.number().int().positive().optional(),
});

// ─── Coupon / Discount ───────────────────────────────────────────────────────

const CouponRulesSchema = z.object({
  enabled: z.boolean().default(false),
  max_discount_percent: z.number().min(0).max(100).optional(),
  sibling_discount_percent: z.number().min(0).max(100).optional(),
  sibling_discount_requires_same_event: z.boolean().default(false),
});

// ─── Payment ─────────────────────────────────────────────────────────────────

const PaymentRulesSchema = z.object({
  partial_payment_allowed: z.boolean().default(false),
  partial_payment_min_percent: z.number().min(0).max(100).optional(),
  hold_expiry_hours: z.number().positive().optional(),
  sandbox_mode: z.boolean().default(true),
  accepted_methods: z.array(z.enum(['card', 'ach', 'check', 'cash'])).default(['card']),
});

// ─── Cancellation / Refund ───────────────────────────────────────────────────

const CancellationRulesSchema = z.object({
  allowed: z.boolean().default(true),
  window_hours: z.number().nonnegative().optional(),
  refund_percent_within_window: z.number().min(0).max(100).default(100),
  refund_percent_outside_window: z.number().min(0).max(100).default(0),
  date_change_allowed: z.boolean().default(false),
  date_change_fee: z.number().nonnegative().optional(),
});

// ─── Registration Flow ───────────────────────────────────────────────────────

const RegistrationFlowSchema = z.object({
  require_waiver: z.boolean().default(false),
  waiver_text: z.string().optional(),
  multi_attendee_allowed: z.boolean().default(false),
  max_attendees_per_transaction: z.number().int().positive().default(1),
  email_confirmation_expected: z.boolean().default(true),
  confirmation_email_subject_pattern: z.string().optional(),
  confirmation_email_link_text_pattern: z.string().optional(),
  /** Field mapping: maps canonical field names to site-specific form field names */
  field_mapping: z.record(z.string()).optional(),
});

// ─── Selectors (site-specific CSS/React selectors for Playwright) ─────────────

const SelectorsSchema = z.object({
  register_button: z.string().optional(),
  login_button: z.string().optional(),
  camp_list_item: z.string().optional(),
  form_first_name: z.string().optional(),
  form_last_name: z.string().optional(),
  form_email: z.string().optional(),
  form_phone: z.string().optional(),
  form_dob: z.string().optional(),
  form_password: z.string().optional(),
  form_confirm_password: z.string().optional(),
  form_username: z.string().optional(),
  submit_button: z.string().optional(),
  success_message: z.string().optional(),
  error_message: z.string().optional(),
  // Login-specific selectors
  login_email_input: z.string().optional(),
  login_password_input: z.string().optional(),
  login_submit: z.string().optional(),
  logout_button: z.string().optional(),
  // Password reset selectors
  password_reset_trigger: z.string().optional(),
  password_reset_email_input: z.string().optional(),
  password_reset_submit: z.string().optional(),
  password_reset_new_password: z.string().optional(),
  password_reset_confirm_password: z.string().optional(),
  // Verification selectors
  verification_code_input: z.string().optional(),
  verification_submit: z.string().optional(),
}).catchall(z.string());

// ─── Admin / Back-Office ──────────────────────────────────────────────────────

const AdminConfigSchema = z.object({
  /** Admin login URL or hash route (e.g., '#/admin/login') */
  login_url: z.string().min(1),
  /** Admin dashboard base URL or hash route after login */
  dashboard_url: z.string().min(1),
  /** Route or URL pattern for booking lookups */
  booking_lookup_url: z.string().optional(),
  /** Route or URL pattern for registration lookups */
  registration_lookup_url: z.string().optional(),
  /** Route or URL pattern for reporting/list screens */
  reporting_url: z.string().optional(),
  /** Whether the admin panel is a separate app or the same SPA */
  separate_app: z.boolean().default(false),
  /** Credential reference key in the vault for admin login */
  credential_key: z.string().default('admin'),
});

// ─── Capabilities (Phase 14.1) ──────────────────────────────────────────────

const CapabilityKeyEnum = z.enum([
  'registration', 'login', 'logout', 'email_verification',
  'password_reset', 'profile_update', 'checkout',
  'payment_receipt_validation', 'admin_reconciliation',
  'cancellation_refund', 'reporting',
]);

const CapabilitiesSchema = z.record(
  CapabilityKeyEnum,
  z.boolean(),
).optional();

// ─── Login Strategy (Phase 14.4 / 15.2) ────────────────────────────────────

const LoginStrategySchema = z.object({
  /** Primary login method */
  primary: z.enum([
    'email_password', 'username_password', 'magic_link',
    'email_otp', 'manual_sso_approval',
  ]).default('email_password'),
  /** Whether username or email is used as the login identifier */
  identifier_field: z.enum(['email', 'username']).default('email'),
  /** Whether the site supports "remember me" */
  remember_me_available: z.boolean().default(false),
  /** Whether multi-factor auth is required after primary login */
  mfa_required: z.boolean().default(false),
  /** Allowed secondary login methods */
  secondary: z.array(z.enum([
    'email_password', 'username_password', 'magic_link',
    'email_otp', 'manual_sso_approval',
  ])).optional(),
});

// ─── Email Expectations (Phase 14.4 / 16) ──────────────────────────────────

const EmailExpectationsSchema = z.object({
  /** Whether the site sends a verification email after registration */
  verification_email_expected: z.boolean().default(true),
  /** How verification is completed */
  verification_method: z.enum(['link_click', 'code_entry', 'auto_verified', 'manual']).default('link_click'),
  /** Whether the site sends a welcome email (separate from verification) */
  welcome_email_expected: z.boolean().default(false),
  /** Whether the site sends a password reset email */
  password_reset_email_expected: z.boolean().default(true),
  /** Whether the site sends receipt/confirmation emails after checkout */
  receipt_email_expected: z.boolean().default(false),
  /** Maximum expected delivery time in ms (for SLA) */
  max_delivery_ms: z.number().int().positive().default(300000),
});

// ─── Cleanup Policy (Phase 14.4 / 15.5) ────────────────────────────────────

const CleanupPolicySchema = z.object({
  /** Whether test accounts should be cleaned up after a run */
  auto_cleanup: z.boolean().default(false),
  /** Whether destructive cleanup requires operator approval */
  require_approval: z.boolean().default(true),
  /** Maximum age in hours before an account is considered stale */
  max_age_hours: z.number().int().positive().default(72),
  /** Cleanup method: API call, admin UI automation, or manual */
  method: z.enum(['api', 'admin_ui', 'manual', 'none']).default('manual'),
  /** API endpoint for programmatic cleanup (if method=api) */
  api_endpoint: z.string().optional(),
});

// ─── Admin Reconciliation (Phase 14.4) ──────────────────────────────────────

const AdminReconciliationSchema = z.object({
  /** Whether admin reconciliation is enabled for this site */
  enabled: z.boolean().default(false),
  /** Fields to cross-check between frontend and admin panel */
  fields_to_verify: z.array(z.string()).default([]),
  /** Whether the admin panel uses a different data format */
  format_differences: z.record(z.string()).optional(),
});

// ─── Root SiteRules ──────────────────────────────────────────────────────────

export const SiteRulesSchema = z.object({
  site_id: z.string().min(1),
  display_name: z.string().min(1),
  base_url: z.string().url(),

  /** Phase 14.1: Declared site capabilities */
  capabilities: CapabilitiesSchema,

  capacity: CapacityRulesSchema.optional(),
  age_restriction: AgeRestrictionSchema.optional(),
  coupon: CouponRulesSchema.optional(),
  payment: PaymentRulesSchema.optional(),
  cancellation: CancellationRulesSchema.optional(),
  registration: RegistrationFlowSchema.optional(),

  /** Phase 14.4: Login strategy configuration */
  login_strategy: LoginStrategySchema.optional(),

  /** Phase 14.4: Email expectations for validation */
  email_expectations: EmailExpectationsSchema.optional(),

  /** Phase 14.4: Test account cleanup policy */
  cleanup_policy: CleanupPolicySchema.optional(),

  /** Phase 14.4: Admin reconciliation configuration */
  admin_reconciliation: AdminReconciliationSchema.optional(),

  /** Admin / back-office configuration — Phase 7 */
  admin: AdminConfigSchema.optional(),

  /** Site-specific CSS/ARIA selectors — override defaults in flows */
  selectors: SelectorsSchema.optional(),

  /** Approval categories that require elevation for this site */
  elevated_approval_categories: z.array(z.string()).optional(),

  /** Free-form metadata for the operator */
  notes: z.string().optional(),
});

export type SiteRules = z.infer<typeof SiteRulesSchema>;
export type CapacityRules = z.infer<typeof CapacityRulesSchema>;
export type AgeRestriction = z.infer<typeof AgeRestrictionSchema>;
export type CouponRules = z.infer<typeof CouponRulesSchema>;
export type PaymentRules = z.infer<typeof PaymentRulesSchema>;
export type CancellationRules = z.infer<typeof CancellationRulesSchema>;
export type RegistrationFlow = z.infer<typeof RegistrationFlowSchema>;
export type Selectors = z.infer<typeof SelectorsSchema>;
export type AdminConfig = z.infer<typeof AdminConfigSchema>;
export type LoginStrategyConfig = z.infer<typeof LoginStrategySchema>;
export type EmailExpectations = z.infer<typeof EmailExpectationsSchema>;
export type CleanupPolicy = z.infer<typeof CleanupPolicySchema>;
export type AdminReconciliation = z.infer<typeof AdminReconciliationSchema>;

// Re-export sub-schemas for programmatic validation
export {
  CapacityRulesSchema,
  AgeRestrictionSchema,
  CouponRulesSchema,
  PaymentRulesSchema,
  CancellationRulesSchema,
  RegistrationFlowSchema,
  SelectorsSchema,
  AdminConfigSchema,
  CapabilityKeyEnum,
  LoginStrategySchema,
  EmailExpectationsSchema,
  CleanupPolicySchema,
  AdminReconciliationSchema,
};
