/**
 * Login Strategy Framework — Phase 15.2
 *
 * Pluggable login strategies that support email/password, username/password,
 * magic link, email OTP, and manual/SSO approval-gated login.
 */

import type { Page } from 'playwright';

/** Supported login strategy types */
export type LoginStrategyType =
  | 'email_password'
  | 'username_password'
  | 'magic_link'
  | 'email_otp'
  | 'manual_sso_approval';

/** Login credentials */
export interface LoginCredentials {
  identifier: string;
  password?: string;
  otpCode?: string;
  magicLinkUrl?: string;
}

/** Login selectors from site configuration */
export interface LoginSelectors {
  identifierInput: string;
  passwordInput?: string;
  submitButton: string;
  otpInput?: string;
  successIndicator: string;
  errorIndicator?: string;
  rememberMeCheckbox?: string;
  forgotPasswordLink?: string;
}

/** Result of a login attempt */
export interface LoginResult {
  success: boolean;
  strategy: LoginStrategyType;
  errorMessage?: string;
  durationMs: number;
  requiresMfa?: boolean;
}

/** Login strategy interface — all strategies implement this */
export interface LoginStrategy {
  readonly type: LoginStrategyType;
  execute(
    page: Page,
    credentials: LoginCredentials,
    selectors: LoginSelectors,
    options?: LoginOptions,
  ): Promise<LoginResult>;
}

export interface LoginOptions {
  timeoutMs?: number;
  hesitateMs?: number;
  rememberMe?: boolean;
}

// ─── Strategy Implementations ───────────────────────────────────────────────

/** Email + password login */
export class EmailPasswordStrategy implements LoginStrategy {
  readonly type = 'email_password' as const;

  async execute(
    page: Page,
    credentials: LoginCredentials,
    selectors: LoginSelectors,
    options: LoginOptions = {},
  ): Promise<LoginResult> {
    const startTime = Date.now();
    const hesitate = options.hesitateMs ?? 200;

    try {
      await page.waitForSelector(selectors.identifierInput, {
        timeout: options.timeoutMs ?? 10000,
      });

      await page.fill(selectors.identifierInput, credentials.identifier);
      if (hesitate > 0) await page.waitForTimeout(hesitate);

      if (selectors.passwordInput && credentials.password) {
        await page.fill(selectors.passwordInput, credentials.password);
        if (hesitate > 0) await page.waitForTimeout(hesitate);
      }

      if (options.rememberMe && selectors.rememberMeCheckbox) {
        const checkbox = await page.$(selectors.rememberMeCheckbox);
        if (checkbox) await checkbox.check();
      }

      await page.click(selectors.submitButton);
      await page.waitForTimeout(2000);

      const success = await page.$(selectors.successIndicator);
      if (success) {
        return {
          success: true,
          strategy: this.type,
          durationMs: Date.now() - startTime,
        };
      }

      const errorEl = selectors.errorIndicator
        ? await page.$(selectors.errorIndicator)
        : null;
      const errorText = errorEl ? await errorEl.textContent() : null;

      return {
        success: false,
        strategy: this.type,
        errorMessage: errorText?.trim() ?? 'Login failed — no success indicator found',
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        strategy: this.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }
}

/** Username + password login (same flow, different identifier field) */
export class UsernamePasswordStrategy extends EmailPasswordStrategy {
  override readonly type = 'username_password' as const;
}

/** Magic link login — clicks a link from email */
export class MagicLinkStrategy implements LoginStrategy {
  readonly type = 'magic_link' as const;

  async execute(
    page: Page,
    credentials: LoginCredentials,
    selectors: LoginSelectors,
    options: LoginOptions = {},
  ): Promise<LoginResult> {
    const startTime = Date.now();
    const hesitate = options.hesitateMs ?? 200;

    try {
      // Step 1: Enter identifier to request magic link
      await page.waitForSelector(selectors.identifierInput, {
        timeout: options.timeoutMs ?? 10000,
      });
      await page.fill(selectors.identifierInput, credentials.identifier);
      if (hesitate > 0) await page.waitForTimeout(hesitate);
      await page.click(selectors.submitButton);
      await page.waitForTimeout(2000);

      // Step 2: Navigate to magic link URL (provided by email module)
      if (!credentials.magicLinkUrl) {
        return {
          success: false,
          strategy: this.type,
          errorMessage: 'Magic link URL not provided — email polling may have failed',
          durationMs: Date.now() - startTime,
        };
      }

      await page.goto(credentials.magicLinkUrl);
      await page.waitForTimeout(3000);

      const success = await page.$(selectors.successIndicator);
      return {
        success: !!success,
        strategy: this.type,
        errorMessage: success ? undefined : 'Magic link navigation did not result in login',
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        strategy: this.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }
}

/** Email OTP login — enters a code from email */
export class EmailOtpStrategy implements LoginStrategy {
  readonly type = 'email_otp' as const;

  async execute(
    page: Page,
    credentials: LoginCredentials,
    selectors: LoginSelectors,
    options: LoginOptions = {},
  ): Promise<LoginResult> {
    const startTime = Date.now();
    const hesitate = options.hesitateMs ?? 200;

    try {
      // Step 1: Enter identifier to request OTP
      await page.waitForSelector(selectors.identifierInput, {
        timeout: options.timeoutMs ?? 10000,
      });
      await page.fill(selectors.identifierInput, credentials.identifier);
      if (hesitate > 0) await page.waitForTimeout(hesitate);
      await page.click(selectors.submitButton);
      await page.waitForTimeout(2000);

      // Step 2: Enter OTP code (provided by email module)
      if (!credentials.otpCode || !selectors.otpInput) {
        return {
          success: false,
          strategy: this.type,
          errorMessage: 'OTP code or OTP input selector not available',
          durationMs: Date.now() - startTime,
        };
      }

      await page.waitForSelector(selectors.otpInput, { timeout: 5000 });
      await page.fill(selectors.otpInput, credentials.otpCode);
      if (hesitate > 0) await page.waitForTimeout(hesitate);
      await page.click(selectors.submitButton);
      await page.waitForTimeout(2000);

      const success = await page.$(selectors.successIndicator);
      return {
        success: !!success,
        strategy: this.type,
        errorMessage: success ? undefined : 'OTP login did not result in success',
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        strategy: this.type,
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }
}

/** Manual SSO / approval-gated login — pauses for operator action */
export class ManualSsoApprovalStrategy implements LoginStrategy {
  readonly type = 'manual_sso_approval' as const;

  async execute(
    page: Page,
    _credentials: LoginCredentials,
    selectors: LoginSelectors,
    options: LoginOptions = {},
  ): Promise<LoginResult> {
    const startTime = Date.now();
    const timeout = options.timeoutMs ?? 120000;

    try {
      // Wait for the success indicator to appear (operator completes SSO manually)
      await page.waitForSelector(selectors.successIndicator, { timeout });

      return {
        success: true,
        strategy: this.type,
        durationMs: Date.now() - startTime,
      };
    } catch {
      return {
        success: false,
        strategy: this.type,
        errorMessage: `SSO approval timed out after ${timeout}ms`,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

// ─── Strategy Registry ──────────────────────────────────────────────────────

const strategyRegistry = new Map<LoginStrategyType, LoginStrategy>([
  ['email_password', new EmailPasswordStrategy()],
  ['username_password', new UsernamePasswordStrategy()],
  ['magic_link', new MagicLinkStrategy()],
  ['email_otp', new EmailOtpStrategy()],
  ['manual_sso_approval', new ManualSsoApprovalStrategy()],
]);

/**
 * Get a login strategy by type.
 */
export function getLoginStrategy(type: LoginStrategyType): LoginStrategy {
  const strategy = strategyRegistry.get(type);
  if (!strategy) {
    throw new Error(`Unknown login strategy: "${type}"`);
  }
  return strategy;
}

/**
 * Execute login using the specified strategy type.
 */
export async function executeLogin(
  page: Page,
  strategyType: LoginStrategyType,
  credentials: LoginCredentials,
  selectors: LoginSelectors,
  options?: LoginOptions,
): Promise<LoginResult> {
  const strategy = getLoginStrategy(strategyType);
  return strategy.execute(page, credentials, selectors, options);
}
