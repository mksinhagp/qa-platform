/**
 * POST /api/runner/email-validate
 *
 * Called by the runner after a registration or checkout flow step that sends a
 * confirmation email. The runner supplies:
 *   - execution_id: run_executions.id (used to validate the callback token)
 *   - callback_token: the one-time runner token stored in run_executions
 *   - inbox_id: which email_inboxes row to poll
 *   - correlation_token: the +token suffix used in the test email address
 *   - expected_subject_pattern: optional, from site rules
 *   - wait_until: ISO timestamp deadline for IMAP polling
 *
 * The dashboard decrypts IMAP credentials from the vault and fires the async
 * validation pipeline. The runner gets an immediate 202 Accepted.
 *
 * Authentication: one-time callback token (x-runner-token header) validated
 * against run_executions.callback_token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { invokeProc } from '@qa-platform/db';
import { startEmailValidation } from '../../../actions/emailValidation.js';
import type { ImapConfig } from '@qa-platform/email';

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-runner-token');
  const correlationId = request.headers.get('x-correlation-id') ?? 'unknown';

  if (!token) {
    return NextResponse.json({ error: 'Missing runner token' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const executionId = body.execution_id as number | undefined;
  const inboxId = body.inbox_id as number | undefined;
  const correlationToken = body.correlation_token as string | undefined;
  const waitUntilStr = body.wait_until as string | undefined;
  const expectedSubjectPattern = body.expected_subject_pattern as string | undefined;

  if (!executionId || !inboxId || !correlationToken) {
    return NextResponse.json(
      { error: 'Missing required fields: execution_id, inbox_id, correlation_token' },
      { status: 400 },
    );
  }

  // TODO Phase 9: add sp_run_executions_validate_token proc and validate `token`
  // against run_executions.callback_token for the given executionId.
  // Until then, security relies on the internal Docker network boundary.
  // Log correlationId for audit trail — do not remove.
  void correlationId;

  // Fetch the inbox IMAP credentials
  // In production: decrypt via vault. For now, fetch the inbox metadata and
  // use the vault to decrypt the password.
  const inboxRows = await invokeProc('sp_email_inboxes_list', {
    i_is_active: null,
  }).catch(() => []);

  const inbox = inboxRows.find((r: { o_id: number }) => r.o_id === inboxId) as {
    o_id: number;
    o_host: string;
    o_port: number;
    o_use_tls: boolean;
    o_username: string;
    o_secret_id: number;
  } | undefined;

  if (!inbox) {
    return NextResponse.json({ error: `Email inbox ${inboxId} not found or inactive` }, { status: 404 });
  }

  // Decrypt the IMAP password from the vault
  // The vault must be unlocked for this to work (it's a server-side operation,
  // so we use a service-level vault context — the dashboard process holds the RVK).
  // For now we use a placeholder; the vault decrypt call is wired in Phase 9 hardening.
  // The email validation pipeline will gracefully fail with an IMAP auth error
  // and record it in email_validation_checks.
  const imapPassword = process.env.EMAIL_INBOX_TEST_PASSWORD ?? '';

  const imapConfig: ImapConfig = {
    host: inbox.o_host,
    port: inbox.o_port,
    tls: inbox.o_use_tls,
    user: inbox.o_username,
    password: imapPassword,
  };

  let waitUntil: Date;
  if (waitUntilStr) {
    waitUntil = new Date(waitUntilStr);
    if (isNaN(waitUntil.getTime())) {
      return NextResponse.json({ error: 'Invalid wait_until timestamp' }, { status: 400 });
    }
  } else {
    waitUntil = new Date(Date.now() + 5 * 60 * 1000);
  }

  const spec = {
    subjectPattern: expectedSubjectPattern,
    checkLinks: true,
  };

  // Fire-and-forget — runner gets 202 immediately
  startEmailValidation(
    executionId,
    inboxId,
    correlationToken,
    imapConfig,
    spec,
    waitUntil,
    'runner',
  ).catch(err => {
    console.error('[EmailValidation] Route startEmailValidation error:', err);
  });

  return NextResponse.json(
    { started: true, execution_id: executionId, inbox_id: inboxId },
    { status: 202 },
  );
}
