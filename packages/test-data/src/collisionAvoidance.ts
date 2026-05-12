// Data collision avoidance for Phase 19
import type { CollisionAvoidanceOptions } from './types.js';
import { invokeProc } from '@qa-platform/db';

export class CollisionAvoidance {
  /**
   * Check if an identifier (email, username, phone, etc.) is already in use
   * for the given run execution
   */
  static async checkCollision(options: CollisionAvoidanceOptions): Promise<boolean> {
    try {
      // Check test_identities table for email/username/phone collisions
      if (options.identifierType === 'email') {
        const result = await invokeProc('sp_test_identities_list', {
          i_run_execution_id: options.runExecutionId,
          i_limit: 1
        });

        if (result && result.length > 0) {
          const existingEmails = result.map((row: { o_email: string }) => row.o_email);
          return existingEmails.includes(options.identifier);
        }
      }

      // Check test_data_ledger for any identifier collisions
      const ledgerResult = await invokeProc('sp_test_data_ledger_list', {
        i_run_execution_id: options.runExecutionId,
        i_limit: 1000
      });

      if (ledgerResult && ledgerResult.length > 0) {
        const existingIdentifiers = ledgerResult.map((row: { o_identifier: string }) => row.o_identifier);
        return existingIdentifiers.includes(options.identifier);
      }

      return false;
    } catch (error) {
      console.error('Collision check error:', error);
      // If we can't check, assume collision to be safe
      return true;
    }
  }

  /**
   * Generate a unique identifier by appending a suffix if collision exists
   */
  static async generateUniqueIdentifier(
    baseIdentifier: string,
    identifierType: 'email' | 'username' | 'phone' | 'custom',
    options: Omit<CollisionAvoidanceOptions, 'identifier'>
  ): Promise<string> {
    let identifier = baseIdentifier;
    let attempt = 0;
    const maxAttempts = 100;

    while (attempt < maxAttempts) {
      const hasCollision = await this.checkCollision({
        ...options,
        identifier,
        identifierType
      });

      if (!hasCollision) {
        return identifier;
      }

      // Append suffix to make unique
      attempt++;
      const suffix = this.generateSuffix(attempt, identifierType);

      if (identifierType === 'email') {
        const [localPart, domain] = identifier.split('@');
        identifier = `${localPart}${suffix}@${domain}`;
      } else {
        identifier = `${baseIdentifier}${suffix}`;
      }
    }

    throw new Error(`Failed to generate unique ${identifierType} after ${maxAttempts} attempts`);
  }

  private static generateSuffix(attempt: number, identifierType: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);

    switch (identifierType) {
      case 'email':
        return `.${timestamp}${random}`;
      case 'username':
        return `${timestamp}${random}`;
      case 'phone':
        // For phone numbers, we might need a different approach
        return timestamp;
      default:
        return `_${timestamp}${random}`;
    }
  }

  /**
   * Validate identifier format based on type
   */
  static validateIdentifier(identifier: string, identifierType: string): boolean {
    switch (identifierType) {
      case 'email':
        return this.validateEmail(identifier);
      case 'username':
        return this.validateUsername(identifier);
      case 'phone':
        return this.validatePhone(identifier);
      default:
        return identifier.length > 0;
    }
  }

  private static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static validateUsername(username: string): boolean {
    // Username should be 3-50 characters, alphanumeric with underscores/hyphens
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return usernameRegex.test(username);
  }

  private static validatePhone(phone: string): boolean {
    // Accept various phone formats
    const phoneRegex = /^[\d\s\-\(\)\.]{10,20}$/;
    return phoneRegex.test(phone);
  }
}
