// Authorize.net payment provider implementation for Phase 17
import type { PaymentProvider } from '../provider.js';
import type { PaymentProviderConfig, AuthorizeRequest, AuthorizeResponse, CaptureRequest, CaptureResponse, VoidRequest, VoidResponse, RefundRequest, RefundResponse } from '../types.js';

export class AuthorizeNetProvider implements PaymentProvider {
  readonly type = 'authorize_net';
  readonly config: PaymentProviderConfig;

  private apiLoginId?: string;
  private apiTransactionKey?: string;
  private isInitialized = false;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    this.apiLoginId = credentials.apiLoginId;
    this.apiTransactionKey = credentials.apiTransactionKey;
    this.isInitialized = true;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.apiLoginId || !this.apiTransactionKey) {
      throw new Error('AuthorizeNetProvider not initialized. Call initialize() with credentials first.');
    }
  }

  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    this.ensureInitialized();

    // In sandbox mode, we simulate the API call
    // In production, this would make an actual HTTP request to Authorize.net API
    const isSandbox = this.config.isSandbox;

    if (isSandbox) {
      return this.simulateSandboxAuthorize(request);
    }

    // Production implementation would go here
    throw new Error('Production Authorize.net implementation not yet implemented');
  }

  private simulateSandboxAuthorize(request: AuthorizeRequest): AuthorizeResponse {
    // Simulate Authorize.net sandbox responses based on card number
    // Common Authorize.net test card numbers:
    // 4111111111111111 - Visa - Success
    // 5424180279791732 - MasterCard - Success
    // 6011111111111112 - Discover - Success
    // 371449635398431 - American Express - Success
    // 4007000000027 - Decline
    // 4012888818888 - Decline
    // 4222222222222 - Decline

    const cardNumber = request.cardNumber.replace(/\s/g, '');

    // Simulate success for most test cards
    if (cardNumber.startsWith('4') && !cardNumber.startsWith('4007')) {
      return {
        success: true,
        transactionId: `AUTH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        responseCode: '1',
        responseReason: 'Approved',
        responseText: 'This transaction has been approved.',
        authCode: '000000',
        avsCode: 'Y',
        cvvCode: 'M'
      };
    }

    // Simulate decline
    if (cardNumber.startsWith('4007') || cardNumber.startsWith('4012') || cardNumber.startsWith('4222')) {
      return {
        success: false,
        responseCode: '2',
        responseReason: 'Declined',
        responseText: 'This transaction has been declined.',
        errorCode: '000',
        errorText: 'Card declined'
      };
    }

    // Default to success for unknown cards in sandbox
    return {
      success: true,
      transactionId: `AUTH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      responseCode: '1',
      responseReason: 'Approved',
      responseText: 'This transaction has been approved.',
      authCode: '000000',
      avsCode: 'Y',
      cvvCode: 'M'
    };
  }

  async capture(request: CaptureRequest): Promise<CaptureResponse> {
    this.ensureInitialized();

    if (this.config.isSandbox) {
      return this.simulateSandboxCapture(request);
    }

    throw new Error('Production Authorize.net implementation not yet implemented');
  }

  private simulateSandboxCapture(request: CaptureRequest): CaptureResponse {
    return {
      success: true,
      transactionId: request.transactionId,
      responseCode: '1',
      responseReason: 'Approved',
      responseText: 'This transaction has been approved.'
    };
  }

  async void(request: VoidRequest): Promise<VoidResponse> {
    this.ensureInitialized();

    if (this.config.isSandbox) {
      return this.simulateSandboxVoid(request);
    }

    throw new Error('Production Authorize.net implementation not yet implemented');
  }

  private simulateSandboxVoid(request: VoidRequest): VoidResponse {
    return {
      success: true,
      transactionId: request.transactionId,
      responseCode: '1',
      responseReason: 'Approved',
      responseText: 'This transaction has been approved.'
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    this.ensureInitialized();

    if (this.config.isSandbox) {
      return this.simulateSandboxRefund(request);
    }

    throw new Error('Production Authorize.net implementation not yet implemented');
  }

  private simulateSandboxRefund(_request: RefundRequest): RefundResponse {
    return {
      success: true,
      transactionId: `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      responseCode: '1',
      responseReason: 'Approved',
      responseText: 'This transaction has been approved.'
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    if (this.config.isSandbox) {
      // In sandbox, just check that credentials are set
      return !!(this.apiLoginId && this.apiTransactionKey);
    }

    // In production, would make actual API call
    return true;
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for this implementation
    this.isInitialized = false;
  }
}
