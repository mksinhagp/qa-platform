/**
 * Email Correlation Strategy — Phase 16.5
 *
 * Configurable strategies for correlating test emails with QA run executions.
 * Supports:
 *   - Plus-addressing: user+token@example.com (default)
 *   - Generated inboxes: unique-token@testdomain.com
 *   - Unique subject tokens: embed token in expected subject line
 *   - Unique body tokens: embed token in registration form data
 */

import { randomBytes } from 'crypto';

// ─── Strategy Types ─────────────────────────────────────────────────────────

export type CorrelationStrategyType =
  | 'plus_addressing'
  | 'generated_inbox'
  | 'unique_subject_token'
  | 'unique_body_token';

/** Configuration for a correlation strategy */
export interface CorrelationStrategyConfig {
  strategy: CorrelationStrategyType;
  /** Base email address (for plus_addressing) */
  baseAddress?: string;
  /** Domain for generated inboxes */
  inboxDomain?: string;
  /** Token pattern — used for subject/body token strategies */
  tokenPattern?: string;
  /** Custom token length (default: 12) */
  tokenLength?: number;
}

/** Result of token generation */
export interface CorrelationTokenResult {
  /** The generated correlation token */
  token: string;
  /** The email address to use for this execution */
  emailAddress: string;
  /** Strategy used */
  strategy: CorrelationStrategyType;
}

// ─── Strategy Interface ─────────────────────────────────────────────────────

export interface CorrelationStrategy {
  readonly type: CorrelationStrategyType;

  /**
   * Generate a correlation token and the test email address for this execution.
   */
  generate(config: CorrelationStrategyConfig): CorrelationTokenResult;

  /**
   * Extract the correlation token from a received email address.
   * Returns null if extraction fails.
   */
  extractToken(address: string, config: CorrelationStrategyConfig): string | null;
}

// ─── Implementations ────────────────────────────────────────────────────────

/** Plus-addressing: user+token@example.com */
class PlusAddressingStrategy implements CorrelationStrategy {
  readonly type = 'plus_addressing' as const;

  generate(config: CorrelationStrategyConfig): CorrelationTokenResult {
    const token = generateToken(config.tokenLength);
    const baseAddress = config.baseAddress ?? 'qa@example.com';
    const atIdx = baseAddress.lastIndexOf('@');
    if (atIdx === -1) {
      throw new Error(`Invalid base address: "${baseAddress}"`);
    }
    const local = baseAddress.slice(0, atIdx);
    const domain = baseAddress.slice(atIdx + 1);
    return {
      token,
      emailAddress: `${local}+${token}@${domain}`,
      strategy: this.type,
    };
  }

  extractToken(address: string): string | null {
    const atIdx = address.lastIndexOf('@');
    if (atIdx === -1) return null;
    const local = address.slice(0, atIdx);
    const plusIdx = local.lastIndexOf('+');
    if (plusIdx === -1) return null;
    return local.slice(plusIdx + 1);
  }
}

/** Generated inbox: unique-token@testdomain.com */
class GeneratedInboxStrategy implements CorrelationStrategy {
  readonly type = 'generated_inbox' as const;

  generate(config: CorrelationStrategyConfig): CorrelationTokenResult {
    const token = generateToken(config.tokenLength);
    const domain = config.inboxDomain ?? 'test.example.com';
    return {
      token,
      emailAddress: `${token}@${domain}`,
      strategy: this.type,
    };
  }

  extractToken(address: string): string | null {
    const atIdx = address.lastIndexOf('@');
    if (atIdx === -1) return null;
    return address.slice(0, atIdx);
  }
}

/** Unique subject token: embed correlation token in expected subject line */
class UniqueSubjectTokenStrategy implements CorrelationStrategy {
  readonly type = 'unique_subject_token' as const;

  generate(config: CorrelationStrategyConfig): CorrelationTokenResult {
    const token = generateToken(config.tokenLength);
    const baseAddress = config.baseAddress ?? 'qa@example.com';
    return {
      token,
      emailAddress: baseAddress,
      strategy: this.type,
    };
  }

  extractToken(_address: string, config: CorrelationStrategyConfig): string | null {
    // For subject tokens, extraction happens from the subject line, not the address.
    // This method returns the token pattern for the caller to use.
    return config.tokenPattern ?? null;
  }
}

/** Unique body token: embed correlation token in registration form data */
class UniqueBodyTokenStrategy implements CorrelationStrategy {
  readonly type = 'unique_body_token' as const;

  generate(config: CorrelationStrategyConfig): CorrelationTokenResult {
    const token = generateToken(config.tokenLength);
    const baseAddress = config.baseAddress ?? 'qa@example.com';
    return {
      token,
      emailAddress: baseAddress,
      strategy: this.type,
    };
  }

  extractToken(_address: string, config: CorrelationStrategyConfig): string | null {
    return config.tokenPattern ?? null;
  }
}

// ─── Registry ───────────────────────────────────────────────────────────────

const strategies = new Map<CorrelationStrategyType, CorrelationStrategy>([
  ['plus_addressing', new PlusAddressingStrategy()],
  ['generated_inbox', new GeneratedInboxStrategy()],
  ['unique_subject_token', new UniqueSubjectTokenStrategy()],
  ['unique_body_token', new UniqueBodyTokenStrategy()],
]);

/**
 * Get a correlation strategy by type.
 */
export function getCorrelationStrategy(type: CorrelationStrategyType): CorrelationStrategy {
  const strategy = strategies.get(type);
  if (!strategy) {
    throw new Error(`Unknown correlation strategy: "${type}"`);
  }
  return strategy;
}

/**
 * Generate a correlation token and email address using the specified strategy.
 */
export function generateCorrelation(
  config: CorrelationStrategyConfig,
): CorrelationTokenResult {
  const strategy = getCorrelationStrategy(config.strategy);
  return strategy.generate(config);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateToken(length?: number): string {
  const byteLength = Math.ceil((length ?? 12) * 3 / 4);
  return randomBytes(byteLength).toString('base64url').slice(0, length ?? 12);
}
