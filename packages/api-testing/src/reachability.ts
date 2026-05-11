/**
 * Phase 6: API Testing Layer — Reachability Suite
 *
 * Probes configured endpoints to verify:
 * - Endpoint is reachable (no network/DNS error)
 * - Returns expected HTTP status code
 * - Responds within the configured timeout
 * - Returns a non-empty response body
 */

import type { ApiEndpointConfig, ApiResponse, ApiAssertionResult } from './types.js';

/** Default maximum acceptable response time in ms for reachability */
const DEFAULT_SLOW_THRESHOLD_MS = 5_000;

/**
 * Run reachability assertions for a set of endpoints and their pre-fetched responses.
 */
export function assertReachability(
  endpoints: ApiEndpointConfig[],
  responses: Map<string, ApiResponse>,
  slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS,
): ApiAssertionResult[] {
  const assertions: ApiAssertionResult[] = [];

  for (const ep of endpoints) {
    if (!ep.suites.includes('reachability')) continue;

    const response = responses.get(ep.id);

    if (!response) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_reachable`,
        status: 'error',
        error_message: `No response captured for endpoint "${ep.id}"`,
      });
      continue;
    }

    // 1. Network-level reachability (no fetch error)
    if (response.error) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_reachable`,
        status: 'failed',
        expected_value: `HTTP ${ep.expected_status ?? 200}`,
        actual_value: 'Network error',
        response_time_ms: response.response_time_ms,
        error_message: response.error,
        detail: { endpoint_id: ep.id },
      });
      continue;
    }

    // 2. Expected HTTP status code
    const expectedStatus = ep.expected_status ?? 200;
    const statusMatch = response.status === expectedStatus;
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${ep.id}_status_code`,
      status: statusMatch ? 'passed' : 'failed',
      expected_value: String(expectedStatus),
      actual_value: String(response.status),
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      error_message: statusMatch
        ? undefined
        : `Expected HTTP ${expectedStatus}, got ${response.status} ${response.status_text}`,
      detail: { endpoint_id: ep.id },
    });

    // 3. Response time within acceptable range
    if (response.response_time_ms > slowThresholdMs) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_response_time`,
        status: 'failed',
        expected_value: `<= ${slowThresholdMs}ms`,
        actual_value: `${response.response_time_ms}ms`,
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Slow response: ${response.response_time_ms}ms exceeds ${slowThresholdMs}ms threshold`,
        detail: { endpoint_id: ep.id },
      });
    } else {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_response_time`,
        status: 'passed',
        expected_value: `<= ${slowThresholdMs}ms`,
        actual_value: `${response.response_time_ms}ms`,
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        detail: { endpoint_id: ep.id },
      });
    }

    // 4. Non-empty response body
    const hasBody = response.body_text.length > 0;
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${ep.id}_has_body`,
      status: hasBody ? 'passed' : 'failed',
      expected_value: 'non-empty response body',
      actual_value: hasBody ? `${response.body_text.length} chars` : 'empty',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      error_message: hasBody ? undefined : 'Endpoint returned an empty response body',
      detail: { endpoint_id: ep.id },
    });
  }

  return assertions;
}
