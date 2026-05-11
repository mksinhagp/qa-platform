/**
 * Phase 6: API Testing Layer — Unit Tests
 *
 * Tests for: reachability, schema-validator, business-rules, cross-validator, client
 */

import { describe, it, expect } from 'vitest';
import type { ApiEndpointConfig, ApiResponse, BrowserCapturedState } from './types.js';
import { assertReachability } from './reachability.js';
import { assertSchemas, buildZodSchema, formatZodErrors } from './schema-validator.js';
import { assertBusinessRules } from './business-rules.js';
import { assertCrossValidation, normalize, extractPath, findApiValue, valuesMatch } from './cross-validator.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEndpoint(overrides: Partial<ApiEndpointConfig> = {}): ApiEndpointConfig {
  return {
    id: 'test_endpoint',
    url: '/api/test',
    method: 'GET',
    suites: ['reachability'],
    expected_status: 200,
    timeout_ms: 5000,
    requires_auth: false,
    source: 'manual',
    ...overrides,
  };
}

function makeResponse(overrides: Partial<ApiResponse> = {}): ApiResponse {
  return {
    endpoint_id: 'test_endpoint',
    url: 'https://example.com/api/test',
    method: 'GET',
    status: 200,
    status_text: 'OK',
    headers: { 'content-type': 'application/json' },
    body: { status: 'ok' },
    body_text: '{"status":"ok"}',
    response_time_ms: 150,
    ...overrides,
  };
}

// ─── Reachability Tests ──────────────────────────────────────────────────────

describe('assertReachability', () => {
  it('passes for a healthy endpoint with correct status', () => {
    const ep = makeEndpoint();
    const resp = makeResponse();
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertReachability([ep], responses);

    const statusAssertion = results.find(r => r.assertion_name === 'test_endpoint_status_code');
    expect(statusAssertion).toBeDefined();
    expect(statusAssertion!.status).toBe('passed');
  });

  it('fails when status code does not match expected', () => {
    const ep = makeEndpoint({ expected_status: 200 });
    const resp = makeResponse({ status: 404, status_text: 'Not Found' });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertReachability([ep], responses);

    const statusAssertion = results.find(r => r.assertion_name === 'test_endpoint_status_code');
    expect(statusAssertion!.status).toBe('failed');
    expect(statusAssertion!.expected_value).toBe('200');
    expect(statusAssertion!.actual_value).toBe('404');
  });

  it('fails when response is too slow', () => {
    const ep = makeEndpoint();
    const resp = makeResponse({ response_time_ms: 6000 });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertReachability([ep], responses, 5000);

    const timeAssertion = results.find(r => r.assertion_name === 'test_endpoint_response_time');
    expect(timeAssertion!.status).toBe('failed');
  });

  it('fails when response body is empty', () => {
    const ep = makeEndpoint();
    const resp = makeResponse({ body_text: '' });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertReachability([ep], responses);

    const bodyAssertion = results.find(r => r.assertion_name === 'test_endpoint_has_body');
    expect(bodyAssertion!.status).toBe('failed');
  });

  it('fails when there is a network error', () => {
    const ep = makeEndpoint();
    const resp = makeResponse({ status: 0, error: 'Request timed out after 5000ms' });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertReachability([ep], responses);

    const reachAssertion = results.find(r => r.assertion_name === 'test_endpoint_reachable');
    expect(reachAssertion!.status).toBe('failed');
  });

  it('skips endpoints not configured for reachability', () => {
    const ep = makeEndpoint({ suites: ['schema'] });
    const resp = makeResponse();
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertReachability([ep], responses);
    expect(results).toHaveLength(0);
  });

  it('reports error when no response is captured', () => {
    const ep = makeEndpoint();
    const responses = new Map<string, ApiResponse>();

    const results = assertReachability([ep], responses);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('error');
  });
});

// ─── Schema Validator Tests ──────────────────────────────────────────────────

describe('buildZodSchema', () => {
  it('builds a schema from simple field definitions', () => {
    const schema = buildZodSchema([
      { name: 'id', type: 'number', required: true },
      { name: 'name', type: 'string', required: true },
    ]);

    const valid = schema.safeParse({ id: 1, name: 'test' });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({ id: 'not_a_number', name: 'test' });
    expect(invalid.success).toBe(false);
  });

  it('allows optional fields to be missing', () => {
    const schema = buildZodSchema([
      { name: 'id', type: 'number', required: true },
      { name: 'description', type: 'string', required: false },
    ]);

    const result = schema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
  });

  it('validates nested objects', () => {
    const schema = buildZodSchema([
      {
        name: 'user',
        type: 'object',
        required: true,
        children: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
      },
    ]);

    const valid = schema.safeParse({ user: { name: 'Alice', age: 30 } });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({ user: { name: 'Alice' } });
    expect(invalid.success).toBe(false);
  });

  it('allows passthrough (extra fields)', () => {
    const schema = buildZodSchema([
      { name: 'id', type: 'number', required: true },
    ]);

    const result = schema.safeParse({ id: 1, extra_field: 'hello' });
    expect(result.success).toBe(true);
  });
});

describe('formatZodErrors', () => {
  it('formats errors with paths', () => {
    const schema = buildZodSchema([
      { name: 'id', type: 'number', required: true },
    ]);

    const result = schema.safeParse({ id: 'oops' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain('id');
    }
  });
});

describe('assertSchemas', () => {
  it('passes when response matches schema', () => {
    const ep = makeEndpoint({
      suites: ['schema'],
      response_fields: [
        { name: 'status', type: 'string', required: true },
      ],
    });
    const resp = makeResponse({ body: { status: 'ok' } });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertSchemas([ep], responses);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('passed');
  });

  it('fails when required field is missing', () => {
    const ep = makeEndpoint({
      suites: ['schema'],
      response_fields: [
        { name: 'id', type: 'number', required: true },
        { name: 'name', type: 'string', required: true },
      ],
    });
    const resp = makeResponse({ body: { id: 1 } });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertSchemas([ep], responses);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
  });

  it('skips endpoints without response_fields', () => {
    const ep = makeEndpoint({ suites: ['schema'] });
    const resp = makeResponse();
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertSchemas([ep], responses);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('skipped');
  });

  it('fails when body is not an object', () => {
    const ep = makeEndpoint({
      suites: ['schema'],
      response_fields: [{ name: 'id', type: 'number', required: true }],
    });
    const resp = makeResponse({ body: 'just a string' });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertSchemas([ep], responses);

    expect(results[0].status).toBe('failed');
    expect(results[0].assertion_name).toContain('json_parseable');
  });
});

// ─── Business Rules Tests ────────────────────────────────────────────────────

describe('assertBusinessRules', () => {
  const siteRules = {
    site_id: 'test-site',
    display_name: 'Test Site',
    base_url: 'https://example.com',
    capacity: {
      max_attendees_per_booking: 5,
      waitlist_enabled: false,
    },
    payment: {
      partial_payment_allowed: false,
      sandbox_mode: true,
      accepted_methods: ['card'] as ('card' | 'ach' | 'check' | 'cash')[],
    },
    age_restriction: {
      min_age: 5,
      max_age: 18,
    },
    registration: {
      require_waiver: false,
      multi_attendee_allowed: true,
      max_attendees_per_transaction: 5,
      email_confirmation_expected: true,
    },
  };

  it('passes capacity rules when within limits', () => {
    const ep = makeEndpoint({
      suites: ['business_rules'],
      business_rule_checks: ['capacity'],
    });
    const resp = makeResponse({
      body: [
        { id: 1, attendee_count: 3 },
        { id: 2, attendee_count: 5 },
      ],
    });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertBusinessRules([ep], responses, siteRules);

    expect(results.every(r => r.status === 'passed')).toBe(true);
  });

  it('fails capacity rules when attendees exceed max', () => {
    const ep = makeEndpoint({
      suites: ['business_rules'],
      business_rule_checks: ['capacity'],
    });
    const resp = makeResponse({
      body: [{ id: 1, attendee_count: 10 }],
    });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertBusinessRules([ep], responses, siteRules);

    expect(results.some(r => r.status === 'failed')).toBe(true);
  });

  it('fails payment rules when partial payment present but not allowed', () => {
    const ep = makeEndpoint({
      suites: ['business_rules'],
      business_rule_checks: ['payment'],
    });
    const resp = makeResponse({
      body: { partial_payment: true, payment_method: 'card' },
    });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertBusinessRules([ep], responses, siteRules);

    expect(results.some(r => r.status === 'failed')).toBe(true);
  });

  it('fails age restriction rules when under min age', () => {
    const ep = makeEndpoint({
      suites: ['business_rules'],
      business_rule_checks: ['age_restriction'],
    });
    const resp = makeResponse({
      body: [{ age: 3 }],
    });
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertBusinessRules([ep], responses, siteRules);

    expect(results.some(r => r.status === 'failed')).toBe(true);
  });

  it('skips when no business_rule_checks defined', () => {
    const ep = makeEndpoint({ suites: ['business_rules'] });
    const resp = makeResponse();
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertBusinessRules([ep], responses, siteRules);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('skipped');
  });
});

// ─── Cross-Validator Tests ───────────────────────────────────────────────────

describe('cross-validator helpers', () => {
  describe('normalize', () => {
    it('trims and lowercases', () => {
      expect(normalize('  Hello World  ')).toBe('hello world');
    });

    it('collapses whitespace', () => {
      expect(normalize('a   b   c')).toBe('a b c');
    });

    it('handles null/undefined', () => {
      expect(normalize(null)).toBe('');
      expect(normalize(undefined)).toBe('');
    });
  });

  describe('extractPath', () => {
    it('extracts nested values', () => {
      const obj = { a: { b: { c: 42 } } };
      expect(extractPath(obj, 'a.b.c')).toBe(42);
    });

    it('returns undefined for missing paths', () => {
      expect(extractPath({ a: 1 }, 'b.c')).toBeUndefined();
    });

    it('handles null/undefined objects', () => {
      expect(extractPath(null, 'a')).toBeUndefined();
    });
  });

  describe('findApiValue', () => {
    it('finds value at first matching path', () => {
      const body = { data: { email: 'test@example.com' } };
      const result = findApiValue(body, ['email', 'data.email']);
      expect(result).not.toBeNull();
      expect(result!.value).toBe('test@example.com');
      expect(result!.path).toBe('data.email');
    });

    it('returns null when no paths match', () => {
      const body = { name: 'test' };
      expect(findApiValue(body, ['email', 'data.email'])).toBeNull();
    });
  });

  describe('valuesMatch', () => {
    it('matches strings case-insensitively', () => {
      expect(valuesMatch('test@example.com', 'Test@Example.com')).toBe(true);
    });

    it('matches numbers', () => {
      expect(valuesMatch(42, 42)).toBe(true);
      expect(valuesMatch(42, '42')).toBe(true);
    });

    it('returns true when browser value is undefined', () => {
      expect(valuesMatch(undefined, 'anything')).toBe(true);
    });

    it('returns false when API value is null', () => {
      expect(valuesMatch('expected', null)).toBe(false);
    });
  });
});

describe('assertCrossValidation', () => {
  it('passes when browser state matches API response', () => {
    const ep = makeEndpoint({
      suites: ['cross_validation'],
    });
    const resp = makeResponse({
      body: { email: 'qa@example.com', confirmation_id: 'ABC123' },
    });
    const responses = new Map([['test_endpoint', resp]]);
    const browserState: BrowserCapturedState = {
      email_used: 'qa@example.com',
      confirmation_id: 'ABC123',
      custom: {},
    };

    const results = assertCrossValidation([ep], responses, browserState);

    const emailAssertion = results.find(r => r.assertion_name.includes('cross_email'));
    const confirmAssertion = results.find(r => r.assertion_name.includes('cross_confirmation'));
    expect(emailAssertion!.status).toBe('passed');
    expect(confirmAssertion!.status).toBe('passed');
  });

  it('fails when browser state differs from API response', () => {
    const ep = makeEndpoint({
      suites: ['cross_validation'],
    });
    const resp = makeResponse({
      body: { email: 'different@example.com' },
    });
    const responses = new Map([['test_endpoint', resp]]);
    const browserState: BrowserCapturedState = {
      email_used: 'qa@example.com',
      custom: {},
    };

    const results = assertCrossValidation([ep], responses, browserState);

    const emailAssertion = results.find(r => r.assertion_name.includes('cross_email'));
    expect(emailAssertion!.status).toBe('failed');
  });

  it('skips when no browser state provided', () => {
    const ep = makeEndpoint({ suites: ['cross_validation'] });
    const resp = makeResponse();
    const responses = new Map([['test_endpoint', resp]]);

    const results = assertCrossValidation([ep], responses);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('skipped');
  });

  it('skips assertion when API field not found in response', () => {
    const ep = makeEndpoint({ suites: ['cross_validation'] });
    const resp = makeResponse({ body: { unrelated_field: 'value' } });
    const responses = new Map([['test_endpoint', resp]]);
    const browserState: BrowserCapturedState = {
      email_used: 'qa@example.com',
      custom: {},
    };

    const results = assertCrossValidation([ep], responses, browserState);

    const emailAssertion = results.find(r => r.assertion_name.includes('cross_email'));
    expect(emailAssertion!.status).toBe('skipped');
  });
});
