/**
 * @qa-platform/email — Email Validation Module
 *
 * Phase 5: Confirmation email checking after registration/checkout flows.
 *
 * Public API:
 *   - validateEmail()         Full pipeline: deliver → assert → link-check
 *   - waitForDelivery()       IMAP polling only (for custom pipelines)
 *   - runEmailAssertions()    Assertion checks against a parsed email
 *   - checkLinkReachability() HTTP HEAD checks for all extracted links
 *   - generateCorrelationToken()
 *   - buildTestEmailAddress()
 *   - extractCorrelationToken()
 */

export { validateEmail } from './validator.js';
export { waitForDelivery } from './delivery.js';
export { fetchEmailByToken } from './imap.js';
export { runEmailAssertions } from './assertions.js';
export { checkLinkReachability } from './linkChecker.js';
export {
  generateCorrelationToken,
  buildTestEmailAddress,
  extractCorrelationToken,
} from './correlationToken.js';

export type {
  ImapConfig,
  ParsedEmail,
  DeliveryCheckOptions,
  DeliveryResult,
  CheckType,
  CheckStatus,
  CheckResult,
  EmailValidationResult,
  EmailAssertionSpec,
} from './types.js';
