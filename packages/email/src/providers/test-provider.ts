/**
 * Test Email Provider — Phase 16.1
 *
 * In-memory test provider for unit/integration testing.
 * Emails are injected via addEmail() and retrieved via fetchEmail() or searchEmails().
 * No external dependencies — works without IMAP or any network connection.
 */

import type { EmailProvider, EmailProviderConfig, EmailSearchCriteria } from '../provider.js';
import type { ParsedEmail } from '../types.js';

export class TestEmailProvider implements EmailProvider {
  readonly type = 'mailcatcher' as const;
  readonly name: string;

  private emails: ParsedEmail[] = [];
  private connected = false;

  constructor(providerConfig: EmailProviderConfig) {
    this.name = providerConfig.name;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Inject a test email into the in-memory store.
   * Used by test setup to simulate email delivery.
   */
  addEmail(email: ParsedEmail): void {
    this.emails.push(email);
  }

  /**
   * Clear all injected emails.
   */
  clearEmails(): void {
    this.emails = [];
  }

  /**
   * Get the count of stored emails.
   */
  getEmailCount(): number {
    return this.emails.length;
  }

  async fetchEmail(
    token: string,
    _folder?: string,
    sinceDate?: Date,
  ): Promise<ParsedEmail | null> {
    const since = sinceDate ?? new Date(0);

    for (const email of this.emails) {
      if (email.date < since) continue;
      const hasToken = email.to.some(addr => addr.includes(token));
      if (hasToken) return email;
    }

    return null;
  }

  async searchEmails(criteria: EmailSearchCriteria): Promise<ParsedEmail[]> {
    const since = criteria.sinceDate ?? new Date(0);
    const limit = criteria.limit ?? 50;

    return this.emails
      .filter(email => {
        if (email.date < since) return false;
        if (criteria.beforeDate && email.date > criteria.beforeDate) return false;
        if (criteria.to && !email.to.some(a => a.includes(criteria.to!))) return false;
        if (criteria.from && !email.from.includes(criteria.from)) return false;
        if (criteria.subject && !email.subject.includes(criteria.subject)) return false;
        if (criteria.bodyText) {
          const body = email.textBody ?? email.htmlBody ?? '';
          if (!body.includes(criteria.bodyText)) return false;
        }
        return true;
      })
      .slice(0, limit);
  }

  async healthCheck(): Promise<boolean> {
    return this.connected;
  }
}
