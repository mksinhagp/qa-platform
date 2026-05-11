/**
 * Phase 6: API Testing Layer — Suite Runner
 *
 * Orchestrates the full API test phase: fetches responses, then runs each
 * configured suite (reachability, schema, business_rules, cross_validation)
 * and collects results into ApiSuiteResult structures.
 *
 * This is called by the execution-manager as a post-step after each browser flow.
 */

import type {
  ApiTestConfig,
  ApiSuiteResult,
  ApiSuiteType,
  ApiAssertionResult,
  ApiEndpointConfig,
} from './types.js';
import { executeAllRequests, type ClientOptions } from './client.js';
import { assertReachability } from './reachability.js';
import { assertSchemas } from './schema-validator.js';
import { assertBusinessRules } from './business-rules.js';
import { assertCrossValidation } from './cross-validator.js';

/** Default overall timeout for the entire API test phase */
const DEFAULT_OVERALL_TIMEOUT_MS = 60_000;

/**
 * Summarize assertion results into a suite result.
 */
function buildSuiteResult(
  suiteType: ApiSuiteType,
  assertions: ApiAssertionResult[],
  startedAt: Date,
  metadata?: Record<string, unknown>,
): ApiSuiteResult {
  const completedAt = new Date();
  const passed = assertions.filter(a => a.status === 'passed').length;
  const failed = assertions.filter(a => a.status === 'failed').length;
  const skipped = assertions.filter(a => a.status === 'skipped').length;
  const errored = assertions.filter(a => a.status === 'error').length;

  const hasFailures = failed > 0 || errored > 0;
  const allSkipped = assertions.length > 0 && skipped === assertions.length;

  let status: ApiSuiteResult['status'];
  if (allSkipped) {
    status = 'skipped';
  } else if (hasFailures) {
    status = 'failed';
  } else {
    status = 'passed';
  }

  return {
    suite_type: suiteType,
    status,
    assertions,
    total_assertions: assertions.length,
    passed_assertions: passed,
    failed_assertions: failed + errored,
    skipped_assertions: skipped,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: completedAt.getTime() - startedAt.getTime(),
    metadata,
  };
}

/**
 * Filter endpoints to only those participating in a given suite type.
 */
function endpointsForSuite(endpoints: ApiEndpointConfig[], suiteType: ApiSuiteType): ApiEndpointConfig[] {
  return endpoints.filter(ep => ep.suites.includes(suiteType));
}

/**
 * Run the complete API test phase for one execution.
 *
 * 1. Fetch all endpoint responses in parallel (with concurrency limit)
 * 2. Run each suite type against the collected responses
 * 3. Return structured suite results for callback to dashboard
 */
export async function runApiTests(config: ApiTestConfig): Promise<ApiSuiteResult[]> {
  const suiteResults: ApiSuiteResult[] = [];
  const overallTimeout = config.overall_timeout_ms ?? DEFAULT_OVERALL_TIMEOUT_MS;

  // Guard: no endpoints configured
  if (!config.endpoints || config.endpoints.length === 0) {
    return [{
      suite_type: 'reachability',
      status: 'skipped',
      assertions: [{
        endpoint_url: config.base_url,
        http_method: 'GET',
        assertion_name: 'no_endpoints_configured',
        status: 'skipped',
        error_message: 'No API endpoints configured for this site — skipping API tests',
      }],
      total_assertions: 1,
      passed_assertions: 0,
      failed_assertions: 0,
      skipped_assertions: 1,
      started_at: new Date(),
      completed_at: new Date(),
      duration_ms: 0,
      metadata: { reason: 'no_endpoints' },
    }];
  }

  // Separate auth-required endpoints (skip if no auth provided)
  const endpointsToTest = config.endpoints.filter(ep => {
    if (ep.requires_auth && !config.auth_header) {
      return false; // Will be added as skipped assertions
    }
    return true;
  });

  const skippedAuthEndpoints = config.endpoints.filter(
    ep => ep.requires_auth && !config.auth_header,
  );

  // Build client options
  const clientOptions: ClientOptions = {
    base_url: config.base_url,
    default_timeout_ms: Math.min(10_000, overallTimeout / 2),
    max_retries: 2,
    retry_delay_ms: 1_000,
    auth_header: config.auth_header,
  };

  // Fetch all responses
  const responses = await executeAllRequests(endpointsToTest, clientOptions);

  // ─── Reachability Suite ────────────────────────────────────────────────────

  const reachabilityEndpoints = endpointsForSuite(config.endpoints, 'reachability');
  if (reachabilityEndpoints.length > 0) {
    const startedAt = new Date();
    const assertions = assertReachability(reachabilityEndpoints, responses);

    // Add skipped assertions for auth-required endpoints without auth
    for (const ep of skippedAuthEndpoints.filter(e => e.suites.includes('reachability'))) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_reachable`,
        status: 'skipped',
        error_message: 'Endpoint requires auth but no auth_header provided — skipping',
        detail: { endpoint_id: ep.id },
      });
    }

    suiteResults.push(buildSuiteResult('reachability', assertions, startedAt, {
      endpoints_tested: reachabilityEndpoints.length,
      endpoints_skipped_auth: skippedAuthEndpoints.filter(e => e.suites.includes('reachability')).length,
    }));
  }

  // ─── Schema Validation Suite ───────────────────────────────────────────────

  const schemaEndpoints = endpointsForSuite(config.endpoints, 'schema');
  if (schemaEndpoints.length > 0) {
    const startedAt = new Date();
    const assertions = assertSchemas(schemaEndpoints, responses);

    for (const ep of skippedAuthEndpoints.filter(e => e.suites.includes('schema'))) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_schema_valid`,
        status: 'skipped',
        error_message: 'Endpoint requires auth — skipping schema validation',
        detail: { endpoint_id: ep.id },
      });
    }

    suiteResults.push(buildSuiteResult('schema', assertions, startedAt, {
      endpoints_tested: schemaEndpoints.length,
    }));
  }

  // ─── Business Rules Suite ──────────────────────────────────────────────────

  const bizRuleEndpoints = endpointsForSuite(config.endpoints, 'business_rules');
  if (bizRuleEndpoints.length > 0) {
    const startedAt = new Date();
    const assertions = assertBusinessRules(bizRuleEndpoints, responses, config.rules);

    for (const ep of skippedAuthEndpoints.filter(e => e.suites.includes('business_rules'))) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_business_rules`,
        status: 'skipped',
        error_message: 'Endpoint requires auth — skipping business rule validation',
        detail: { endpoint_id: ep.id },
      });
    }

    suiteResults.push(buildSuiteResult('business_rules', assertions, startedAt, {
      endpoints_tested: bizRuleEndpoints.length,
      rules_site: config.rules.site_id,
    }));
  }

  // ─── Cross-Validation Suite ────────────────────────────────────────────────

  const crossValEndpoints = endpointsForSuite(config.endpoints, 'cross_validation');
  if (crossValEndpoints.length > 0) {
    const startedAt = new Date();
    const assertions = assertCrossValidation(crossValEndpoints, responses, config.browser_state);

    for (const ep of skippedAuthEndpoints.filter(e => e.suites.includes('cross_validation'))) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_cross_validation`,
        status: 'skipped',
        error_message: 'Endpoint requires auth — skipping cross-validation',
        detail: { endpoint_id: ep.id },
      });
    }

    suiteResults.push(buildSuiteResult('cross_validation', assertions, startedAt, {
      endpoints_tested: crossValEndpoints.length,
      browser_state_available: !!config.browser_state,
    }));
  }

  return suiteResults;
}
