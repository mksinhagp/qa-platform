// Sensitive data redaction for Phase 19
import type { DataRedactionRule, RedactionOptions } from './types.js';
import { invokeProc } from '@qa-platform/db';

export class DataRedactor {
  /**
   * Redact sensitive data from an object based on rules
   */
  static async redact(options: RedactionOptions): Promise<Record<string, unknown>> {
    const { data, rules, tableName } = options;

    // Filter rules that apply to this table
    const applicableRules = rules.filter(rule =>
      rule.appliesToTables.includes(tableName) || rule.appliesToTables.includes('*')
    );

    // Sort by priority (higher priority first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    // Create a copy of the data to avoid mutating the original
    const redactedData = JSON.parse(JSON.stringify(data));

    // Apply each rule
    for (const rule of applicableRules) {
      if (!rule.isActive) continue;

      this.applyRule(redactedData, rule);
    }

    return redactedData;
  }

  private static applyRule(data: Record<string, unknown>, rule: DataRedactionRule): void {
    const fieldValue = this.getNestedValue(data, rule.fieldName);

    if (fieldValue !== undefined && fieldValue !== null) {
      const redactedValue = this.redactValue(fieldValue, rule);
      this.setNestedValue(data, rule.fieldName, redactedValue);
    }
  }

  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (typeof current === 'object' && current !== null && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private static setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    if (!lastKey) return;

    let current: Record<string, unknown> = obj;

    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[lastKey] = value;
  }

  private static redactValue(value: unknown, rule: DataRedactionRule): string {
    const stringValue = String(value);

    // Apply the redaction pattern
    if (rule.redactionPattern === 'full') {
      // Full redaction - replace entire value
      return rule.replacementPattern;
    }

    if (rule.redactionPattern === 'partial') {
      // Partial redaction - show only first and last characters
      if (stringValue.length <= 4) {
        return rule.replacementPattern;
      }
      return `${stringValue.substring(0, 2)}${rule.replacementPattern}${stringValue.substring(stringValue.length - 2)}`;
    }

    if (rule.redactionPattern === 'last4') {
      // Show only last 4 characters
      if (stringValue.length <= 4) {
        return rule.replacementPattern;
      }
      return `${rule.replacementPattern}${stringValue.substring(stringValue.length - 4)}`;
    }

    if (rule.redactionPattern === 'first4_last4') {
      // Show first 4 and last 4 characters
      if (stringValue.length <= 8) {
        return rule.replacementPattern;
      }
      return `${stringValue.substring(0, 4)}${rule.replacementPattern}${stringValue.substring(stringValue.length - 4)}`;
    }

    // Default to full redaction
    return rule.replacementPattern;
  }

  /**
   * Load redaction rules from database
   */
  static async loadRules(fieldType?: string): Promise<DataRedactionRule[]> {
    const result = await invokeProc('sp_data_redaction_rules_list', {
      i_field_type: fieldType || null,
      i_is_active: true
    });

    if (!result || result.length === 0) {
      return this.getDefaultRules();
    }

    return result.map((row: any) => ({
      id: row.o_id,
      fieldName: row.o_field_name,
      fieldType: row.o_field_type,
      redactionPattern: row.o_redaction_pattern,
      replacementPattern: row.o_replacement_pattern,
      appliesToTables: row.o_applies_to_tables,
      isActive: row.o_is_active,
      priority: row.o_priority,
      description: row.o_description,
      createdDate: new Date(row.o_created_date),
      updatedDate: new Date()
    }));
  }

  /**
   * Get default redaction rules if none are configured in database
   */
  private static getDefaultRules(): DataRedactionRule[] {
    return [
      {
        id: 0,
        fieldName: 'card_number',
        fieldType: 'card_number',
        redactionPattern: 'last4',
        replacementPattern: '****',
        appliesToTables: ['*'],
        isActive: true,
        priority: 100,
        description: 'Redact credit card numbers, show only last 4 digits',
        createdDate: new Date(),
        updatedDate: new Date()
      },
      {
        id: 0,
        fieldName: 'cvv',
        fieldType: 'cvv',
        redactionPattern: 'full',
        replacementPattern: '***',
        appliesToTables: ['*'],
        isActive: true,
        priority: 100,
        description: 'Fully redact CVV codes',
        createdDate: new Date(),
        updatedDate: new Date()
      },
      {
        id: 0,
        fieldName: 'email',
        fieldType: 'email',
        redactionPattern: 'partial',
        replacementPattern: '***',
        appliesToTables: ['*'],
        isActive: true,
        priority: 90,
        description: 'Partially redact email addresses',
        createdDate: new Date(),
        updatedDate: new Date()
      },
      {
        id: 0,
        fieldName: 'phone',
        fieldType: 'phone',
        redactionPattern: 'partial',
        replacementPattern: '***',
        appliesToTables: ['*'],
        isActive: true,
        priority: 90,
        description: 'Partially redact phone numbers',
        createdDate: new Date(),
        updatedDate: new Date()
      },
      {
        id: 0,
        fieldName: 'ssn',
        fieldType: 'ssn',
        redactionPattern: 'full',
        replacementPattern: '***-**-****',
        appliesToTables: ['*'],
        isActive: true,
        priority: 100,
        description: 'Fully redact SSNs',
        createdDate: new Date(),
        updatedDate: new Date()
      },
      {
        id: 0,
        fieldName: 'password',
        fieldType: 'password',
        redactionPattern: 'full',
        replacementPattern: '******',
        appliesToTables: ['*'],
        isActive: true,
        priority: 100,
        description: 'Fully redact passwords',
        createdDate: new Date(),
        updatedDate: new Date()
      },
      {
        id: 0,
        fieldName: 'api_key',
        fieldType: 'api_key',
        redactionPattern: 'first4_last4',
        replacementPattern: '...',
        appliesToTables: ['*'],
        isActive: true,
        priority: 100,
        description: 'Redact API keys, show first and last 4 characters',
        createdDate: new Date(),
        updatedDate: new Date()
      }
    ];
  }

  /**
   * Redact specific field types
   */
  static redactCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length <= 4) {
      return '****';
    }
    return `****${cleaned.slice(-4)}`;
  }

  static redactCvv(cvv: string): string {
    return '***';
  }

  static redactEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `***@${domain}`;
    }
    return `${localPart.substring(0, 2)}***@${domain}`;
  }

  static redactPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      return '***';
    }
    return `***${cleaned.slice(-4)}`;
  }

  static redactSsn(ssn: string): string {
    return '***-**-****';
  }
}
