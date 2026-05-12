/**
 * @qa-platform/email — Email Validation Module
 *
 * Phase 5: Confirmation email checking after registration/checkout flows.
 * Phase 16: Generic Email Provider Layer — portable across providers.
 *
 * Public API:
 *   - validateEmail()         Full pipeline: deliver → assert → link-check
 *   - waitForDelivery()       IMAP polling only (for custom pipelines)
 *   - runEmailAssertions()    Assertion checks against a parsed email
 *   - checkLinkReachability() HTTP HEAD checks for all extracted links
 *   - generateCorrelationToken()
 *   - buildTestEmailAddress()
 *   - extractCorrelationToken()
 *
 * Phase 16 additions:
 *   - createProvider()        Create a provider instance from config
 *   - runTemplateAssertions() Validate against site-specific templates
 *   - generateCorrelation()   Configurable correlation strategies
 *   - ImapEmailProvider       IMAP provider implementation
 *   - TestEmailProvider       In-memory test provider
 */

// Phase 5 exports (unchanged)
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

// Phase 16.1: Email provider abstraction
export {
  createProvider,
  registerProviderFactory,
  listRegisteredProviderTypes,
  type EmailProvider,
  type EmailProviderConfig,
  type EmailProviderType,
  type EmailSearchCriteria,
} from './provider.js';

// Phase 16.1: Built-in provider implementations
export { ImapEmailProvider } from './providers/imap-provider.js';
export { TestEmailProvider } from './providers/test-provider.js';

// Phase 16.3: Email template assertions
export {
  runTemplateAssertions,
  toCheckResults,
  type TemplateAssertion,
  type TemplateAssertionType,
  type TemplateAssertionResult,
} from './templateAssertions.js';

// Phase 16.5: Email correlation strategies
export {
  generateCorrelation,
  getCorrelationStrategy,
  type CorrelationStrategyType,
  type CorrelationStrategyConfig,
  type CorrelationTokenResult,
  type CorrelationStrategy,
} from './correlationStrategy.js';

// Type exports
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

// Register built-in providers on import
import './providers/index.js';
