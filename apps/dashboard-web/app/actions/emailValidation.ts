'use server';

/**
 * Email Validation Server Actions — Phase 5
 *
 * These actions are called:
 *  - By the /api/runner/email-validate route when the runner signals that an
 *    email-sending flow step has completed and validation should begin.
 *  - By the dashboard UI to fetch email validation results for a run execution.
 *
 * All IMAP credentials are decrypted server-side via the vault brokered access.
 * Plaintext passwords never leave this process.
 */

import { invokeProc, invokeProcWrite } from '@qa-platform/db';
import { requireCapability } from '@qa-platform/auth';
import { validateEmail } from '@qa-platform/email';
import type { ImapConfig, EmailAssertionSpec } from '@qa-platform/email';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailValidationRunRecord {
  id: number;
  run_execution_id: number;
  inbox_id: number;
  inbox_name: string;
  correlation_token: string;
  expected_subject_pattern: string | null;
  expected_from_pattern: string | null;
  status: string;
  wait_until: string;
  received_at: string | null;
  delivery_latency_ms: number | null;
  poll_count: number;
  error_message: string | null;
  created_date: string;
  updated_date: string;
}

export interface EmailValidationCheckRecord {
  id: number;
  email_validation_run_id: number;
  check_type: string;
  status: string;
  detail: string | null;
  url_tested: string | null;
  diff_percent: string | null;
  http_status: number | null;
  artifact_path: string | null;
  created_date: string;
}

// ─── Trigger email validation ─────────────────────────────────────────────────

/**
 * Called by the runner callback API after a registration or checkout step
 * completes and email confirmation is expected.
 *
 * Creates an email_validation_runs record, then asynchronously runs the
 * full IMAP validation pipeline and writes check results back to the DB.
 *
 * @param runExecutionId  The run_executions.id that triggered the email
 * @param inboxId         The email_inboxes.id to poll
 * @param correlationToken The token embedded in the test email address
 * @param imapConfig      Decrypted IMAP credentials (from vault broker — plaintext)
 * @param spec            Assertion spec derived from site rules
 * @param waitUntil       Deadline for IMAP polling
 * @param createdBy       Operator login or 'system'
 */
export async function startEmailValidation(
  runExecutionId: number,
  inboxId: number,
  correlationToken: string,
  imapConfig: ImapConfig,
  spec: EmailAssertionSpec,
  waitUntil: Date,
  createdBy: string,
): Promise<{ success: boolean; validationRunId?: number; error?: string }> {
  try {
    // Create the validation run record
    const insertResult = await invokeProcWrite('sp_email_validation_runs_insert', {
      i_run_execution_id: runExecutionId,
      i_inbox_id: inboxId,
      i_correlation_token: correlationToken,
      i_expected_subject_pattern: spec.subjectPattern ?? null,
      i_expected_from_pattern: spec.fromPattern ?? null,
      i_wait_until: waitUntil.toISOString(),
      i_created_by: createdBy,
    });

    const validationRunId: number = insertResult[0]?.o_id;
    if (!validationRunId) throw new Error('Failed to create email_validation_runs record');

    // Run the validation pipeline asynchronously (fire-and-forget from the caller's perspective).
    // Results are written back via the DB stored procedures.
    const startedAt = new Date();
    const timeoutMs = Math.max(0, waitUntil.getTime() - Date.now());

    runValidationPipeline(
      validationRunId,
      imapConfig,
      correlationToken,
      startedAt,
      spec,
      { timeoutMs },
      createdBy,
    ).catch(err => {
      console.error(`[EmailValidation] Pipeline error for run ${validationRunId}:`, err);
    });

    return { success: true, validationRunId };
  } catch (error) {
    console.error('[EmailValidation] startEmailValidation error:', error);
    return { success: false, error: 'Failed to start email validation' };
  }
}

/**
 * Internal: executes the full validation pipeline and writes results to the DB.
 * Not exported — called via fire-and-forget from startEmailValidation.
 */
async function runValidationPipeline(
  validationRunId: number,
  imapConfig: ImapConfig,
  correlationToken: string,
  startedAt: Date,
  spec: EmailAssertionSpec,
  deliveryOpts: { timeoutMs: number },
  createdBy: string,
): Promise<void> {
  try {
    const result = await validateEmail(imapConfig, correlationToken, startedAt, spec, deliveryOpts);

    // Determine final status
    let finalStatus: string;
    if (!result.deliveryResult.delivered) {
      finalStatus = result.deliveryResult.error?.includes('not received')
        ? 'timed_out'
        : result.deliveryResult.error
          ? 'error'
          : 'not_found';
    } else {
      finalStatus = result.passed ? 'delivered' : 'checks_failed';
    }

    // Update the validation run record
    await invokeProcWrite('sp_email_validation_runs_update', {
      i_id: validationRunId,
      i_status: finalStatus,
      i_received_at: result.deliveryResult.email?.date?.toISOString() ?? null,
      i_delivery_latency_ms: result.deliveryResult.latencyMs ?? null,
      i_poll_count: result.deliveryResult.pollCount,
      i_error_message: result.deliveryResult.error ?? null,
      i_updated_by: createdBy,
    });

    // Write individual check results
    for (const check of result.checks) {
      await invokeProcWrite('sp_email_validation_checks_insert', {
        i_email_validation_run_id: validationRunId,
        i_check_type: check.check_type,
        i_status: check.status,
        i_detail: check.detail ?? null,
        i_url_tested: check.url_tested ?? null,
        i_diff_percent: check.diff_percent ?? null,
        i_http_status: check.http_status ?? null,
        i_artifact_path: check.artifact_path ?? null,
        i_created_by: createdBy,
      });
    }
  } catch (err) {
    // Mark the validation run as errored so the dashboard shows a clear failure
    const message = err instanceof Error ? err.message : String(err);
    await invokeProcWrite('sp_email_validation_runs_update', {
      i_id: validationRunId,
      i_status: 'error',
      i_received_at: null,
      i_delivery_latency_ms: null,
      i_poll_count: null,
      i_error_message: `Pipeline error: ${message}`,
      i_updated_by: createdBy,
    }).catch(() => { /* best effort */ });
  }
}

// ─── Read actions (for dashboard UI) ──────────────────────────────────────────

/**
 * Fetch all email validation runs for a given run execution.
 * Requires run.read capability.
 */
export async function listEmailValidationRuns(
  runExecutionId: number,
): Promise<{ success: boolean; runs?: EmailValidationRunRecord[]; error?: string }> {
  try {
    await requireCapability('run.read');
    const result = await invokeProc('sp_email_validation_runs_get_by_execution', {
      i_run_execution_id: runExecutionId,
    });
    const runs: EmailValidationRunRecord[] = result.map((row: {
      o_id: number; o_run_execution_id: number; o_inbox_id: number; o_inbox_name: string;
      o_correlation_token: string; o_expected_subject_pattern: string | null;
      o_expected_from_pattern: string | null; o_status: string; o_wait_until: string;
      o_received_at: string | null; o_delivery_latency_ms: number | null;
      o_poll_count: number; o_error_message: string | null;
      o_created_date: string; o_updated_date: string;
    }) => ({
      id: row.o_id,
      run_execution_id: row.o_run_execution_id,
      inbox_id: row.o_inbox_id,
      inbox_name: row.o_inbox_name,
      correlation_token: row.o_correlation_token,
      expected_subject_pattern: row.o_expected_subject_pattern,
      expected_from_pattern: row.o_expected_from_pattern,
      status: row.o_status,
      wait_until: row.o_wait_until,
      received_at: row.o_received_at,
      delivery_latency_ms: row.o_delivery_latency_ms,
      poll_count: row.o_poll_count,
      error_message: row.o_error_message,
      created_date: row.o_created_date,
      updated_date: row.o_updated_date,
    }));
    return { success: true, runs };
  } catch (error) {
    console.error('List email validation runs error:', error);
    return { success: false, error: 'Failed to load email validation runs' };
  }
}

/**
 * Fetch all check results for a specific email validation run.
 * Requires run.read capability.
 */
export async function listEmailValidationChecks(
  emailValidationRunId: number,
): Promise<{ success: boolean; checks?: EmailValidationCheckRecord[]; error?: string }> {
  try {
    await requireCapability('run.read');
    const result = await invokeProc('sp_email_validation_checks_list', {
      i_email_validation_run_id: emailValidationRunId,
    });
    const checks: EmailValidationCheckRecord[] = result.map((row: {
      o_id: number; o_email_validation_run_id: number; o_check_type: string;
      o_status: string; o_detail: string | null; o_url_tested: string | null;
      o_diff_percent: string | null; o_http_status: number | null;
      o_artifact_path: string | null; o_created_date: string;
    }) => ({
      id: row.o_id,
      email_validation_run_id: row.o_email_validation_run_id,
      check_type: row.o_check_type,
      status: row.o_status,
      detail: row.o_detail,
      url_tested: row.o_url_tested,
      diff_percent: row.o_diff_percent,
      http_status: row.o_http_status,
      artifact_path: row.o_artifact_path,
      created_date: row.o_created_date,
    }));
    return { success: true, checks };
  } catch (error) {
    console.error('List email validation checks error:', error);
    return { success: false, error: 'Failed to load email validation checks' };
  }
}

/**
 * List all active email inboxes (for configuration UI and selection).
 * Requires operator.manage capability.
 */
export async function listEmailInboxes(): Promise<{
  success: boolean;
  inboxes?: Array<{
    id: number;
    name: string;
    provider: string;
    host: string;
    port: number;
    username: string;
    is_active: boolean;
  }>;
  error?: string;
}> {
  try {
    await requireCapability('operator.manage');
    const result = await invokeProc('sp_email_inboxes_list', { i_is_active: true });
    const inboxes = result.map((row: {
      o_id: number; o_name: string; o_provider: string; o_host: string;
      o_port: number; o_username: string; o_is_active: boolean;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      provider: row.o_provider,
      host: row.o_host,
      port: row.o_port,
      username: row.o_username,
      is_active: row.o_is_active,
    }));
    return { success: true, inboxes };
  } catch (error) {
    console.error('List email inboxes error:', error);
    return { success: false, error: 'Failed to load email inboxes' };
  }
}

/**
 * List all active payment profiles (for run wizard payment selection).
 * Requires run.execute capability.
 */
export async function listPaymentProfiles(): Promise<{
  success: boolean;
  profiles?: Array<{
    id: number;
    name: string;
    payment_type: string;
    last_4: string | null;
    card_brand: string | null;
    expiry_month: number | null;
    expiry_year: number | null;
  }>;
  error?: string;
}> {
  try {
    await requireCapability('run.execute');
    const result = await invokeProc('sp_payment_profiles_list', { i_is_active: true });
    const profiles = result.map((row: {
      o_id: number; o_name: string; o_payment_type: string; o_last_4: string | null;
      o_card_brand: string | null; o_expiry_month: number | null; o_expiry_year: number | null;
    }) => ({
      id: row.o_id,
      name: row.o_name,
      payment_type: row.o_payment_type,
      last_4: row.o_last_4,
      card_brand: row.o_card_brand,
      expiry_month: row.o_expiry_month,
      expiry_year: row.o_expiry_year,
    }));
    return { success: true, profiles };
  } catch (error) {
    console.error('List payment profiles error:', error);
    return { success: false, error: 'Failed to load payment profiles' };
  }
}
