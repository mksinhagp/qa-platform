/**
 * SiteRules — typed Zod schema for per-site business rules.
 * Each site under test defines a rules.ts file that exports a SiteRules object.
 * These rules drive both runner oracles and API validation per master plan §13.
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
  submit_button: z.string().optional(),
  success_message: z.string().optional(),
  error_message: z.string().optional(),
}).catchall(z.string());

// ─── Root SiteRules ──────────────────────────────────────────────────────────

export const SiteRulesSchema = z.object({
  site_id: z.string().min(1),
  display_name: z.string().min(1),
  base_url: z.string().url(),

  capacity: CapacityRulesSchema.optional(),
  age_restriction: AgeRestrictionSchema.optional(),
  coupon: CouponRulesSchema.optional(),
  payment: PaymentRulesSchema.optional(),
  cancellation: CancellationRulesSchema.optional(),
  registration: RegistrationFlowSchema.optional(),

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
