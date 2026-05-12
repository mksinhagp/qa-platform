/**
 * IMAP Email Provider — Phase 16.1
 *
 * Wraps the existing IMAP client (imap.ts) to implement the generic
 * EmailProvider interface. This is the primary production provider.
 */

import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import type { EmailProvider, EmailProviderConfig, EmailSearchCriteria } from '../provider.js';
import type { ParsedEmail } from '../types.js';

interface ImapProviderConfig {
  host: string;
  port: number;
  tls: boolean;
  user: string;
  password: string;
  connTimeout?: number;
  authTimeout?: number;
}

export class ImapEmailProvider implements EmailProvider {
  readonly type = 'imap' as const;
  readonly name: string;

  private config: ImapProviderConfig;
  private connection: Awaited<ReturnType<typeof imapSimple.connect>> | null = null;

  constructor(providerConfig: EmailProviderConfig) {
    this.name = providerConfig.name;
    const c = providerConfig.config as Record<string, unknown>;
    this.config = {
      host: (c.host as string) ?? 'localhost',
      port: (c.port as number) ?? 993,
      tls: (c.tls as boolean) ?? true,
      user: (c.user as string) ?? '',
      password: (c.password as string) ?? '',
      connTimeout: (c.connTimeout as number) ?? 10000,
      authTimeout: (c.authTimeout as number) ?? 5000,
    };
  }

  async connect(): Promise<void> {
    if (this.connection) return;
    this.connection = await imapSimple.connect({
      imap: {
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        user: this.config.user,
        password: this.config.password,
        connTimeout: this.config.connTimeout ?? 10000,
        authTimeout: this.config.authTimeout ?? 5000,
      },
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.end();
      this.connection = null;
    }
  }

  async fetchEmail(
    token: string,
    folder = 'INBOX',
    sinceDate?: Date,
  ): Promise<ParsedEmail | null> {
    const since = sinceDate ?? new Date(Date.now() - 10 * 60 * 1000);

    // Use one-shot connection pattern for isolation
    const conn = await imapSimple.connect({
      imap: {
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        user: this.config.user,
        password: this.config.password,
        connTimeout: this.config.connTimeout ?? 10000,
        authTimeout: this.config.authTimeout ?? 5000,
      },
    });

    try {
      await conn.openBox(folder);

      const searchCriteria = [
        ['SINCE', since.toDateString()],
        ['TEXT', token],
      ];

      const fetchOptions = {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE DELIVERED-TO)', 'TEXT', ''],
        markSeen: false,
        struct: true,
      };

      const messages = await conn.search(searchCriteria, fetchOptions);

      for (const msg of messages) {
        const fullBodyPart = msg.parts.find(p => p.which === '');
        if (!fullBodyPart) continue;

        const parsed = await simpleParser(fullBodyPart.body as string);

        const toField = parsed.to as { value: { address?: string }[] } | undefined;
        const toAddresses = toField?.value?.map(a => a.address ?? '') ?? [];
        const hasToken = toAddresses.some(addr => addr.includes(token));
        if (!hasToken) continue;

        const htmlBody = typeof parsed.html === 'string' ? parsed.html : null;
        const links = extractLinks(htmlBody);

        return {
          uid: String(msg.attributes.uid),
          subject: parsed.subject ?? '',
          from: parsed.from?.value?.[0]?.address ?? '',
          to: toAddresses,
          date: parsed.date ?? new Date(),
          textBody: parsed.text ?? null,
          htmlBody,
          links,
          attachments: (parsed.attachments ?? []).map(a => ({
            filename: a.filename ?? '',
            contentType: a.contentType,
            size: a.size ?? 0,
          })),
        };
      }

      return null;
    } finally {
      conn.end();
    }
  }

  async searchEmails(criteria: EmailSearchCriteria): Promise<ParsedEmail[]> {
    const folder = criteria.folder ?? 'INBOX';
    const since = criteria.sinceDate ?? new Date(Date.now() - 60 * 60 * 1000);

    const conn = await imapSimple.connect({
      imap: {
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        user: this.config.user,
        password: this.config.password,
        connTimeout: this.config.connTimeout ?? 10000,
        authTimeout: this.config.authTimeout ?? 5000,
      },
    });

    try {
      await conn.openBox(folder);

      const imapCriteria: unknown[][] = [['SINCE', since.toDateString()]];
      if (criteria.to) imapCriteria.push(['TO', criteria.to]);
      if (criteria.from) imapCriteria.push(['FROM', criteria.from]);
      if (criteria.subject) imapCriteria.push(['SUBJECT', criteria.subject]);
      if (criteria.bodyText) imapCriteria.push(['TEXT', criteria.bodyText]);

      const fetchOptions = {
        bodies: [''],
        markSeen: false,
        struct: true,
      };

      const messages = await conn.search(imapCriteria, fetchOptions);
      const results: ParsedEmail[] = [];
      const limit = criteria.limit ?? 50;

      for (const msg of messages) {
        if (results.length >= limit) break;

        const fullBodyPart = msg.parts.find(p => p.which === '');
        if (!fullBodyPart) continue;

        const parsed = await simpleParser(fullBodyPart.body as string);
        const toField = parsed.to as { value: { address?: string }[] } | undefined;
        const toAddresses = toField?.value?.map(a => a.address ?? '') ?? [];
        const htmlBody = typeof parsed.html === 'string' ? parsed.html : null;

        results.push({
          uid: String(msg.attributes.uid),
          subject: parsed.subject ?? '',
          from: parsed.from?.value?.[0]?.address ?? '',
          to: toAddresses,
          date: parsed.date ?? new Date(),
          textBody: parsed.text ?? null,
          htmlBody,
          links: extractLinks(htmlBody),
          attachments: (parsed.attachments ?? []).map(a => ({
            filename: a.filename ?? '',
            contentType: a.contentType,
            size: a.size ?? 0,
          })),
        });
      }

      return results;
    } finally {
      conn.end();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const conn = await imapSimple.connect({
        imap: {
          host: this.config.host,
          port: this.config.port,
          tls: this.config.tls,
          user: this.config.user,
          password: this.config.password,
          connTimeout: 5000,
          authTimeout: 3000,
        },
      });
      conn.end();
      return true;
    } catch {
      return false;
    }
  }
}

function extractLinks(html: string | null): string[] {
  if (!html) return [];
  const hrefs: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('http://') || href.startsWith('https://')) {
      hrefs.push(href);
    }
  }
  return [...new Set(hrefs)];
}
