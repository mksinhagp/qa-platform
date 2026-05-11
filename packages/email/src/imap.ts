/**
 * IMAP Client — thin wrapper around imap-simple for QA email polling.
 *
 * Design principles:
 * - One connection per check (open → search → fetch → close); no persistent connection.
 * - Correlation token search: looks for the token in the To/Delivered-To header
 *   so we can isolate test emails without dedicated inboxes.
 * - All plaintext passwords stay only in process memory; never logged.
 */

import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import type { ImapConfig, ParsedEmail } from './types.js';

/**
 * Open an IMAP connection, search for an email matching the correlation token
 * in the recipient address (e.g. user+token@example.com), and return the
 * parsed email if found. Returns null if no matching message exists.
 *
 * @param config     IMAP credentials and server config
 * @param token      Correlation token to search for in To/Delivered-To headers
 * @param folder     IMAP folder to search (default: INBOX)
 * @param sinceDate  Only messages after this date (default: 10 minutes ago)
 */
export async function fetchEmailByToken(
  config: ImapConfig,
  token: string,
  folder = 'INBOX',
  sinceDate?: Date,
): Promise<ParsedEmail | null> {
  const since = sinceDate ?? new Date(Date.now() - 10 * 60 * 1000);

  const connection = await imapSimple.connect({
    imap: {
      host: config.host,
      port: config.port,
      tls: config.tls,
      user: config.user,
      password: config.password,
      connTimeout: config.connTimeout ?? 10000,
      authTimeout: config.authTimeout ?? 5000,
    },
  });

  try {
    await connection.openBox(folder);

    // Search for messages received since the since date that contain our token
    // We use TEXT search as the broadest net; we'll filter precisely after fetch.
    const searchCriteria = [
      ['SINCE', since.toDateString()],
      ['TEXT', token],
    ];

    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE DELIVERED-TO)', 'TEXT', ''],
      markSeen: false,
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const msg of messages) {
      const fullBodyPart = msg.parts.find(p => p.which === '');
      if (!fullBodyPart) continue;

      const parsed = await simpleParser(fullBodyPart.body as string);

      // Check if the token appears in To or Delivered-To
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
    connection.end();
  }
}

/**
 * Extract all href links from an HTML string.
 */
function extractLinks(html: string | null): string[] {
  if (!html) return [];
  const hrefs: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    // Only include absolute URLs
    if (href.startsWith('http://') || href.startsWith('https://')) {
      hrefs.push(href);
    }
  }
  return [...new Set(hrefs)]; // deduplicate
}
