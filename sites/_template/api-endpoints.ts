/**
 * Site API Endpoints Template
 *
 * PURPOSE
 * -------
 * These are stub endpoint definitions for the API testing layer (Phase 6).
 * Replace every REPLACE_ME URL with the actual path observed in the site's
 * network traffic.  All entries use source: 'manual' to distinguish them
 * from endpoints the Phase 8 LLM discovery layer generates automatically.
 *
 * HOW TO DISCOVER REAL ENDPOINTS
 * --------------------------------
 * 1. Open the site in Chrome DevTools → Network tab.
 * 2. Perform each key user action (browse, register, login, checkout).
 * 3. Filter by Fetch/XHR; note the request URLs and response shapes.
 * 4. Replace stub URLs below with the observed paths.
 * 5. Update response_fields to match the real JSON schema.
 *
 * Common URL patterns by backend type:
 *   REST / .NET Web API:   /api/camps, /api/registrations/{id}
 *   REST / Node/Express:   /v1/sessions, /v1/bookings
 *   GraphQL:               /graphql  (single endpoint; remove unused stubs below)
 *   Firebase / Supabase:   /rest/v1/camps?select=*
 *
 * MERGE BEHAVIOUR
 * ---------------
 * In Phase 8, the LLM observer generates additional ApiEndpointConfig[] from
 * observed XHR calls (source: 'llm_generated').  The runner merges them with
 * these manual entries; manual definitions take precedence on id collisions.
 *
 * After the LLM discovers stable endpoints, promote them to this file with
 * source: 'manual' so they persist across runs.
 */

import type { ApiEndpointConfig } from '@qa-platform/api-testing';

export const apiEndpoints: ApiEndpointConfig[] = [
  // ─── Health / Reachability ───────────────────────────────────────────────

  {
    id: 'site_root',
    // TODO: '/' works for most sites.  Change only if the site root redirects
    //       to a path that returns non-200 before the redirect resolves.
    url: '/',
    method: 'GET',
    suites: ['reachability'],
    expected_status: 200,
    timeout_ms: 15_000,
    description: 'Site root — verifies the application loads and returns HTTP 200',
    source: 'manual',
  },

  // TODO: If the site exposes a dedicated health-check endpoint, add it here:
  // {
  //   id: 'health_check',
  //   url: '/api/health',           // common: /health, /api/status, /ping
  //   method: 'GET',
  //   suites: ['reachability'],
  //   expected_status: 200,
  //   timeout_ms: 5_000,
  //   description: 'Backend health-check endpoint',
  //   source: 'manual',
  // },

  // ─── Authentication ──────────────────────────────────────────────────────
  // TODO: Replace URL with the actual login endpoint observed in network traffic.
  // Common patterns:
  //   POST /api/auth/login
  //   POST /api/account/login
  //   POST /v1/users/sign_in
  //   POST /auth/token  (OAuth2 token endpoint)

  {
    id: 'auth_login',
    url: '/api/auth/login',         // TODO: replace with observed endpoint
    method: 'POST',
    suites: ['reachability', 'schema'],
    expected_status: 200,
    timeout_ms: 10_000,
    description: 'Authentication login — verifies endpoint accepts credentials',
    source: 'manual',
  },

  // TODO: If the site has an explicit logout endpoint, add it:
  // {
  //   id: 'auth_logout',
  //   url: '/api/auth/logout',      // common: /api/account/logout, /auth/signout
  //   method: 'POST',
  //   suites: ['reachability'],
  //   expected_status: 200,
  //   requires_auth: true,
  //   timeout_ms: 5_000,
  //   description: 'Authentication logout',
  //   source: 'manual',
  // },

  // ─── Listings / Browse ───────────────────────────────────────────────────
  // TODO: Replace URL with the actual listing/catalog endpoint.
  // Common patterns:
  //   GET /api/camps
  //   GET /api/sessions
  //   GET /api/events
  //   GET /api/programs
  //   GET /v1/listings

  {
    id: 'listings_list',
    url: '/api/camps',              // TODO: replace with observed endpoint
    method: 'GET',
    suites: ['reachability', 'schema', 'business_rules'],
    expected_status: 200,
    timeout_ms: 10_000,
    response_fields: [
      // TODO: Adjust these fields to match the actual response JSON shape.
      //       Set required: true for fields the runner should always assert on.
      { name: 'data', type: 'array', required: false, children: [
        { name: 'id',               type: 'number',  required: true  },
        { name: 'name',             type: 'string',  required: true  },
        { name: 'description',      type: 'string',  required: false },
        { name: 'start_date',       type: 'string',  required: false },
        { name: 'end_date',         type: 'string',  required: false },
        { name: 'capacity',         type: 'number',  required: false },
        { name: 'available_spots',  type: 'number',  required: false },
      ]},
    ],
    business_rule_checks: ['capacity'],
    description: 'Listings/catalog endpoint — stub, replace URL after network observation',
    source: 'manual',
  },

  // ─── Registration / Booking ──────────────────────────────────────────────
  // TODO: Replace URL with the registration submission and lookup endpoints.
  // Common patterns:
  //   POST /api/registrations         (submit)
  //   GET  /api/registrations/{id}    (lookup)
  //   POST /api/bookings
  //   GET  /api/bookings/{id}

  {
    id: 'registration_status',
    url: '/api/registrations/{id}', // TODO: replace with observed endpoint; {id} is a path param
    method: 'GET',
    suites: ['schema', 'cross_validation'],
    expected_status: 200,
    timeout_ms: 10_000,
    requires_auth: true,
    response_fields: [
      // TODO: Adjust fields to match the actual response schema.
      { name: 'id',               type: 'number',  required: true  },
      { name: 'confirmation_id',  type: 'string',  required: false },
      { name: 'email',            type: 'string',  required: true  },
      { name: 'name',             type: 'string',  required: false },
      { name: 'status',           type: 'string',  required: true  },
      { name: 'attendee_count',   type: 'number',  required: false },
      { name: 'camp_name',        type: 'string',  required: false },
    ],
    business_rule_checks: ['registration', 'capacity', 'age_restriction'],
    description: 'Registration detail — requires auth; stub, replace URL after network observation',
    source: 'manual',
  },

  // ─── Payment / Order ─────────────────────────────────────────────────────
  // TODO: Replace URL with the payment/order verification endpoint.
  // Common patterns:
  //   GET /api/orders/{id}
  //   GET /api/payments/{id}
  //   GET /api/transactions/{id}

  {
    id: 'order_status',
    url: '/api/orders/{id}',        // TODO: replace with observed endpoint
    method: 'GET',
    suites: ['schema', 'cross_validation'],
    expected_status: 200,
    timeout_ms: 10_000,
    requires_auth: true,
    response_fields: [
      // TODO: Adjust fields to match the actual response schema.
      { name: 'id',               type: 'number',  required: true  },
      { name: 'total',            type: 'number',  required: true  },
      { name: 'payment_status',   type: 'string',  required: true  },
      { name: 'payment_method',   type: 'string',  required: false },
      { name: 'confirmation_id',  type: 'string',  required: false },
    ],
    business_rule_checks: ['payment'],
    description: 'Order/payment status — requires auth; stub, replace URL after network observation',
    source: 'manual',
  },

  // ─── Admin Endpoints ─────────────────────────────────────────────────────
  // TODO: Add admin API endpoints here if the site exposes them.
  //       Remove this block if admin flows are not being implemented.
  // Common patterns:
  //   GET  /api/admin/bookings
  //   GET  /api/admin/registrations
  //   PUT  /api/admin/bookings/{id}
  //   GET  /api/admin/reports/summary

  // {
  //   id: 'admin_bookings_list',
  //   url: '/api/admin/bookings',   // TODO: replace with observed endpoint
  //   method: 'GET',
  //   suites: ['reachability', 'schema'],
  //   expected_status: 200,
  //   timeout_ms: 10_000,
  //   requires_auth: true,
  //   response_fields: [
  //     { name: 'data', type: 'array', required: false },
  //   ],
  //   description: 'Admin booking list — requires admin auth',
  //   source: 'manual',
  // },
];

export default apiEndpoints;
