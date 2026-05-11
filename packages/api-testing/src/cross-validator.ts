/**
 * Phase 6: API Testing Layer — Cross-Validation Suite
 *
 * Compares state captured during browser flow execution with API response data.
 * This verifies that what the browser showed the user matches what the backend stores.
 *
 * Examples:
 * - Booking ID from confirmation page matches booking ID from API
 * - Email used in registration form matches email in API profile
 * - Order total from checkout matches total in API order record
 * - Payment status on confirmation page matches API payment status
 */

import type { ApiEndpointConfig, ApiResponse, ApiAssertionResult, BrowserCapturedState } from './types.js';

/**
 * Normalize a string for comparison: trim, lowercase, collapse whitespace.
 */
function normalize(value: string | undefined | null): string {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Extract a value from a nested object by dot-separated path.
 * e.g., extractPath(obj, 'booking.confirmation_id') => obj.booking.confirmation_id
 */
function extractPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Mapping of browser state fields to common API response field paths */
const DEFAULT_FIELD_MAPPINGS: Record<string, string[]> = {
  confirmation_id: [
    'confirmation_id', 'booking_id', 'registration_id', 'order_id',
    'id', 'reference', 'confirmation_number', 'booking.id',
    'data.confirmation_id', 'data.id',
  ],
  email_used: [
    'email', 'user_email', 'registrant_email', 'contact_email',
    'data.email', 'user.email',
  ],
  name_used: [
    'name', 'full_name', 'registrant_name', 'contact_name',
    'data.name', 'user.name', 'user.full_name',
  ],
  phone_used: [
    'phone', 'phone_number', 'contact_phone',
    'data.phone', 'user.phone',
  ],
  order_total: [
    'total', 'order_total', 'amount', 'grand_total', 'total_amount',
    'data.total', 'payment.amount',
  ],
  payment_status: [
    'payment_status', 'status', 'payment.status',
    'data.payment_status', 'data.status',
  ],
  session_name: [
    'session_name', 'camp_name', 'event_name', 'program_name',
    'data.session_name', 'data.camp_name',
  ],
  attendee_count: [
    'attendee_count', 'num_attendees', 'attendees', 'participant_count',
    'data.attendee_count', 'data.num_attendees',
  ],
};

/**
 * Try to find a matching value in the API response for a browser-captured field.
 * Returns the first non-undefined match from the candidate paths.
 */
function findApiValue(body: unknown, candidatePaths: string[]): { value: unknown; path: string } | null {
  for (const path of candidatePaths) {
    const value = extractPath(body, path);
    if (value !== undefined && value !== null) {
      return { value, path };
    }
  }
  return null;
}

/**
 * Compare a browser-captured value against an API value.
 * Uses normalized string comparison for strings, strict equality for numbers.
 */
function valuesMatch(browserValue: string | number | undefined, apiValue: unknown): boolean {
  if (browserValue === undefined || browserValue === null) return true; // No browser value to compare
  if (apiValue === undefined || apiValue === null) return false;

  if (typeof browserValue === 'number') {
    return Number(apiValue) === browserValue;
  }

  // String comparison — normalize both sides
  return normalize(String(browserValue)) === normalize(String(apiValue));
}

/**
 * Run cross-validation assertions for endpoints configured with cross_validation suite.
 * Compares browser-captured state against API response data.
 */
export function assertCrossValidation(
  endpoints: ApiEndpointConfig[],
  responses: Map<string, ApiResponse>,
  browserState?: BrowserCapturedState,
): ApiAssertionResult[] {
  const assertions: ApiAssertionResult[] = [];

  if (!browserState) {
    assertions.push({
      endpoint_url: '',
      http_method: '',
      assertion_name: 'cross_validation_state_available',
      status: 'skipped',
      error_message: 'No browser-captured state available for cross-validation',
    });
    return assertions;
  }

  for (const ep of endpoints) {
    if (!ep.suites.includes('cross_validation')) continue;

    const response = responses.get(ep.id);
    if (!response) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_cross_validation`,
        status: 'error',
        error_message: `No response captured for endpoint "${ep.id}"`,
      });
      continue;
    }

    if (response.error) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_cross_validation`,
        status: 'error',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Cannot cross-validate — request failed: ${response.error}`,
        detail: { endpoint_id: ep.id },
      });
      continue;
    }

    // Cross-validate each browser state field that has a value
    const stateFields: [string, string | number | undefined][] = [
      ['confirmation_id', browserState.confirmation_id],
      ['email_used', browserState.email_used],
      ['name_used', browserState.name_used],
      ['phone_used', browserState.phone_used],
      ['order_total', browserState.order_total],
      ['payment_status', browserState.payment_status],
      ['session_name', browserState.session_name],
      ['attendee_count', browserState.attendee_count],
    ];

    // Also include custom fields
    if (browserState.custom) {
      for (const [key, value] of Object.entries(browserState.custom)) {
        stateFields.push([key, value]);
      }
    }

    let checkedAny = false;

    for (const [fieldName, browserValue] of stateFields) {
      if (browserValue === undefined || browserValue === null || browserValue === '') continue;
      checkedAny = true;

      // Look for a matching field in the API response
      const candidatePaths = DEFAULT_FIELD_MAPPINGS[fieldName] ?? [fieldName];
      const apiMatch = findApiValue(response.body, candidatePaths);

      if (!apiMatch) {
        assertions.push({
          endpoint_url: response.url,
          http_method: response.method,
          assertion_name: `${ep.id}_cross_${fieldName}`,
          status: 'skipped',
          expected_value: String(browserValue),
          actual_value: 'field not found in API response',
          response_status: response.status,
          response_time_ms: response.response_time_ms,
          error_message: `Could not find "${fieldName}" in API response (tried paths: ${candidatePaths.join(', ')})`,
          detail: { endpoint_id: ep.id, field: fieldName, candidate_paths: candidatePaths },
        });
        continue;
      }

      const match = valuesMatch(browserValue, apiMatch.value);
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_cross_${fieldName}`,
        status: match ? 'passed' : 'failed',
        expected_value: String(browserValue),
        actual_value: String(apiMatch.value),
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: match
          ? undefined
          : `Browser showed "${browserValue}" but API returned "${apiMatch.value}" at path "${apiMatch.path}"`,
        detail: { endpoint_id: ep.id, field: fieldName, api_path: apiMatch.path },
      });
    }

    if (!checkedAny) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_cross_validation_no_state`,
        status: 'skipped',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: 'No browser state fields had values to cross-validate',
        detail: { endpoint_id: ep.id },
      });
    }
  }

  return assertions;
}

// Export helpers for testing
export { normalize, extractPath, findApiValue, valuesMatch, DEFAULT_FIELD_MAPPINGS };
