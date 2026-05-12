/**
 * Account Lifecycle Module — Phase 15
 *
 * Reusable account lifecycle flows for registration-oriented websites.
 */

export {
  executeRegistration,
  type RegistrationFieldMapping,
  type PersonaIdentity,
  type RegistrationResult,
} from './registration-template.js';

export {
  executeLogin,
  getLoginStrategy,
  EmailPasswordStrategy,
  UsernamePasswordStrategy,
  MagicLinkStrategy,
  EmailOtpStrategy,
  ManualSsoApprovalStrategy,
  type LoginStrategyType,
  type LoginCredentials,
  type LoginSelectors,
  type LoginResult,
  type LoginOptions,
  type LoginStrategy,
} from './login-strategy.js';

export {
  verifyByLink,
  verifyByCode,
  extractVerificationCode,
  extractVerificationLink,
  type VerificationMethod,
  type VerificationSelectors,
  type VerificationResult,
} from './email-verification.js';

export {
  requestPasswordReset,
  completePasswordReset,
  extractResetLink,
  type PasswordResetSelectors,
  type PasswordResetResult,
} from './password-reset.js';
