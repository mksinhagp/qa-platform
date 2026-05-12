// Generic payment provider interface for Phase 17
import type { PaymentProviderConfig, AuthorizeRequest, AuthorizeResponse, CaptureRequest, CaptureResponse, VoidRequest, VoidResponse, RefundRequest, RefundResponse } from './types.js';

export interface PaymentProvider {
  // Provider identification
  readonly type: string;
  readonly config: PaymentProviderConfig;

  // Initialize provider with credentials from vault
  initialize(credentials: Record<string, string>): Promise<void>;

  // Authorization operations
  authorize(request: AuthorizeRequest): Promise<AuthorizeResponse>;

  // Capture operations
  capture(request: CaptureRequest): Promise<CaptureResponse>;

  // Void operations
  void(request: VoidRequest): Promise<VoidResponse>;

  // Refund operations
  refund(request: RefundRequest): Promise<RefundResponse>;

  // Health check
  healthCheck(): Promise<boolean>;

  // Cleanup
  cleanup(): Promise<void>;
}

// Provider registry for pluggable implementations
export class PaymentProviderRegistry {
  private providers = new Map<string, new (config: PaymentProviderConfig) => PaymentProvider>();

  register(type: string, providerClass: new (config: PaymentProviderConfig) => PaymentProvider): void {
    this.providers.set(type, providerClass);
  }

  get(type: string): (new (config: PaymentProviderConfig) => PaymentProvider) | undefined {
    return this.providers.get(type);
  }

  has(type: string): boolean {
    return this.providers.has(type);
  }
}

// Global registry instance
export const paymentProviderRegistry = new PaymentProviderRegistry();
