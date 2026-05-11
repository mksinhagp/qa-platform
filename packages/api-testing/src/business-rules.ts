/**
 * Phase 6: API Testing Layer — Business Rules Assertions
 *
 * Validates API responses against the site's SiteRules definitions.
 * Each rule category (capacity, payment, coupon, cancellation, age_restriction, registration)
 * maps to a set of assertions that check API responses for rule compliance.
 *
 * This module is generic — it reads the SiteRules and applies relevant checks
 * to any endpoint tagged with business_rule_checks in its config.
 */

import type { SiteRules } from '@qa-platform/rules';
import type { ApiEndpointConfig, ApiResponse, ApiAssertionResult } from './types.js';

// ─── Rule Check Registry ─────────────────────────────────────────────────────

type RuleChecker = (
  endpoint: ApiEndpointConfig,
  response: ApiResponse,
  rules: SiteRules,
) => ApiAssertionResult[];

const ruleCheckers = new Map<string, RuleChecker>();

/**
 * Register a rule checker function for a business rule category.
 */
function registerRuleChecker(category: string, checker: RuleChecker): void {
  ruleCheckers.set(category, checker);
}

// ─── Capacity Rules ──────────────────────────────────────────────────────────

registerRuleChecker('capacity', (endpoint, response, rules) => {
  const assertions: ApiAssertionResult[] = [];
  const capacity = rules.capacity;
  if (!capacity) return assertions;

  const body = response.body as Record<string, unknown> | unknown[] | null;
  if (!body) return assertions;

  // Check if response is an array (list of items) — verify count constraints
  if (Array.isArray(body)) {
    // Verify max_attendees_per_booking in any returned booking data
    if (capacity.max_attendees_per_booking) {
      for (let i = 0; i < body.length; i++) {
        const item = body[i] as Record<string, unknown>;
        const attendeeCount = item.attendee_count ?? item.attendees ?? item.num_attendees;
        if (typeof attendeeCount === 'number' && attendeeCount > capacity.max_attendees_per_booking) {
          assertions.push({
            endpoint_url: response.url,
            http_method: response.method,
            assertion_name: `${endpoint.id}_capacity_max_attendees[${i}]`,
            status: 'failed',
            expected_value: `<= ${capacity.max_attendees_per_booking}`,
            actual_value: String(attendeeCount),
            response_status: response.status,
            response_time_ms: response.response_time_ms,
            error_message: `Item[${i}] has ${attendeeCount} attendees, exceeds max ${capacity.max_attendees_per_booking}`,
            detail: { endpoint_id: endpoint.id, item_index: i },
          });
        }
      }
    }
  }

  // Check waitlist flag if present in response
  if (typeof body === 'object' && !Array.isArray(body)) {
    const waitlistActive = (body as Record<string, unknown>).waitlist_active
      ?? (body as Record<string, unknown>).is_waitlisted;
    if (typeof waitlistActive === 'boolean' && waitlistActive && !capacity.waitlist_enabled) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_capacity_waitlist_disabled`,
        status: 'failed',
        expected_value: 'waitlist_enabled: false',
        actual_value: 'waitlist is active',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: 'Waitlist is active but rules specify waitlist_enabled=false',
        detail: { endpoint_id: endpoint.id },
      });
    }
  }

  // If we checked something and found no violations, mark as passed
  if (assertions.length === 0) {
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${endpoint.id}_capacity_rules`,
      status: 'passed',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      detail: { endpoint_id: endpoint.id, rules_checked: ['max_attendees_per_booking', 'waitlist_enabled'] },
    });
  }

  return assertions;
});

// ─── Payment Rules ───────────────────────────────────────────────────────────

registerRuleChecker('payment', (endpoint, response, rules) => {
  const assertions: ApiAssertionResult[] = [];
  const payment = rules.payment;
  if (!payment) return assertions;

  const body = response.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return assertions;

  // Check accepted payment methods
  if (payment.accepted_methods && body.payment_method) {
    const method = String(body.payment_method).toLowerCase();
    const accepted = payment.accepted_methods.map(m => m.toLowerCase());
    if (!accepted.includes(method)) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_payment_method_accepted`,
        status: 'failed',
        expected_value: `one of: ${accepted.join(', ')}`,
        actual_value: method,
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Payment method "${method}" not in accepted methods: ${accepted.join(', ')}`,
        detail: { endpoint_id: endpoint.id },
      });
    }
  }

  // Check partial payment flag
  if (body.partial_payment !== undefined) {
    const partial = Boolean(body.partial_payment);
    if (partial && !payment.partial_payment_allowed) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_payment_partial_not_allowed`,
        status: 'failed',
        expected_value: 'partial_payment_allowed: false',
        actual_value: 'partial payment present',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: 'Partial payment present but rules disallow partial payments',
        detail: { endpoint_id: endpoint.id },
      });
    }
  }

  if (assertions.length === 0) {
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${endpoint.id}_payment_rules`,
      status: 'passed',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      detail: { endpoint_id: endpoint.id, rules_checked: ['accepted_methods', 'partial_payment_allowed'] },
    });
  }

  return assertions;
});

// ─── Age Restriction Rules ───────────────────────────────────────────────────

registerRuleChecker('age_restriction', (endpoint, response, rules) => {
  const assertions: ApiAssertionResult[] = [];
  const ageRules = rules.age_restriction;
  if (!ageRules) return assertions;

  const body = response.body;
  const items = Array.isArray(body) ? body : [body];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object') continue;

    const age = item.age ?? item.attendee_age;
    if (typeof age !== 'number') continue;

    if (ageRules.min_age !== undefined && age < ageRules.min_age) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_age_min[${i}]`,
        status: 'failed',
        expected_value: `>= ${ageRules.min_age}`,
        actual_value: String(age),
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Item[${i}] age ${age} below minimum ${ageRules.min_age}`,
        detail: { endpoint_id: endpoint.id, item_index: i },
      });
    }

    if (ageRules.max_age !== undefined && age > ageRules.max_age) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_age_max[${i}]`,
        status: 'failed',
        expected_value: `<= ${ageRules.max_age}`,
        actual_value: String(age),
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Item[${i}] age ${age} above maximum ${ageRules.max_age}`,
        detail: { endpoint_id: endpoint.id, item_index: i },
      });
    }
  }

  if (assertions.length === 0) {
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${endpoint.id}_age_restriction_rules`,
      status: 'passed',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      detail: { endpoint_id: endpoint.id, rules_checked: ['min_age', 'max_age'] },
    });
  }

  return assertions;
});

// ─── Coupon / Discount Rules ─────────────────────────────────────────────────

registerRuleChecker('coupon', (endpoint, response, rules) => {
  const assertions: ApiAssertionResult[] = [];
  const coupon = rules.coupon;
  if (!coupon) return assertions;

  const body = response.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return assertions;

  // If discount_percent is in the response, check it against max
  const discount = body.discount_percent ?? body.discount;
  if (typeof discount === 'number') {
    if (coupon.max_discount_percent !== undefined && discount > coupon.max_discount_percent) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_coupon_max_discount`,
        status: 'failed',
        expected_value: `<= ${coupon.max_discount_percent}%`,
        actual_value: `${discount}%`,
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Discount ${discount}% exceeds max ${coupon.max_discount_percent}%`,
        detail: { endpoint_id: endpoint.id },
      });
    }

    // Check sibling discount
    if (coupon.sibling_discount_percent !== undefined) {
      const siblingDiscount = body.sibling_discount ?? body.sibling_discount_percent;
      if (typeof siblingDiscount === 'number' && siblingDiscount !== coupon.sibling_discount_percent) {
        assertions.push({
          endpoint_url: response.url,
          http_method: response.method,
          assertion_name: `${endpoint.id}_coupon_sibling_discount`,
          status: 'failed',
          expected_value: `${coupon.sibling_discount_percent}%`,
          actual_value: `${siblingDiscount}%`,
          response_status: response.status,
          response_time_ms: response.response_time_ms,
          error_message: `Sibling discount ${siblingDiscount}% does not match expected ${coupon.sibling_discount_percent}%`,
          detail: { endpoint_id: endpoint.id },
        });
      }
    }
  }

  if (assertions.length === 0) {
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${endpoint.id}_coupon_rules`,
      status: 'passed',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      detail: { endpoint_id: endpoint.id, rules_checked: ['max_discount_percent', 'sibling_discount_percent'] },
    });
  }

  return assertions;
});

// ─── Cancellation Rules ──────────────────────────────────────────────────────

registerRuleChecker('cancellation', (endpoint, response, rules) => {
  const assertions: ApiAssertionResult[] = [];
  const cancel = rules.cancellation;
  if (!cancel) return assertions;

  const body = response.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return assertions;

  // Check if cancellation is allowed flag
  if (body.cancellation_allowed !== undefined) {
    const allowed = Boolean(body.cancellation_allowed);
    if (allowed !== cancel.allowed) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_cancellation_allowed`,
        status: 'failed',
        expected_value: String(cancel.allowed),
        actual_value: String(allowed),
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Cancellation allowed=${allowed} does not match rules (${cancel.allowed})`,
        detail: { endpoint_id: endpoint.id },
      });
    }
  }

  // Check refund percentage
  const refundPercent = body.refund_percent ?? body.refund_percentage;
  if (typeof refundPercent === 'number') {
    const maxRefund = Math.max(
      cancel.refund_percent_within_window ?? 100,
      cancel.refund_percent_outside_window ?? 0,
    );
    if (refundPercent > maxRefund) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_cancellation_refund_percent`,
        status: 'failed',
        expected_value: `<= ${maxRefund}%`,
        actual_value: `${refundPercent}%`,
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Refund ${refundPercent}% exceeds max allowed ${maxRefund}%`,
        detail: { endpoint_id: endpoint.id },
      });
    }
  }

  if (assertions.length === 0) {
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${endpoint.id}_cancellation_rules`,
      status: 'passed',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      detail: { endpoint_id: endpoint.id, rules_checked: ['cancellation_allowed', 'refund_percent'] },
    });
  }

  return assertions;
});

// ─── Registration Rules ──────────────────────────────────────────────────────

registerRuleChecker('registration', (endpoint, response, rules) => {
  const assertions: ApiAssertionResult[] = [];
  const reg = rules.registration;
  if (!reg) return assertions;

  const body = response.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return assertions;

  // Check max attendees per transaction
  if (reg.max_attendees_per_transaction) {
    const attendees = body.attendee_count ?? body.num_attendees ?? body.attendees;
    if (typeof attendees === 'number' && attendees > reg.max_attendees_per_transaction) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${endpoint.id}_registration_max_attendees`,
        status: 'failed',
        expected_value: `<= ${reg.max_attendees_per_transaction}`,
        actual_value: String(attendees),
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `${attendees} attendees exceeds max ${reg.max_attendees_per_transaction} per transaction`,
        detail: { endpoint_id: endpoint.id },
      });
    }
  }

  if (assertions.length === 0) {
    assertions.push({
      endpoint_url: response.url,
      http_method: response.method,
      assertion_name: `${endpoint.id}_registration_rules`,
      status: 'passed',
      response_status: response.status,
      response_time_ms: response.response_time_ms,
      detail: { endpoint_id: endpoint.id, rules_checked: ['max_attendees_per_transaction'] },
    });
  }

  return assertions;
});

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run business rule assertions for all endpoints configured with business_rule_checks.
 */
export function assertBusinessRules(
  endpoints: ApiEndpointConfig[],
  responses: Map<string, ApiResponse>,
  rules: SiteRules,
): ApiAssertionResult[] {
  const assertions: ApiAssertionResult[] = [];

  for (const ep of endpoints) {
    if (!ep.suites.includes('business_rules')) continue;
    if (!ep.business_rule_checks || ep.business_rule_checks.length === 0) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_business_rules_defined`,
        status: 'skipped',
        error_message: 'No business_rule_checks defined for this endpoint — skipping',
        detail: { endpoint_id: ep.id },
      });
      continue;
    }

    const response = responses.get(ep.id);
    if (!response) {
      assertions.push({
        endpoint_url: ep.url,
        http_method: ep.method ?? 'GET',
        assertion_name: `${ep.id}_business_rules`,
        status: 'error',
        error_message: `No response captured for endpoint "${ep.id}"`,
      });
      continue;
    }

    if (response.error) {
      assertions.push({
        endpoint_url: response.url,
        http_method: response.method,
        assertion_name: `${ep.id}_business_rules`,
        status: 'error',
        response_status: response.status,
        response_time_ms: response.response_time_ms,
        error_message: `Cannot validate business rules — request failed: ${response.error}`,
        detail: { endpoint_id: ep.id },
      });
      continue;
    }

    // Run each configured rule category
    for (const ruleCategory of ep.business_rule_checks) {
      const checker = ruleCheckers.get(ruleCategory);
      if (checker) {
        assertions.push(...checker(ep, response, rules));
      } else {
        assertions.push({
          endpoint_url: response.url,
          http_method: response.method,
          assertion_name: `${ep.id}_rule_${ruleCategory}`,
          status: 'skipped',
          error_message: `No checker registered for rule category "${ruleCategory}"`,
          detail: { endpoint_id: ep.id },
        });
      }
    }
  }

  return assertions;
}

// Export for testing
export { ruleCheckers };
