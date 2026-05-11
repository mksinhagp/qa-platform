/**
 * Phase 6: API Testing Layer — Schema Validation Suite
 *
 * Validates API response payloads against expected field definitions using Zod.
 * This uses the ResponseField[] definitions from endpoint configs to dynamically
 * build Zod schemas and validate the actual response body.
 *
 * Zod was chosen over AJV because:
 * - Already used throughout the codebase (rules, run config, etc.)
 * - Superior TypeScript inference
 * - Better error messages for debugging
 * - Unified dependency tree
 */

import { z } from 'zod';
import type { ApiEndpointConfig, ApiResponse, ApiAssertionResult, ResponseField } from './types.js';

/**
 * Build a Zod schema dynamically from ResponseField definitions.
 * Supports nested objects and arrays.
 */
function buildZodSchema(fields: ResponseField[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'null':
        fieldSchema = z.null();
        break;
      case 'object':
        if (field.children && field.children.length > 0) {
          fieldSchema = buildZodSchema(field.children);
        } else {
          fieldSchema = z.record(z.unknown());
        }
        break;
      case 'array':
        if (field.children && field.children.length > 0) {
          // Array of objects with defined structure
          fieldSchema = z.array(buildZodSchema(field.children));
        } else {
          fieldSchema = z.array(z.unknown());
        }
        break;
      default:
        fieldSchema = z.unknown();
    }

    // Allow field to be nullable/optional if not required
    if (!field.required) {
      fieldSchema = fieldSchema.nullable().optional();
    }

    shape[field.name] = fieldSchema;
  }

  // Use passthrough to allow additional undeclared fields (non-strict)
  return z.object(shape).passthrough();
}

/**
 * Format Zod errors into a human-readable summary.
 */
function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.join('.');
      return `${path || '(root)'}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Run schema validation assertions for endpoints that have response_fields defined.
 */
export function assertSchemas(
  endpoints: ApiEndpointConfig[],
  responses: Map<string, ApiResponse>,
): ApiAssertionResult[] {
  const assertions: ApiAssertionResult[] = [];

  for (const ep of endpoints) {
    if (!ep.suites.includes('schema')) continue;
    if (!ep.response_fields || ep.response_fields.length === 0) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_schema_defined`,
        status: 'skipped',
        error_message: 'No response_fields defined for this endpoint — skipping schema validation',
        detail: { endpoint_id: ep.id },
      });
      continue;
    }

    const response = responses.get(ep.id);
    if (!response) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_schema_valid`,
        status: 'error',
        error_message: `No response captured for endpoint "${ep.id}"`,
      });
      continue;
    }

    if (response.error) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_schema_valid`,
        status: 'error',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Cannot validate schema — request failed: ${response.error}`,
        detail: { endpoint_id: ep.id },
      });
      continue;
    }

    // Validate JSON parseable
    if (typeof response.body !== 'object' || response.body === null) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_schema_json_parseable`,
        status: 'failed',
        expected_value: 'JSON object',
        actual_value: typeof response.body,
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: 'Response body is not a valid JSON object',
        detail: { endpoint_id: ep.id, body_preview: String(response.body_text).slice(0, 200) },
      });
      continue;
    }

    // Build dynamic Zod schema and validate
    try {
      const schema = buildZodSchema(ep.response_fields);
      const result = schema.safeParse(response.body);

      if (result.success) {
        assertions.push({
          endpoint_url: response.url,
          http_method: response.method,
          assertion_name: `${ep.id}_schema_valid`,
          status: 'passed',
          response_status: response.status,
          response_time_ms: response.response_time_ms,
          detail: {
            endpoint_id: ep.id,
            validated_fields: ep.response_fields.length,
          },
        });
      } else {
        assertions.push({
          endpoint_url: response.url,
          http_method: response.method,
          assertion_name: `${ep.id}_schema_valid`,
          status: 'failed',
          expected_value: `Valid schema with ${ep.response_fields.length} field(s)`,
          actual_value: formatZodErrors(result.error),
          response_status: response.status,
          response_time_ms: response.response_time_ms,
          error_message: `Schema validation failed: ${formatZodErrors(result.error)}`,
          detail: {
            endpoint_id: ep.id,
            errors: result.error.issues.map(i => ({
              path: i.path.join('.'),
              message: i.message,
              code: i.code,
            })),
          },
        });
      }
    } catch (err) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_schema_valid`,
        status: 'error',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Schema build error: ${err instanceof Error ? err.message : String(err)}`,
        detail: { endpoint_id: ep.id },
      });
    }
  }

  return assertions;
}

// Export buildZodSchema for testing
export { buildZodSchema, formatZodErrors };
