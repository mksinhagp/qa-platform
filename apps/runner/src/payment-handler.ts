/**
 * Payment Handler — Phase 17 runner integration for Playwright payment automation.
 *
 * Responsibilities:
 *  - Resolve payment provider binding for a site/environment via SP
 *  - Fetch payment scenario details (test card, expected result) via SP
 *  - Build ExecutionContext.paymentProfile from scenario data
 *  - Execute provider operations (authorize/capture/void/refund) post-flow
 *  - Run multi-source verification (UI, email, provider API)
 *  - Record payment transactions via dashboard callback
 *
 * Design: all DB calls use @qa-platform/db stored procedures; all sensitive
 * card data is redacted before logging or callback payloads.
 */

import { invokeProc } from '@qa-platform/db';
import {
  type PaymentProviderConfig,
  type PaymentScenario,
  type AuthorizeRequest,
  type AuthorizeResponse,
  type ScenarioType,
  paymentProviderRegistry,
  AuthorizeNetProvider,
  PaymentVerifier,
  type PaymentProvider,
  type PaymentVerificationResult,
} from '@qa-platform/payment';
import type { ExecutionContext } from '@qa-platform/playwright-core';
import { Logger } from '@qa-platform/shared-types';
import type { ExecutionRequest } from './execution-manager.js';

const logger = new Logger('payment-handler');

// ─── Types ───────────────────────────────────────────────────────────────────

/** Resolved payment context built from DB lookups — passed into runExecution */
export interface PaymentContext {
  provider: PaymentProviderConfig;
  scenario: PaymentScenario;
  /** Initialized provider instance ready for operations */
  providerInstance: PaymentProvider;
}

/** Result of a single payment provider operation (one row per DB record) */
export interface PaymentOperationResult {
  transactionType: string;
  amount: number;
  currency: string;
  providerTransactionId?: string;
  providerResponseCode?: string;
  providerResponseReason?: string;
  providerResponseText?: string;
  status: 'approved' | 'declined' | 'error' | 'voided' | 'refunded';
  verification?: PaymentVerificationResult;
  redactedCardNumber?: string;
  redactedCvv?: string;
  errorMessage?: string;
}

/** Max length for UI confirmation text stored in DB to avoid bloating rows */
const UI_CONFIRMATION_MAX_LENGTH = 2000;

// ─── Provider registry bootstrap ─────────────────────────────────────────────

// Register known providers at module load time
if (!paymentProviderRegistry.has('authorize_net')) {
  paymentProviderRegistry.register('authorize_net', AuthorizeNetProvider);
}

// ─── DB resolution helpers ───────────────────────────────────────────────────

/** Row shape returned by sp_payment_provider_bindings_resolve */
interface ProviderBindingRow {
  o_payment_provider_id: number;
  o_payment_provider_name: string;
  o_payment_provider_type: string;
  o_is_sandbox: boolean;
  o_merchant_id: string | null;
}

/** Row shape returned by sp_payment_scenarios_get_by_id */
interface ScenarioRow {
  o_id: number;
  o_name: string;
  o_scenario_type: string;
  o_expected_result: string;
  o_description: string | null;
  o_test_card_number: string | null;
  o_test_cvv: string | null;
  o_test_expiry_month: number | null;
  o_test_expiry_year: number | null;
  o_test_amount: number;
  o_avs_zip_code: string | null;
  o_avs_address: string | null;
  o_expected_response_code: string | null;
  o_expected_response_reason: string | null;
  o_is_active: boolean;
}

/**
 * Resolve the payment provider bound to a site/environment.
 * Returns null when no active binding exists (non-payment site).
 */
export async function resolvePaymentProvider(
  siteId: number,
  siteEnvironmentId: number,
  correlationId: string,
): Promise<PaymentProviderConfig | null> {
  try {
    const rows = await invokeProc('sp_payment_provider_bindings_resolve', {
      i_site_id: siteId,
      i_site_environment_id: siteEnvironmentId,
    }) as ProviderBindingRow[];

    if (!rows || rows.length === 0) {
      logger.info(
        `No payment provider binding for site=${siteId} env=${siteEnvironmentId}`,
        undefined,
        correlationId,
      );
      return null;
    }

    const row = rows[0];
    return {
      id: row.o_payment_provider_id,
      name: row.o_payment_provider_name,
      providerType: row.o_payment_provider_type as PaymentProviderConfig['providerType'],
      isSandbox: row.o_is_sandbox,
      merchantId: row.o_merchant_id ?? undefined,
    };
  } catch (err) {
    logger.warn(
      `Failed to resolve payment provider for site=${siteId} env=${siteEnvironmentId}: ${String(err)}`,
      undefined,
      correlationId,
    );
    return null;
  }
}

/**
 * Fetch payment scenario details by ID.
 * Returns null when the scenario does not exist or is inactive.
 */
export async function resolvePaymentScenario(
  scenarioId: number,
  correlationId: string,
): Promise<PaymentScenario | null> {
  try {
    const rows = await invokeProc('sp_payment_scenarios_get_by_id', {
      i_id: scenarioId,
    }) as ScenarioRow[];

    if (!rows || rows.length === 0 || !rows[0].o_is_active) {
      logger.warn(
        `Payment scenario ${scenarioId} not found or inactive`,
        undefined,
        correlationId,
      );
      return null;
    }

    const row = rows[0];
    return {
      id: row.o_id,
      name: row.o_name,
      scenarioType: row.o_scenario_type as ScenarioType,
      expectedResult: row.o_expected_result,
      testCardNumber: row.o_test_card_number ?? undefined,
      testCvv: row.o_test_cvv ?? undefined,
      testExpiryMonth: row.o_test_expiry_month ?? undefined,
      testExpiryYear: row.o_test_expiry_year ?? undefined,
      testAmount: Number(row.o_test_amount) || 1.00,
      avsZipCode: row.o_avs_zip_code ?? undefined,
      avsAddress: row.o_avs_address ?? undefined,
      expectedResponseCode: row.o_expected_response_code ?? undefined,
      expectedResponseReason: row.o_expected_response_reason ?? undefined,
    };
  } catch (err) {
    logger.warn(
      `Failed to fetch payment scenario ${scenarioId}: ${String(err)}`,
      undefined,
      correlationId,
    );
    return null;
  }
}

// ─── Provider instantiation ──────────────────────────────────────────────────

/**
 * Create and initialize a payment provider instance.
 * In sandbox mode, credentials are optional (simulated).
 * In production mode, credentials would be fetched from vault.
 */
export async function createProviderInstance(
  config: PaymentProviderConfig,
  correlationId: string,
): Promise<PaymentProvider | null> {
  const ProviderClass = paymentProviderRegistry.get(config.providerType);
  if (!ProviderClass) {
    logger.warn(
      `No provider implementation for type "${config.providerType}"`,
      undefined,
      correlationId,
    );
    return null;
  }

  try {
    const instance = new ProviderClass(config);

    // In sandbox mode, use placeholder credentials.
    // In production mode, credentials must come from vault — until vault
    // integration is implemented, refuse to initialize to avoid calling
    // real provider APIs with empty/undefined credentials.
    if (!config.isSandbox) {
      // TODO: Production mode — decrypt credentials from vault using secret IDs
      //   config.apiLoginIdSecretId, config.apiTransactionKeySecretId, etc.
      logger.warn(
        `Payment provider "${config.name}" is in production mode but vault credential decryption is not yet implemented — refusing to initialize`,
        undefined,
        correlationId,
      );
      return null;
    }

    const credentials: Record<string, string> = {
      apiLoginId: 'sandbox-login',
      apiTransactionKey: 'sandbox-key',
    };

    await instance.initialize(credentials);

    const healthy = await instance.healthCheck();
    if (!healthy) {
      logger.warn(
        `Payment provider "${config.name}" health check failed`,
        undefined,
        correlationId,
      );
      return null;
    }

    logger.info(
      `Payment provider "${config.name}" (${config.providerType}, sandbox=${config.isSandbox}) initialized`,
      undefined,
      correlationId,
    );
    return instance;
  } catch (err) {
    logger.warn(
      `Failed to initialize payment provider "${config.name}": ${String(err)}`,
      undefined,
      correlationId,
    );
    return null;
  }
}

// ─── Payment context resolution ──────────────────────────────────────────────

/**
 * Full payment context resolution: fetches provider + scenario + creates instance.
 * Returns null if any piece is missing (graceful degradation for non-payment runs).
 */
export async function resolvePaymentContext(
  ex: ExecutionRequest,
  correlationId: string,
): Promise<PaymentContext | null> {
  if (!ex.payment_scenario_id || !ex.numeric_site_id || !ex.numeric_site_environment_id) {
    return null;
  }

  const provider = await resolvePaymentProvider(
    ex.numeric_site_id,
    ex.numeric_site_environment_id,
    correlationId,
  );
  if (!provider) return null;

  const scenario = await resolvePaymentScenario(ex.payment_scenario_id, correlationId);
  if (!scenario) return null;

  const providerInstance = await createProviderInstance(provider, correlationId);
  if (!providerInstance) return null;

  return { provider, scenario, providerInstance };
}

// ─── Build ExecutionContext fields from payment context ───────────────────────

/**
 * Enrich an ExecutionContext with payment profile and scenario metadata
 * so checkout flows can fill payment forms with the right card data and
 * adjust assertions based on expected result.
 */
export function enrichExecutionContext(
  ctx: ExecutionContext,
  paymentCtx: PaymentContext,
): ExecutionContext {
  const { scenario, provider } = paymentCtx;

  // Build expiry string from month/year
  const expiryMonth = scenario.testExpiryMonth ?? 12;
  const expiryYear = scenario.testExpiryYear ?? new Date().getFullYear() + 3;
  const expiry = `${String(expiryMonth).padStart(2, '0')}/${String(expiryYear).slice(-2)}`;

  return {
    ...ctx,
    paymentProfile: {
      number: scenario.testCardNumber ?? '4111111111111111',
      expiry,
      cvv: scenario.testCvv ?? '123',
      zip: scenario.avsZipCode ?? '90210',
      name: 'QA Tester',
    },
    paymentScenario: {
      id: scenario.id,
      scenarioType: scenario.scenarioType,
      expectedResult: scenario.expectedResult,
      testAmount: scenario.testAmount,
      expectedResponseCode: scenario.expectedResponseCode,
      expectedResponseReason: scenario.expectedResponseReason,
    },
    paymentProvider: {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      isSandbox: provider.isSandbox,
    },
  };
}

// ─── Post-flow payment operations ────────────────────────────────────────────

/**
 * Execute the payment provider operations (authorize, then optionally capture/void/refund)
 * based on the scenario type. Runs after the browser flow has submitted the payment form.
 *
 * Returns an array of per-operation results so each operation (authorize, capture, etc.)
 * gets its own DB record — the authorize step's data is never overwritten by follow-ups.
 *
 * Scenario type mapping:
 *   success      → authorize + capture
 *   decline      → authorize (expected to fail)
 *   avs_failure  → authorize (expected to fail with specific AVS code)
 *   cvv_failure  → authorize (expected to fail with specific CVV code)
 *   duplicate    → authorize + authorize (second expected to fail as duplicate)
 *   void         → authorize + void
 *   refund       → authorize + capture + refund
 */
export async function executePaymentOperation(
  paymentCtx: PaymentContext,
  uiConfirmationText: string | undefined,
  emailReceiptContent: string | undefined,
  correlationId: string,
): Promise<PaymentOperationResult[]> {
  const { providerInstance, scenario } = paymentCtx;
  const card = scenario.testCardNumber ?? '4111111111111111';
  const cvv = scenario.testCvv ?? '123';
  const expiryMonth = scenario.testExpiryMonth ?? 12;
  const expiryYear = scenario.testExpiryYear ?? new Date().getFullYear() + 3;
  const redactedCard = PaymentVerifier.redactCardNumber(card);
  const redactedCvv = PaymentVerifier.redactCvv(cvv);

  const authRequest: AuthorizeRequest = {
    amount: scenario.testAmount,
    currency: 'USD',
    cardNumber: card,
    cvv,
    expiryMonth,
    expiryYear,
    zip: scenario.avsZipCode,
    address: scenario.avsAddress,
    firstName: 'QA',
    lastName: 'Tester',
  };

  const results: PaymentOperationResult[] = [];

  logger.info(
    `Executing payment operation: scenario="${scenario.name}" type="${scenario.scenarioType}" card=****${card.slice(-4)} amount=${scenario.testAmount}`,
    undefined,
    correlationId,
  );

  // ── Step 1: Authorize ─────────────────────────────────────────────────────
  let authResponse: AuthorizeResponse;
  try {
    authResponse = await providerInstance.authorize(authRequest);
  } catch (err) {
    results.push({
      transactionType: 'authorize',
      amount: scenario.testAmount,
      currency: 'USD',
      status: 'error',
      redactedCardNumber: redactedCard,
      redactedCvv: redactedCvv,
      errorMessage: `Authorization failed: ${String(err)}`,
    });
    return results;
  }

  // Build authorize result
  const authResult: PaymentOperationResult = {
    transactionType: 'authorize',
    amount: scenario.testAmount,
    currency: 'USD',
    providerTransactionId: authResponse.transactionId,
    providerResponseCode: authResponse.responseCode,
    providerResponseReason: authResponse.responseReason,
    providerResponseText: authResponse.responseText,
    status: authResponse.success ? 'approved' : 'declined',
    redactedCardNumber: redactedCard,
    redactedCvv: redactedCvv,
  };

  // Run multi-source verification against the authorize response
  try {
    const verificationResult = await PaymentVerifier.verify({
      uiConfirmation: uiConfirmationText,
      emailReceiptContent,
      providerResponse: authResponse,
    });
    authResult.verification = verificationResult;
  } catch (err) {
    logger.warn(
      `Payment verification failed: ${String(err)}`,
      undefined,
      correlationId,
    );
  }

  results.push(authResult);

  // ── Follow-up operations based on scenario type ───────────────────────────
  const scenarioType = scenario.scenarioType as ScenarioType;

  // success → capture after successful auth
  if (scenarioType === 'success' && authResponse.success && authResponse.transactionId) {
    try {
      const captureResp = await providerInstance.capture({
        transactionId: authResponse.transactionId,
        amount: scenario.testAmount,
      });
      results.push({
        transactionType: 'capture',
        amount: scenario.testAmount,
        currency: 'USD',
        providerTransactionId: captureResp.transactionId,
        providerResponseCode: captureResp.responseCode,
        providerResponseReason: captureResp.responseReason,
        status: captureResp.success ? 'approved' : 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: captureResp.success ? undefined : `Capture failed: ${captureResp.responseReason ?? captureResp.errorText}`,
      });
    } catch (err) {
      results.push({
        transactionType: 'capture',
        amount: scenario.testAmount,
        currency: 'USD',
        status: 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: `Capture failed: ${String(err)}`,
      });
    }
  }

  // void → void after successful auth
  if (scenarioType === 'void' && authResponse.success && authResponse.transactionId) {
    try {
      const voidResp = await providerInstance.void({
        transactionId: authResponse.transactionId,
      });
      results.push({
        transactionType: 'void',
        amount: scenario.testAmount,
        currency: 'USD',
        providerTransactionId: voidResp.transactionId,
        providerResponseCode: voidResp.responseCode,
        providerResponseReason: voidResp.responseReason,
        status: voidResp.success ? 'voided' : 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: voidResp.success ? undefined : `Void failed: ${voidResp.responseReason ?? voidResp.errorText}`,
      });
    } catch (err) {
      results.push({
        transactionType: 'void',
        amount: scenario.testAmount,
        currency: 'USD',
        status: 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: `Void failed: ${String(err)}`,
      });
    }
  }

  // refund → capture, then refund (only if capture succeeds)
  if (scenarioType === 'refund' && authResponse.success && authResponse.transactionId) {
    let captureSucceeded = false;
    // Capture step
    try {
      const captureResp = await providerInstance.capture({
        transactionId: authResponse.transactionId,
        amount: scenario.testAmount,
      });
      captureSucceeded = captureResp.success;
      results.push({
        transactionType: 'capture',
        amount: scenario.testAmount,
        currency: 'USD',
        providerTransactionId: captureResp.transactionId,
        providerResponseCode: captureResp.responseCode,
        providerResponseReason: captureResp.responseReason,
        status: captureResp.success ? 'approved' : 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: captureResp.success ? undefined : `Capture failed: ${captureResp.responseReason ?? captureResp.errorText}`,
      });
    } catch (err) {
      results.push({
        transactionType: 'capture',
        amount: scenario.testAmount,
        currency: 'USD',
        status: 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: `Capture failed: ${String(err)}`,
      });
    }

    // Refund step — only if capture succeeded
    if (captureSucceeded) {
      try {
        const refundResp = await providerInstance.refund({
          transactionId: authResponse.transactionId,
          amount: scenario.testAmount,
          cardNumber: card.slice(-4),
        });
        results.push({
          transactionType: 'refund',
          amount: scenario.testAmount,
          currency: 'USD',
          providerTransactionId: refundResp.transactionId,
          providerResponseCode: refundResp.responseCode,
          providerResponseReason: refundResp.responseReason,
          status: refundResp.success ? 'refunded' : 'error',
          redactedCardNumber: redactedCard,
          redactedCvv: redactedCvv,
          errorMessage: refundResp.success ? undefined : `Refund failed: ${refundResp.responseReason ?? refundResp.errorText}`,
        });
      } catch (err) {
        results.push({
          transactionType: 'refund',
          amount: scenario.testAmount,
          currency: 'USD',
          status: 'error',
          redactedCardNumber: redactedCard,
          redactedCvv: redactedCvv,
          errorMessage: `Refund failed: ${String(err)}`,
        });
      }
    } else {
      logger.warn(
        `Skipping refund — capture failed for scenario "${scenario.name}"`,
        undefined,
        correlationId,
      );
    }
  }

  // duplicate → second authorize (expected to fail as duplicate)
  if (scenarioType === 'duplicate' && authResponse.success) {
    try {
      const dupResponse = await providerInstance.authorize(authRequest);
      results.push({
        transactionType: 'authorize',
        amount: scenario.testAmount,
        currency: 'USD',
        providerTransactionId: dupResponse.transactionId,
        providerResponseCode: dupResponse.responseCode,
        providerResponseReason: dupResponse.responseReason,
        providerResponseText: dupResponse.responseText,
        // The second authorize is expected to be declined as a duplicate
        status: dupResponse.success ? 'approved' : 'declined',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: dupResponse.success
          ? 'Duplicate authorize unexpectedly succeeded'
          : undefined,
      });
    } catch (err) {
      results.push({
        transactionType: 'authorize',
        amount: scenario.testAmount,
        currency: 'USD',
        status: 'error',
        redactedCardNumber: redactedCard,
        redactedCvv: redactedCvv,
        errorMessage: `Duplicate authorize failed: ${String(err)}`,
      });
    }
  }

  // decline / avs_failure / cvv_failure — authorize only (no follow-ups).
  // Validate that the response codes match what the scenario expects.
  if (
    (scenarioType === 'decline' || scenarioType === 'avs_failure' || scenarioType === 'cvv_failure') &&
    scenario.expectedResponseCode &&
    authResponse.responseCode !== scenario.expectedResponseCode
  ) {
    authResult.errorMessage = `Expected response code "${scenario.expectedResponseCode}" but got "${authResponse.responseCode ?? 'none'}"`;
  }

  for (const r of results) {
    logger.info(
      `Payment operation: type="${r.transactionType}" status="${r.status}" txn="${r.providerTransactionId ?? 'none'}"`,
      undefined,
      correlationId,
    );
  }

  return results;
}

// ─── Transaction recording via callback ──────────────────────────────────────

/**
 * Build a payment_transaction_result callback payload for a single operation.
 * The caller iterates the results array and calls this once per operation
 * so each operation gets its own DB record.
 *
 * @param idempotencyKey  Client-generated key for dedup on retried callbacks
 */
export function buildPaymentTransactionPayload(
  ex: ExecutionRequest,
  paymentCtx: PaymentContext,
  opResult: PaymentOperationResult,
  idempotencyKey: string,
): Record<string, unknown> {
  // Truncate UI confirmation to avoid storing huge page dumps
  const rawUiConfirmation = opResult.verification?.uiConfirmationDetails ?? null;
  const uiConfirmation = rawUiConfirmation && rawUiConfirmation.length > UI_CONFIRMATION_MAX_LENGTH
    ? rawUiConfirmation.slice(0, UI_CONFIRMATION_MAX_LENGTH) + '...[truncated]'
    : rawUiConfirmation;

  return {
    type: 'payment_transaction_result',
    execution_id: ex.execution_id,
    idempotency_key: idempotencyKey,
    site_id: ex.numeric_site_id,
    site_environment_id: ex.numeric_site_environment_id,
    payment_provider_id: paymentCtx.provider.id,
    payment_scenario_id: paymentCtx.scenario.id,
    transaction_type: opResult.transactionType,
    amount: opResult.amount,
    currency: opResult.currency,
    provider_transaction_id: opResult.providerTransactionId ?? null,
    provider_response_code: opResult.providerResponseCode ?? null,
    provider_response_reason: opResult.providerResponseReason ?? null,
    provider_response_text: opResult.providerResponseText ?? null,
    status: opResult.status,
    ui_confirmation: uiConfirmation,
    email_receipt_verified: opResult.verification?.emailReceiptVerified ?? false,
    email_receipt_details: opResult.verification?.emailReceiptDetails ?? null,
    admin_reconciled: opResult.verification?.adminReconciled ?? false,
    admin_reconciliation_details: opResult.verification?.adminReconciliationDetails ?? null,
    error_message: opResult.errorMessage ?? null,
    redacted_card_number: opResult.redactedCardNumber ?? null,
    redacted_cvv: opResult.redactedCvv ?? null,
    test_data_generated: true,
    test_data_cleanup_status: 'pending',
    verification_overall_match: opResult.verification?.overallMatch ?? false,
  };
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Cleanup provider instance resources after execution completes.
 */
export async function cleanupPaymentContext(
  paymentCtx: PaymentContext | null,
  correlationId: string,
): Promise<void> {
  if (!paymentCtx) return;
  try {
    await paymentCtx.providerInstance.cleanup();
  } catch (err) {
    logger.warn(
      `Payment provider cleanup error: ${String(err)}`,
      undefined,
      correlationId,
    );
  }
}
