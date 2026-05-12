/**
 * Email provider types — Phase 16
 * Represents email provider abstractions, inbox bindings, assertions, and SLAs.
 */

// ─── Provider Types ─────────────────────────────────────────────────────────

/** Supported email provider types */
export type EmailProviderType =
  | 'imap'
  | 'gmail_api'
  | 'mailtrap'
  | 'mailosaur'
  | 'mailcatcher'
  | 'webhook_inbound';

/** All valid provider types as a constant array */
export const EMAIL_PROVIDER_TYPES: readonly EmailProviderType[] = [
  'imap',
  'gmail_api',
  'mailtrap',
  'mailosaur',
  'mailcatcher',
  'webhook_inbound',
] as const;

// ─── Email Types ────────────────────────────────────────────────────────────

/** Types of emails the platform can validate */
export type EmailTemplateType =
  | 'registration'
  | 'verification'
  | 'password_reset'
  | 'receipt'
  | 'notification'
  | 'welcome'
  | 'cancellation';

// ─── Assertion Types ────────────────────────────────────────────────────────

/** Types of assertions that can be applied to emails */
export type EmailAssertionType =
  | 'subject_match'
  | 'sender_match'
  | 'body_text_match'
  | 'body_html_match'
  | 'link_present'
  | 'link_reachable'
  | 'brand_logo'
  | 'brand_footer'
  | 'timing_sla';

// ─── Correlation Strategies ─────────────────────────────────────────────────

/** How email correlation is performed */
export type CorrelationStrategy =
  | 'plus_addressing'
  | 'generated_inbox'
  | 'unique_subject_token'
  | 'unique_body_token';

/** All valid correlation strategies as a constant array */
export const CORRELATION_STRATEGIES: readonly CorrelationStrategy[] = [
  'plus_addressing',
  'generated_inbox',
  'unique_subject_token',
  'unique_body_token',
] as const;

// ─── SLA Status ─────────────────────────────────────────────────────────────

/** Status of an email timing SLA check */
export type EmailSlaStatus = 'passed' | 'warning' | 'failed' | 'unknown' | 'timeout';

// ─── DB Record Types ────────────────────────────────────────────────────────

/** Email provider record from email_providers table */
export interface EmailProvider {
  id: number;
  name: string;
  provider_type: EmailProviderType;
  is_active: boolean;
  config_json: Record<string, unknown>;
  secret_id: number | null;
  notes: string | null;
  created_date: Date;
  updated_date: Date;
}

/** Email inbox binding v2 record */
export interface EmailInboxBindingV2 {
  id: number;
  email_provider_id: number;
  inbox_address: string;
  site_id: number | null;
  site_environment_id: number | null;
  persona_id: string | null;
  flow_key: string | null;
  role_tag: string | null;
  campaign: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_date: Date;
}

/** Email template assertion record */
export interface EmailTemplateAssertion {
  id: number;
  site_id: number;
  email_type: EmailTemplateType;
  assertion_name: string;
  assertion_type: EmailAssertionType;
  expected_value: string | null;
  is_regex: boolean;
  is_required: boolean;
  sort_order: number;
  notes: string | null;
  created_date: Date;
}

/** Email timing SLA record */
export interface EmailTimingSla {
  id: number;
  site_id: number;
  email_type: EmailTemplateType;
  max_delivery_ms: number;
  warn_delivery_ms: number;
  is_active: boolean;
  notes: string | null;
  created_date: Date;
}

/** Email timing result record */
export interface EmailTimingResult {
  id: number;
  run_execution_id: number;
  email_timing_sla_id: number | null;
  email_type: EmailTemplateType;
  delivery_latency_ms: number | null;
  sla_status: EmailSlaStatus;
  timeout_occurred: boolean;
  correlation_token: string | null;
  provider_type: EmailProviderType | null;
  error_message: string | null;
  created_date: Date;
}

/** Email correlation config record */
export interface EmailCorrelationConfig {
  id: number;
  site_id: number;
  email_provider_id: number | null;
  strategy: CorrelationStrategy;
  base_address: string | null;
  token_pattern: string | null;
  config_json: Record<string, unknown> | null;
  is_active: boolean;
  notes: string | null;
}
