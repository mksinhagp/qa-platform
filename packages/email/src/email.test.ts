/**
 * Unit tests for the @qa-platform/email package — Phase 5
 *
 * Coverage:
 *  - correlationToken: generateCorrelationToken, buildTestEmailAddress, extractCorrelationToken
 *  - assertions: runEmailAssertions — subject, body, link_extract, brand checks
 *  - delivery: waitForDelivery — delegates to fetchEmailByToken (imap.ts, mocked here)
 *  - validator: validateEmail — full pipeline with delivery mocked via imap mock
 *  - linkChecker: checkLinkReachability — uses global fetch (stubbed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCorrelationToken,
  buildTestEmailAddress,
  extractCorrelationToken,
} from './correlationToken.js';
import { runEmailAssertions } from './assertions.js';
import { checkLinkReachability } from './linkChecker.js';
import { waitForDelivery } from './delivery.js';
import { validateEmail } from './validator.js';
import type { ParsedEmail, ImapConfig } from './types.js';

// ─── Mock imap.ts so no real IMAP connections are made ───────────────────────

vi.mock('./imap.js', () => ({
  fetchEmailByToken: vi.fn(),
}));

import { fetchEmailByToken } from './imap.js';
const mockFetchEmailByToken = vi.mocked(fetchEmailByToken);

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const MOCK_IMAP_CONFIG: ImapConfig = {
  host: 'imap.example.com',
  port: 993,
  tls: true,
  user: 'qa@example.com',
  password: 'test-password',
};

const MOCK_EMAIL: ParsedEmail = {
  uid: '42',
  subject: 'Registration Confirmation - Camp 2026',
  from: 'noreply@yugalkunj.org',
  to: ['qa+testtoken@example.com'],
  date: new Date('2026-05-09T10:00:00Z'),
  textBody: 'Thank you for registering! Click here to confirm: https://yugalkunj.org/confirm/abc123',
  htmlBody: [
    '<html><body>',
    '<img src="logo.png" class="brand-logo" />',
    '<p>Thank you for registering!</p>',
    '<a href="https://yugalkunj.org/confirm/abc123">Confirm Registration</a>',
    '<footer>Yugal Kunj &copy; 2026</footer>',
    '</body></html>',
  ].join(''),
  links: ['https://yugalkunj.org/confirm/abc123'],
  attachments: [],
};

// ─── correlationToken ─────────────────────────────────────────────────────────

describe('generateCorrelationToken', () => {
  it('generates a 12-character URL-safe token', () => {
    const token = generateCorrelationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateCorrelationToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('buildTestEmailAddress', () => {
  it('inserts token as plus-suffix into simple address', () => {
    expect(buildTestEmailAddress('qa@example.com', 'abc123')).toBe('qa+abc123@example.com');
  });

  it('appends additional plus-suffix when base already has one', () => {
    expect(buildTestEmailAddress('qa+base@example.com', 'tok')).toBe('qa+base+tok@example.com');
  });

  it('throws on address with no @ character', () => {
    expect(() => buildTestEmailAddress('not-an-email', 'tok')).toThrow('Invalid email address');
  });
});

describe('extractCorrelationToken', () => {
  it('extracts the plus-suffix token', () => {
    expect(extractCorrelationToken('qa+abc123@example.com')).toBe('abc123');
  });

  it('returns last plus-segment when multiple exist', () => {
    expect(extractCorrelationToken('qa+base+tok@example.com')).toBe('tok');
  });

  it('returns null when no plus-suffix', () => {
    expect(extractCorrelationToken('qa@example.com')).toBeNull();
  });

  it('returns null for invalid address (no @)', () => {
    expect(extractCorrelationToken('not-an-email')).toBeNull();
  });
});

// ─── runEmailAssertions ───────────────────────────────────────────────────────

describe('runEmailAssertions', () => {
  describe('subject_pattern', () => {
    it('passes when subject contains the literal substring', () => {
      const [r] = runEmailAssertions(MOCK_EMAIL, { subjectPattern: 'Registration Confirmation' });
      expect(r.check_type).toBe('subject_pattern');
      expect(r.status).toBe('passed');
    });

    it('fails when subject does not contain the pattern', () => {
      const [r] = runEmailAssertions(MOCK_EMAIL, { subjectPattern: 'Payment Receipt' });
      expect(r.status).toBe('failed');
    });

    it('supports /regex/flags notation', () => {
      const [r] = runEmailAssertions(MOCK_EMAIL, { subjectPattern: '/Camp \\d{4}/i' });
      expect(r.status).toBe('passed');
    });
  });

  describe('body_pattern', () => {
    it('passes when text body contains the pattern (case-insensitive literal)', () => {
      const [r] = runEmailAssertions(MOCK_EMAIL, { bodyPattern: 'thank you for registering' });
      expect(r.check_type).toBe('body_pattern');
      expect(r.status).toBe('passed');
    });

    it('fails when body does not match', () => {
      const [r] = runEmailAssertions(MOCK_EMAIL, { bodyPattern: 'Payment declined' });
      expect(r.status).toBe('failed');
    });
  });

  describe('link_extract', () => {
    it('passes and reports count when links are present', () => {
      const [r] = runEmailAssertions(MOCK_EMAIL, { checkLinks: true });
      expect(r.check_type).toBe('link_extract');
      expect(r.status).toBe('passed');
      expect(r.detail).toMatch(/1 link/);
    });

    it('fails when no links found', () => {
      const emailNoLinks: ParsedEmail = { ...MOCK_EMAIL, links: [] };
      const [r] = runEmailAssertions(emailNoLinks, { checkLinks: true });
      expect(r.status).toBe('failed');
    });
  });

  describe('brand_logo', () => {
    it('passes when the logo selector matches an element in the HTML body', () => {
      const results = runEmailAssertions(MOCK_EMAIL, {
        brandAssertions: { logoSelector: '.brand-logo' },
      });
      const r = results.find(c => c.check_type === 'brand_logo');
      expect(r?.status).toBe('passed');
    });

    it('fails when selector has no match in HTML body', () => {
      const results = runEmailAssertions(MOCK_EMAIL, {
        brandAssertions: { logoSelector: '.non-existent-logo' },
      });
      const r = results.find(c => c.check_type === 'brand_logo');
      expect(r?.status).toBe('failed');
    });

    it('is skipped when email has no HTML body', () => {
      const emailNoHtml: ParsedEmail = { ...MOCK_EMAIL, htmlBody: null };
      const results = runEmailAssertions(emailNoHtml, {
        brandAssertions: { logoSelector: '.brand-logo' },
      });
      const r = results.find(c => c.check_type === 'brand_logo');
      expect(r?.status).toBe('skipped');
    });
  });

  describe('brand_footer', () => {
    it('passes (case-insensitive) when footer text appears in body', () => {
      const results = runEmailAssertions(MOCK_EMAIL, {
        brandAssertions: { footerText: 'yugal kunj' },
      });
      const r = results.find(c => c.check_type === 'brand_footer');
      expect(r?.status).toBe('passed');
    });

    it('fails when footer text is not present', () => {
      const results = runEmailAssertions(MOCK_EMAIL, {
        brandAssertions: { footerText: 'ACME Corp' },
      });
      const r = results.find(c => c.check_type === 'brand_footer');
      expect(r?.status).toBe('failed');
    });
  });

  it('runs all checks specified in the spec and returns one result per check', () => {
    const results = runEmailAssertions(MOCK_EMAIL, {
      subjectPattern: 'Registration',
      bodyPattern: 'confirm',
      checkLinks: true,
      brandAssertions: { logoSelector: '.brand-logo', footerText: 'Yugal Kunj' },
    });
    // subject + body + link_extract + brand_logo + brand_footer = 5
    expect(results).toHaveLength(5);
    expect(results.every(r => r.status === 'passed')).toBe(true);
  });

  it('returns an empty array when spec has no assertions', () => {
    expect(runEmailAssertions(MOCK_EMAIL, {})).toHaveLength(0);
  });
});

// ─── checkLinkReachability ────────────────────────────────────────────────────

describe('checkLinkReachability', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns passed check for 200 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 200 }) as Response,
    );
    const email: ParsedEmail = { ...MOCK_EMAIL };
    const results = await checkLinkReachability(email);
    expect(results).toHaveLength(1);
    expect(results[0].check_type).toBe('link_reachable');
    expect(results[0].status).toBe('passed');
    expect(results[0].http_status).toBe(200);
    expect(results[0].url_tested).toBe('https://yugalkunj.org/confirm/abc123');
  });

  it('returns failed check for 404 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 404 }) as Response,
    );
    const results = await checkLinkReachability(MOCK_EMAIL);
    expect(results[0].status).toBe('failed');
    expect(results[0].http_status).toBe(404);
  });

  it('returns error check on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const results = await checkLinkReachability(MOCK_EMAIL);
    expect(results[0].status).toBe('error');
    expect(results[0].detail).toMatch(/ECONNREFUSED/);
  });

  it('returns no results for email with no links', async () => {
    const emailNoLinks: ParsedEmail = { ...MOCK_EMAIL, links: [] };
    const results = await checkLinkReachability(emailNoLinks);
    expect(results).toHaveLength(0);
  });

  it('applies filter function to skip URLs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }) as Response);
    const emailMultiLink: ParsedEmail = {
      ...MOCK_EMAIL,
      links: ['https://yugalkunj.org/confirm/abc', 'https://yugalkunj.org/unsubscribe'],
    };
    // Only check the confirm link
    const results = await checkLinkReachability(emailMultiLink, url => url.includes('confirm'));
    expect(results).toHaveLength(1);
    expect(results[0].url_tested).toContain('confirm');
  });
});

// ─── waitForDelivery ──────────────────────────────────────────────────────────

describe('waitForDelivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns delivered=true immediately when email found on first poll', async () => {
    mockFetchEmailByToken.mockResolvedValueOnce(MOCK_EMAIL);

    const result = await waitForDelivery(
      MOCK_IMAP_CONFIG,
      'testtoken',
      new Date(),
      { timeoutMs: 30000, pollIntervalMs: 1000 },
    );

    expect(result.delivered).toBe(true);
    expect(result.email).toEqual(MOCK_EMAIL);
    expect(result.pollCount).toBe(1);
    expect(result.error).toBeNull();
  });

  it('returns delivered=false and error message when timed out', async () => {
    // Always return null (email not found)
    mockFetchEmailByToken.mockResolvedValue(null);

    const startedAt = new Date(Date.now() - 200); // already 200ms in the past
    const result = await waitForDelivery(
      MOCK_IMAP_CONFIG,
      'testtoken',
      startedAt,
      { timeoutMs: 1, pollIntervalMs: 9999 }, // deadline already passed
    );

    expect(result.delivered).toBe(false);
    expect(result.email).toBeNull();
    expect(result.error).toMatch(/not received/i);
  });

  it('continues polling after a transient IMAP error and succeeds', async () => {
    mockFetchEmailByToken
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockResolvedValueOnce(MOCK_EMAIL);

    const result = await waitForDelivery(
      MOCK_IMAP_CONFIG,
      'testtoken',
      new Date(),
      { timeoutMs: 30000, pollIntervalMs: 0 },
    );

    expect(result.delivered).toBe(true);
    expect(result.pollCount).toBe(2);
  });
});

// ─── validateEmail (full pipeline) ───────────────────────────────────────────

describe('validateEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns failed with only delivery check when email never arrives', async () => {
    mockFetchEmailByToken.mockResolvedValue(null);

    const startedAt = new Date(Date.now() - 200);
    const result = await validateEmail(
      MOCK_IMAP_CONFIG,
      'testtoken',
      startedAt,
      { subjectPattern: 'Registration' },
      { timeoutMs: 1, pollIntervalMs: 9999 },
    );

    expect(result.passed).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].check_type).toBe('delivery');
    expect(result.checks[0].status).toBe('failed');
  });

  it('returns passed with delivery + assertion checks when email arrives and spec passes', async () => {
    mockFetchEmailByToken.mockResolvedValueOnce(MOCK_EMAIL);

    const result = await validateEmail(
      MOCK_IMAP_CONFIG,
      'testtoken',
      new Date(),
      {
        subjectPattern: 'Registration Confirmation',
        bodyPattern: 'Thank you for registering',
      },
      { timeoutMs: 30000, pollIntervalMs: 0 },
    );

    expect(result.passed).toBe(true);
    expect(result.deliveryResult.delivered).toBe(true);
    // delivery + subject + body = 3
    expect(result.checks).toHaveLength(3);
    expect(result.checks.every(c => c.status === 'passed')).toBe(true);
  });

  it('returns failed when an assertion check fails even if delivery passed', async () => {
    mockFetchEmailByToken.mockResolvedValueOnce(MOCK_EMAIL);

    const result = await validateEmail(
      MOCK_IMAP_CONFIG,
      'testtoken',
      new Date(),
      { subjectPattern: 'Payment Receipt' }, // will not match
      { timeoutMs: 30000, pollIntervalMs: 0 },
    );

    expect(result.passed).toBe(false);
    const subjectCheck = result.checks.find(c => c.check_type === 'subject_pattern');
    expect(subjectCheck?.status).toBe('failed');
  });

  it('adds link_reachable checks when checkLinks=true and links present', async () => {
    mockFetchEmailByToken.mockResolvedValueOnce(MOCK_EMAIL);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }) as Response);

    const result = await validateEmail(
      MOCK_IMAP_CONFIG,
      'testtoken',
      new Date(),
      { checkLinks: true },
      { timeoutMs: 30000, pollIntervalMs: 0 },
    );

    const linkCheck = result.checks.find(c => c.check_type === 'link_reachable');
    expect(linkCheck).toBeDefined();
    expect(linkCheck?.status).toBe('passed');
  });

  it('adds skipped link_reachable check when checkLinks=true but email has no links', async () => {
    const emailNoLinks: ParsedEmail = { ...MOCK_EMAIL, links: [] };
    mockFetchEmailByToken.mockResolvedValueOnce(emailNoLinks);

    const result = await validateEmail(
      MOCK_IMAP_CONFIG,
      'testtoken',
      new Date(),
      { checkLinks: true },
      { timeoutMs: 30000, pollIntervalMs: 0 },
    );

    const linkReachableCheck = result.checks.find(c => c.check_type === 'link_reachable');
    expect(linkReachableCheck?.status).toBe('skipped');
  });
});
