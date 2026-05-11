/**
 * Site API Endpoints: Yugal Kunj QA Portal
 *
 * Generic/stubbed endpoint definitions for the API testing layer (Phase 6).
 * Since the Yugal Kunj portal is a React SPA and its backend API surface
 * is not yet fully documented, these endpoints are defined as reasonable
 * stubs based on common booking/registration patterns.
 *
 * In Phase 8, the local LLM will observe network traffic during browser flows
 * and dynamically generate additional endpoint configs for each run.
 * Those LLM-generated endpoints will be logged and saved for reuse.
 *
 * To add endpoints after LLM discovery:
 * 1. LLM generates ApiEndpointConfig[] from observed XHR/fetch calls
 * 2. Runner merges them with these manual definitions (manual takes precedence)
 * 3. Results are stored with source='llm_generated' for audit trail
 */

import type { ApiEndpointConfig } from '@qa-platform/api-testing';

export const apiEndpoints: ApiEndpointConfig[] = [
  // ─── Health / Reachability ───────────────────────────────────────────────

  {
    id: 'site_root',
    url: '/',
    method: 'GET',
    suites: ['reachability'],
    expected_status: 200,
    timeout_ms: 15_000,
    description: 'Main SPA entry point — verifies the site loads (returns HTML)',
    source: 'manual',
  },

  // ─── Camp / Session Listing ────────────────────────────────────────────

  // Stub: the actual API path will be discovered via network observation.
  // Common patterns for React SPAs backed by .NET or Node APIs:
  //   /api/camps, /api/sessions, /api/events, /api/programs
  {
    id: 'camps_list',
    url: '/api/camps',
    method: 'GET',
    suites: ['reachability', 'schema', 'business_rules'],
    expected_status: 200,
    timeout_ms: 10_000,
    response_fields: [
      { name: 'data', type: 'array', required: false, children: [
        { name: 'id', type: 'number', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'description', type: 'string', required: false },
        { name: 'start_date', type: 'string', required: false },
        { name: 'end_date', type: 'string', required: false },
        { name: 'capacity', type: 'number', required: false },
        { name: 'available_spots', type: 'number', required: false },
      ]},
    ],
    business_rule_checks: ['capacity'],
    description: 'Camp/session listing — stub, will be replaced by LLM-discovered path',
    source: 'manual',
  },

  // ─── Registration Verification ─────────────────────────────────────────

  // Stub: after a registration browser flow, this endpoint would be used
  // to verify the registration exists in the backend.
  {
    id: 'registration_status',
    url: '/api/registrations/{id}',
    method: 'GET',
    suites: ['schema', 'cross_validation'],
    expected_status: 200,
    timeout_ms: 10_000,
    requires_auth: true,
    response_fields: [
      { name: 'id', type: 'number', required: true },
      { name: 'confirmation_id', type: 'string', required: false },
      { name: 'email', type: 'string', required: true },
      { name: 'name', type: 'string', required: false },
      { name: 'status', type: 'string', required: true },
      { name: 'attendee_count', type: 'number', required: false },
      { name: 'camp_name', type: 'string', required: false },
    ],
    business_rule_checks: ['registration', 'capacity', 'age_restriction'],
    description: 'Registration detail — requires auth, will be discovered by LLM',
    source: 'manual',
  },

  // ─── Payment / Order Verification ──────────────────────────────────────

  {
    id: 'order_status',
    url: '/api/orders/{id}',
    method: 'GET',
    suites: ['schema', 'cross_validation'],
    expected_status: 200,
    timeout_ms: 10_000,
    requires_auth: true,
    response_fields: [
      { name: 'id', type: 'number', required: true },
      { name: 'total', type: 'number', required: true },
      { name: 'payment_status', type: 'string', required: true },
      { name: 'payment_method', type: 'string', required: false },
      { name: 'confirmation_id', type: 'string', required: false },
    ],
    business_rule_checks: ['payment'],
    description: 'Order/payment status — requires auth, will be discovered by LLM',
    source: 'manual',
  },
];

export default apiEndpoints;
