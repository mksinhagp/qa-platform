/**
 * Email Provider Abstraction — Phase 16.1
 *
 * Defines a generic EmailProvider interface that all provider implementations
 * must satisfy. This makes email validation portable across IMAP, Gmail API,
 * Mailtrap, Mailosaur, Mailcatcher, and webhook/inbound parse strategies.
 */

import type { ParsedEmail } from './types.js';

// ─── Provider Interface ─────────────────────────────────────────────────────

/**
 * Configuration common to all email providers.
 * Provider-specific config extends this via config_json.
 */
export interface EmailProviderConfig {
  /** Unique provider name */
  name: string;
  /** Provider type identifier */
  type: EmailProviderType;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
  /** Optional secret ID for vault-backed credentials */
  secretId?: number;
}

export type EmailProviderType =
  | 'imap'
  | 'gmail_api'
  | 'mailtrap'
  | 'mailosaur'
  | 'mailcatcher'
  | 'webhook_inbound';

/**
 * Generic email provider interface.
 * All provider implementations must satisfy this contract.
 */
export interface EmailProvider {
  /** Provider type identifier */
  readonly type: EmailProviderType;

  /** Provider display name */
  readonly name: string;

  /**
   * Connect to the email provider (open session, authenticate).
   * Must be called before fetchEmail or searchEmails.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the email provider (close session).
   * Safe to call multiple times.
   */
  disconnect(): Promise<void>;

  /**
   * Fetch a single email matching the correlation token in the recipient address.
   * Returns null if no matching message is found.
   *
   * @param token      Correlation token to search for
   * @param folder     Mailbox folder (default: INBOX)
   * @param sinceDate  Only messages after this date
   */
  fetchEmail(
    token: string,
    folder?: string,
    sinceDate?: Date,
  ): Promise<ParsedEmail | null>;

  /**
   * Search for emails matching arbitrary criteria.
   * Returns an array of matching parsed emails.
   *
   * @param criteria  Provider-specific search criteria
   */
  searchEmails(criteria: EmailSearchCriteria): Promise<ParsedEmail[]>;

  /**
   * Check if the provider is healthy and reachable.
   * Returns true if the provider can accept requests.
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Search criteria for email provider queries.
 */
export interface EmailSearchCriteria {
  /** Search in recipient address */
  to?: string;
  /** Search in sender address */
  from?: string;
  /** Search in subject line */
  subject?: string;
  /** Search in body text */
  bodyText?: string;
  /** Only messages after this date */
  sinceDate?: Date;
  /** Only messages before this date */
  beforeDate?: Date;
  /** Maximum number of results */
  limit?: number;
  /** Mailbox folder to search */
  folder?: string;
}

// ─── Provider Registry ──────────────────────────────────────────────────────

type ProviderFactory = (config: EmailProviderConfig) => EmailProvider;
const providerRegistry = new Map<EmailProviderType, ProviderFactory>();

/**
 * Register a provider factory for a given provider type.
 * Called once per provider type at module initialization.
 */
export function registerProviderFactory(
  type: EmailProviderType,
  factory: ProviderFactory,
): void {
  providerRegistry.set(type, factory);
}

/**
 * Create a provider instance from configuration.
 * Throws if no factory is registered for the provider type.
 */
export function createProvider(config: EmailProviderConfig): EmailProvider {
  const factory = providerRegistry.get(config.type);
  if (!factory) {
    throw new Error(
      `No email provider factory registered for type "${config.type}". ` +
      `Registered types: ${[...providerRegistry.keys()].join(', ')}`,
    );
  }
  return factory(config);
}

/**
 * List all registered provider types.
 */
export function listRegisteredProviderTypes(): EmailProviderType[] {
  return [...providerRegistry.keys()];
}
