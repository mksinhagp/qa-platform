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
import { cookies } from 'next/headers';
import { invokeProc, initializePool } from '@qa-platform/db';
import { loadEnv } from '@qa-platform/config';
import { decryptSecret } from '@qa-platform/vault';
import { startEmailValidation } from '../../../actions/emailValidation';

// Initialize the PostgreSQL pool for this route handler module.
try {
  loadEnv();
  initializePool();
} catch {
  // Pool may already be initialized; safe to ignore.
}
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

  const tokenRows = await invokeProc('sp_run_executions_validate_token', {
    i_id: executionId,
    i_callback_token: token,
  }).catch(err => {
    console.error('[EmailValidation] Token validation error:', err);
    return [];
  });

  if (tokenRows[0]?.o_is_valid !== true) {
    return NextResponse.json({ error: 'Invalid runner token' }, { status: 401 });
  }

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

  const cookieStore = await cookies();
  const unlockToken = cookieStore.get('unlock_token')?.value ?? null;

  if (!unlockToken) {
    return NextResponse.json({ error: 'Vault is locked. Please unlock before email validation.' }, { status: 503 });
  }

  const secretRows = await invokeProc('sp_secret_records_get_by_id', {
    i_id: inbox.o_secret_id,
  });

  const secret = secretRows[0] as {
    o_encrypted_payload: Buffer;
    o_nonce: Buffer;
    o_wrapped_dek: Buffer;
    o_wrap_nonce: Buffer | null;
  } | undefined;

  if (!secret) {
    return NextResponse.json({ error: `Secret ${inbox.o_secret_id} not found` }, { status: 404 });
  }

  if (!secret.o_wrap_nonce) {
    return NextResponse.json({ error: 'Secret record is missing wrap_nonce' }, { status: 500 });
  }

  const plaintext = await decryptSecret(
    unlockToken,
    secret.o_encrypted_payload,
    secret.o_nonce,
    secret.o_wrapped_dek,
    secret.o_wrap_nonce,
  );
  const imapPassword = plaintext.toString('utf8');

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
    console.error(`[EmailValidation] Route startEmailValidation error (${correlationId}):`, err);
  });

  return NextResponse.json(
    { started: true, execution_id: executionId, inbox_id: inboxId },
    { status: 202 },
  );
}
