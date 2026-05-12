// Payment provider types for Phase 17

export type PaymentProviderType = 'authorize_net' | 'stripe' | 'paypal' | 'generic';

export type TransactionType = 'authorize' | 'capture' | 'void' | 'refund';

export type TransactionStatus = 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refunded';

export type ScenarioType = 'success' | 'decline' | 'avs_failure' | 'cvv_failure' | 'duplicate' | 'void' | 'refund';

export interface PaymentProviderConfig {
  id: number;
  name: string;
  providerType: PaymentProviderType;
  isSandbox: boolean;
  merchantId?: string;
  environmentUrl?: string;
  // Secret IDs for credentials (stored in vault)
  apiLoginIdSecretId?: number;
  apiTransactionKeySecretId?: number;
  apiKeySecretId?: number;
  apiSecretSecretId?: number;
}

export interface PaymentScenario {
  id: number;
  name: string;
  scenarioType: ScenarioType;
  expectedResult: string;
  testCardNumber?: string;
  testCvv?: string;
  testExpiryMonth?: number;
  testExpiryYear?: number;
  testAmount: number;
  avsZipCode?: string;
  avsAddress?: string;
  expectedResponseCode?: string;
  expectedResponseReason?: string;
}

export interface PaymentTransaction {
  id: number;
  runExecutionId: number;
  siteId: number;
  siteEnvironmentId: number;
  personaId?: number;
  paymentProviderId?: number;
  paymentProfileId?: number;
  paymentScenarioId?: number;
  transactionType: TransactionType;
  amount: number;
  currency: string;
  providerTransactionId?: string;
  providerResponseCode?: string;
  providerResponseReason?: string;
  providerResponseText?: string;
  status: TransactionStatus;
  uiConfirmation?: string;
  emailReceiptVerified: boolean;
  emailReceiptDetails?: string;
  adminReconciled: boolean;
  adminReconciliationDetails?: string;
  errorMessage?: string;
  redactedCardNumber?: string;
  redactedCvv?: string;
  testDataGenerated: boolean;
  testDataCleanupStatus: string;
  approvalId?: number;
  createdDate: Date;
  updatedDate: Date;
}

export interface AuthorizeRequest {
  amount: number;
  currency?: string;
  cardNumber: string;
  cvv: string;
  expiryMonth: number;
  expiryYear: number;
  // Optional address for AVS
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId?: string;
  responseCode?: string;
  responseReason?: string;
  responseText?: string;
  authCode?: string;
  avsCode?: string;
  cvvCode?: string;
  errorCode?: string;
  errorText?: string;
}

export interface CaptureRequest {
  transactionId: string;
  amount?: number;
}

export interface CaptureResponse {
  success: boolean;
  transactionId?: string;
  responseCode?: string;
  responseReason?: string;
  responseText?: string;
  errorCode?: string;
  errorText?: string;
}

export interface VoidRequest {
  transactionId: string;
}

export interface VoidResponse {
  success: boolean;
  transactionId?: string;
  responseCode?: string;
  responseReason?: string;
  responseText?: string;
  errorCode?: string;
  errorText?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount?: number;
  cardNumber?: string; // Last 4 digits for some providers
}

export interface RefundResponse {
  success: boolean;
  transactionId?: string;
  responseCode?: string;
  responseReason?: string;
  responseText?: string;
  errorCode?: string;
  errorText?: string;
}

export interface PaymentVerificationResult {
  uiConfirmed: boolean;
  uiConfirmationDetails?: string;
  emailReceiptVerified: boolean;
  emailReceiptDetails?: string;
  providerStatusMatch: boolean;
  providerStatusDetails?: string;
  adminReconciled: boolean;
  adminReconciliationDetails?: string;
  overallMatch: boolean;
}
