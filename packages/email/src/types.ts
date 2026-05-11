/**
 * Email Validation Module — Type Definitions
 * Phase 5: Confirmation email checking after registration/checkout flows.
 */

// ─── Inbox Configuration ────────────────────────────────────────────────────

export interface ImapConfig {
  host: string;
  port: number;
  tls: boolean;
  /** IMAP login username */
  user: string;
  /** IMAP login password (from vault — plaintext only in process memory) */
  password: string;
  /** Connection timeout in milliseconds */
  connTimeout?: number;
  /** Auth timeout in milliseconds */
  authTimeout?: number;
}

// ─── Parsed Email ────────────────────────────────────────────────────────────

export interface ParsedEmail {
  uid: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  textBody: string | null;
  htmlBody: string | null;
  /** All hrefs extracted from the HTML body */
  links: string[];
  /** Attachment count and MIME types */
  attachments: Array<{ filename: string; contentType: string; size: number }>;
}

// ─── Delivery Check ──────────────────────────────────────────────────────────

export interface DeliveryCheckOptions {
  /** Max time to wait for email delivery in milliseconds (default 5 min) */
  timeoutMs?: number;
  /** How often to poll IMAP in milliseconds (default 15s) */
  pollIntervalMs?: number;
  /** IMAP folder/mailbox to search (default INBOX) */
  folder?: string;
}

export interface DeliveryResult {
  delivered: boolean;
  email: ParsedEmail | null;
  latencyMs: number | null;
  pollCount: number;
  error: string | null;
}

// ─── Validation Checks ───────────────────────────────────────────────────────

export type CheckType =
  | 'delivery'
  | 'subject_pattern'
  | 'body_pattern'
  | 'link_extract'
  | 'link_reachable'
  | 'render_fidelity'
  | 'brand_logo'
  | 'brand_footer';

export type CheckStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface CheckResult {
  check_type: CheckType;
  status: CheckStatus;
  detail: string | null;
  url_tested: string | null;
  diff_percent: string | null;
  http_status: number | null;
  artifact_path: string | null;
}

// ─── Full Validation Result ──────────────────────────────────────────────────

export interface EmailValidationResult {
  /** Overall pass/fail — true only if delivery passed and all non-skipped checks passed */
  passed: boolean;
  deliveryResult: DeliveryResult;
  checks: CheckResult[];
}

// ─── Assertion Spec ──────────────────────────────────────────────────────────

export interface EmailAssertionSpec {
  /** Substring or regex source to match against email subject */
  subjectPattern?: string;
  /** Substring or regex source to match against email body (text or HTML) */
  bodyPattern?: string;
  /** Sender address pattern to match */
  fromPattern?: string;
  /** Whether to extract and check all hrefs for reachability */
  checkLinks?: boolean;
  /** Whether to screenshot the HTML body and run a pixel diff */
  checkRenderFidelity?: boolean;
  /**
   * Required brand elements: logo selector, footer text substring.
   * Applied to the HTML body via cheerio.
   */
  brandAssertions?: {
    logoSelector?: string;
    footerText?: string;
  };
  /** Directory to write render screenshots and artifacts */
  artifactDir?: string;
}
