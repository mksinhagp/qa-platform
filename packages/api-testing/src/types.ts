/**
 * Phase 6: API Testing Layer — Shared Types
 *
 * These types define the configuration, execution context, and result structures
 * for the API testing framework. The framework is generic — site-specific endpoint
 * definitions are provided by each site's api-endpoints.ts file.
 *
 * In Phase 8, the local LLM will generate additional endpoint configs dynamically
 * based on network traffic observed during browser flows.
 */

import { z } from 'zod';
import type { SiteRules } from '@qa-platform/rules';

// ─── Suite Types ─────────────────────────────────────────────────────────────

export const API_SUITE_TYPES = [
  'reachability',
  'schema',
  'business_rules',
  'cross_validation',
] as const;

export type ApiSuiteType = (typeof API_SUITE_TYPES)[number];

// ─── Assertion Status ────────────────────────────────────────────────────────

export type ApiAssertionStatus = 'passed' | 'failed' | 'error' | 'skipped';
export type ApiSuiteStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';

// ─── Endpoint Configuration ──────────────────────────────────────────────────

/** Shape for a single API endpoint response field (used in schema validation) */
export interface ResponseField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  required: boolean;
  /** Nested fields for object/array types */
  children?: ResponseField[];
  /** Zod refinement description (for display only) */
  description?: string;
}

/** Input shape (before Zod defaults are applied) */
interface ResponseFieldInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  required?: boolean;
  children?: ResponseFieldInput[];
  description?: string;
}

/** Zod schema for a single API endpoint response field */
export const ResponseFieldSchema: z.ZodType<ResponseField, z.ZodTypeDef, ResponseFieldInput> = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']),
  required: z.boolean().default(true),
  /** Nested fields for object/array types */
  children: z.lazy(() => z.array(ResponseFieldSchema)).optional(),
  /** Zod refinement description (for display only) */
  description: z.string().optional(),
});

/** Configuration for a single API endpoint to test */
export const ApiEndpointConfigSchema = z.object({
  /** Unique identifier for this endpoint (e.g., 'health', 'camps_list') */
  id: z.string().min(1),
  /** Relative URL path (will be resolved against site base_url) */
  url: z.string().min(1),
  /** HTTP method */
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  /** Which suite types this endpoint participates in */
  suites: z.array(z.enum(['reachability', 'schema', 'business_rules', 'cross_validation'])),
  /** Expected HTTP status code for reachability check */
  expected_status: z.number().int().positive().default(200),
  /** Timeout in milliseconds for this endpoint */
  timeout_ms: z.number().int().positive().default(10_000),
  /** Whether this endpoint requires auth headers */
  requires_auth: z.boolean().default(false),
  /** Expected response schema (field definitions for Zod-based validation) */
  response_fields: z.array(ResponseFieldSchema).optional(),
  /** Business rule categories to check against this endpoint's response */
  business_rule_checks: z.array(z.string()).optional(),
  /** Headers to send with the request */
  headers: z.record(z.string()).optional(),
  /** Request body for POST/PUT/PATCH */
  body: z.unknown().optional(),
  /** Human-readable description */
  description: z.string().optional(),
  /** Whether this endpoint was auto-discovered (Phase 8 LLM) vs. manually defined */
  source: z.enum(['manual', 'auto_discovered', 'llm_generated']).default('manual'),
});
export type ApiEndpointConfig = z.infer<typeof ApiEndpointConfigSchema>;

// ─── API Client Response ─────────────────────────────────────────────────────

/** Raw HTTP response captured by the API client */
export interface ApiResponse {
  endpoint_id: string;
  url: string;
  method: string;
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: unknown;
  body_text: string;
  response_time_ms: number;
  error?: string;
}

// ─── Assertion Result ────────────────────────────────────────────────────────

/** Result of a single API assertion */
export interface ApiAssertionResult {
  endpoint_url: string;
  http_method: string;
  assertion_name: string;
  status: ApiAssertionStatus;
  expected_value?: string;
  actual_value?: string;
  response_status?: number;
  response_time_ms?: number;
  error_message?: string;
  detail?: Record<string, unknown>;
}

// ─── Suite Result ────────────────────────────────────────────────────────────

/** Result of a complete API test suite */
export interface ApiSuiteResult {
  suite_type: ApiSuiteType;
  status: ApiSuiteStatus;
  assertions: ApiAssertionResult[];
  total_assertions: number;
  passed_assertions: number;
  failed_assertions: number;
  skipped_assertions: number;
  started_at: Date;
  completed_at: Date;
  duration_ms: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

// ─── Cross-Validation Context ────────────────────────────────────────────────

// Import and re-export BrowserCapturedState from shared-types (single source of truth)
import type { BrowserCapturedState } from '@qa-platform/shared-types';
export type { BrowserCapturedState } from '@qa-platform/shared-types';

// ─── Full API Test Config ────────────────────────────────────────────────────

/** Complete API testing configuration for one execution */
export interface ApiTestConfig {
  /** Site base URL (from site rules) */
  base_url: string;
  /** All endpoints to test */
  endpoints: ApiEndpointConfig[];
  /** Site business rules (for business_rules suite) */
  rules: SiteRules;
  /** Auth token/cookie for authenticated endpoints */
  auth_header?: string;
  /** State captured during browser flow (for cross_validation suite) */
  browser_state?: BrowserCapturedState;
  /** Timeout for entire API test phase (default 60s) */
  overall_timeout_ms?: number;
}

// ─── Callback Payload ────────────────────────────────────────────────────────

/** Payload sent from runner to dashboard via /api/runner/callback for API test results */
export interface ApiTestCallbackPayload {
  type: 'api_test_result';
  execution_id: number;
  suites: ApiSuiteResult[];
}
