// Payment verification logic for Phase 17
import type { PaymentVerificationResult, AuthorizeResponse } from './types.js';

export interface VerificationContext {
  uiConfirmation?: string;
  emailReceiptContent?: string;
  providerResponse: AuthorizeResponse;
  adminBackendData?: Record<string, unknown>;
}

export class PaymentVerifier {
  /**
   * Verify payment across multiple sources: UI, email receipt, provider API, admin backend
   */
  static async verify(context: VerificationContext): Promise<PaymentVerificationResult> {
    const result: PaymentVerificationResult = {
      uiConfirmed: false,
      emailReceiptVerified: false,
      providerStatusMatch: false,
      adminReconciled: false,
      overallMatch: false
    };

    // Verify UI confirmation
    result.uiConfirmed = this.verifyUIConfirmation(context);
    result.uiConfirmationDetails = result.uiConfirmed
      ? 'UI confirmation matches expected success pattern'
      : 'UI confirmation missing or does not match expected pattern';

    // Verify email receipt
    result.emailReceiptVerified = this.verifyEmailReceipt(context);
    result.emailReceiptDetails = result.emailReceiptVerified
      ? 'Email receipt contains expected confirmation elements'
      : 'Email receipt missing or does not contain expected elements';

    // Verify provider status
    result.providerStatusMatch = this.verifyProviderStatus(context);
    result.providerStatusDetails = result.providerStatusMatch
      ? 'Provider API response matches expected status'
      : 'Provider API response does not match expected status';

    // Verify admin reconciliation (if data provided)
    if (context.adminBackendData) {
      result.adminReconciled = this.verifyAdminReconciliation(context);
      result.adminReconciliationDetails = result.adminReconciled
        ? 'Admin backend records match transaction details'
        : 'Admin backend records do not match transaction details';
    } else {
      result.adminReconciled = true; // Skip if no admin data provided
      result.adminReconciliationDetails = 'Admin reconciliation skipped - no backend data provided';
    }

    // Overall match requires all verifications to pass (except admin if skipped)
    result.overallMatch = result.uiConfirmed &&
                         result.emailReceiptVerified &&
                         result.providerStatusMatch &&
                         result.adminReconciled;

    return result;
  }

  private static verifyUIConfirmation(context: VerificationContext): boolean {
    if (!context.uiConfirmation) {
      return false;
    }

    const confirmation = context.uiConfirmation.toLowerCase();

    // Check for success indicators
    const successPatterns = [
      'success',
      'confirmed',
      'completed',
      'approved',
      'thank you',
      'order confirmed',
      'payment successful'
    ];

    // Check for failure indicators
    const failurePatterns = [
      'failed',
      'declined',
      'error',
      'cancelled',
      'unsuccessful'
    ];

    const hasSuccessPattern = successPatterns.some(pattern => confirmation.includes(pattern));
    const hasFailurePattern = failurePatterns.some(pattern => confirmation.includes(pattern));

    // Success if has success pattern and no failure pattern
    return hasSuccessPattern && !hasFailurePattern;
  }

  private static verifyEmailReceipt(context: VerificationContext): boolean {
    if (!context.emailReceiptContent) {
      return false;
    }

    const content = context.emailReceiptContent.toLowerCase();

    // Check for receipt elements
    const requiredElements = [
      'receipt',
      'confirmation',
      'order',
      'amount',
      'payment'
    ];

    // At least 3 of the required elements should be present
    const presentCount = requiredElements.filter(element => content.includes(element)).length;
    return presentCount >= 3;
  }

  private static verifyProviderStatus(context: VerificationContext): boolean {
    const response = context.providerResponse;

    // Check if provider response indicates success
    if (response.success) {
      return true;
    }

    // Check response code (Authorize.net: 1 = approved, 2 = declined, 3 = error)
    if (response.responseCode === '1') {
      return true;
    }

    return false;
  }

  private static verifyAdminReconciliation(context: VerificationContext): boolean {
    if (!context.adminBackendData) {
      return true; // Skip if no admin data
    }

    // Basic reconciliation - check if admin data has transaction record
    const adminData = context.adminBackendData;

    // Check for common transaction fields
    const hasTransactionId = adminData.transactionId !== undefined;
    const hasAmount = adminData.amount !== undefined;
    const hasStatus = adminData.status !== undefined;

    // At least transaction ID should be present
    return hasTransactionId && (hasAmount || hasStatus);
  }

  /**
   * Redact sensitive payment data for logging/reporting
   */
  static redactCardNumber(cardNumber: string): string {
    if (!cardNumber) {
      return '';
    }

    const cleaned = cardNumber.replace(/\s/g, '');

    if (cleaned.length <= 4) {
      return '****';
    }

    // Show only last 4 digits
    return `****${cleaned.slice(-4)}`;
  }

  static redactCvv(cvv: string): string {
    if (!cvv) {
      return '';
    }

    return '***';
  }

  static redactApiKey(apiKey: string): string {
    if (!apiKey) {
      return '';
    }

    if (apiKey.length <= 8) {
      return '******';
    }

    // Show first 4 and last 4 characters
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }
}
