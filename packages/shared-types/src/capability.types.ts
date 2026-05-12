/**
 * Site capability types — Phase 14.1
 * Represents per-site capability declarations and flow mappings.
 */

// ─── Capability Keys ────────────────────────────────────────────────────────

/** Canonical capability keys supported by the platform */
export type CapabilityKey =
  | 'registration'
  | 'login'
  | 'logout'
  | 'email_verification'
  | 'password_reset'
  | 'profile_update'
  | 'checkout'
  | 'payment_receipt_validation'
  | 'admin_reconciliation'
  | 'cancellation_refund'
  | 'reporting';

/** All valid capability keys as a constant array */
export const CAPABILITY_KEYS: readonly CapabilityKey[] = [
  'registration',
  'login',
  'logout',
  'email_verification',
  'password_reset',
  'profile_update',
  'checkout',
  'payment_receipt_validation',
  'admin_reconciliation',
  'cancellation_refund',
  'reporting',
] as const;

// ─── Flow Keys ──────────────────────────────────────────────────────────────

/** Canonical flow keys for standard site flow contract (Phase 14.2) */
export type FlowKey =
  | 'register'
  | 'verify_email'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'profile_update'
  | 'checkout'
  | 'payment_receipt_validation'
  | 'admin_reconciliation';

/** All valid flow keys as a constant array */
export const FLOW_KEYS: readonly FlowKey[] = [
  'register',
  'verify_email',
  'login',
  'logout',
  'password_reset',
  'profile_update',
  'checkout',
  'payment_receipt_validation',
  'admin_reconciliation',
] as const;

// ─── Selector Types ─────────────────────────────────────────────────────────

/** Supported selector strategy types (Phase 14.3) */
export type SelectorType = 'css' | 'xpath' | 'aria_role' | 'visible_text' | 'test_id';

/** All valid selector types as a constant array */
export const SELECTOR_TYPES: readonly SelectorType[] = [
  'css',
  'xpath',
  'aria_role',
  'visible_text',
  'test_id',
] as const;

// ─── Flow Implementation Types ──────────────────────────────────────────────

/** How a flow mapping is implemented */
export type FlowImplementation = 'template' | 'custom' | 'config_driven';

// ─── DB Record Types ────────────────────────────────────────────────────────

/** Site capability record from site_capabilities table */
export interface SiteCapability {
  id: number;
  site_id: number;
  capability_key: CapabilityKey;
  is_enabled: boolean;
  config_json: Record<string, unknown> | null;
  notes: string | null;
  created_date: Date;
  updated_date: Date;
}

/** Site flow mapping record from site_flow_mappings table */
export interface SiteFlowMapping {
  id: number;
  site_id: number;
  flow_key: FlowKey;
  flow_name: string;
  implementation: FlowImplementation;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_date: Date;
  updated_date: Date;
}

/** Site selector entry record from site_selector_entries table */
export interface SiteSelectorEntry {
  id: number;
  site_id: number;
  element_key: string;
  label: string;
  selector_type: SelectorType;
  selector_value: string;
  fallback_order: number;
  is_active: boolean;
  flow_key: string | null;
  notes: string | null;
  created_date: Date;
  updated_date: Date;
}

/** Site rules version record from site_rules_versions table */
export interface SiteRulesVersion {
  id: number;
  site_id: number;
  version: number;
  rules_json: Record<string, unknown>;
  is_active: boolean;
  published_at: Date | null;
  notes: string | null;
  created_date: Date;
}
