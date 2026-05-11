/**
 * Phase 6: API Testing Layer — HTTP Client
 *
 * Thin wrapper around Node fetch with:
 * - Configurable timeout (per-request and global)
 * - Retry logic (configurable attempts and delay)
 * - Response time measurement
 * - Auth header injection
 * - Structured response capture
 */

import type { ApiEndpointConfig, ApiResponse } from './types.js';

export interface ClientOptions {
  /** Base URL to prefix relative paths */
  base_url: string;
  /** Default timeout per request in ms (default: 10_000) */
  default_timeout_ms?: number;
  /** Maximum retry attempts for transient failures (default: 1, i.e., no retry) */
  max_retries?: number;
  /** Delay between retries in ms (default: 1_000) */
  retry_delay_ms?: number;
  /** Auth header value (e.g., 'Bearer <token>') — injected into all requests unless overridden */
  auth_header?: string;
  /** Additional default headers */
  default_headers?: Record<string, string>;
}

const TRANSIENT_STATUS_CODES = new Set([408, 429, 502, 503, 504]);

/**
 * Build the full URL from base + endpoint path.
 * Handles both absolute URLs and relative paths.
 */
function resolveUrl(base: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Execute a single HTTP request for an API endpoint.
 */
export async function executeRequest(
  endpoint: ApiEndpointConfig,
  options: ClientOptions,
): Promise<ApiResponse> {
  const url = resolveUrl(options.base_url, endpoint.url);
  const timeout = endpoint.timeout_ms ?? options.default_timeout_ms ?? 10_000;
  const maxRetries = options.max_retries ?? 1;
  const retryDelay = options.retry_delay_ms ?? 1_000;

  // Merge headers: defaults < endpoint-specific < auth
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...options.default_headers,
    ...endpoint.headers,
  };
  if (options.auth_header && !endpoint.headers?.['Authorization']) {
    headers['Authorization'] = options.auth_header;
  }

  // Add Content-Type for methods with a body
  if (endpoint.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const startTime = performance.now();

    try {
      const fetchOptions: RequestInit = {
        method: endpoint.method ?? 'GET',
        headers,
        signal: controller.signal,
      };

      if (endpoint.body !== undefined) {
        fetchOptions.body = typeof endpoint.body === 'string'
          ? endpoint.body
          : JSON.stringify(endpoint.body);
      }

      const response = await fetch(url, fetchOptions);
      const responseTime = Math.round(performance.now() - startTime);

      // Read body as text first, then try to parse as JSON
      const bodyText = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }

      // Collect response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const result: ApiResponse = {
        endpoint_id: endpoint.id,
        url,
        method: endpoint.method ?? 'GET',
        status: response.status,
        status_text: response.statusText,
        headers: responseHeaders,
        body,
        body_text: bodyText.slice(0, 10_000), // Cap for storage
        response_time_ms: responseTime,
      };

      // Retry on transient HTTP errors
      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < maxRetries - 1) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        await sleep(retryDelay);
        continue;
      }

      return result;
    } catch (err) {
      const responseTime = Math.round(performance.now() - startTime);
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort (timeout) or non-transient errors on last attempt
      if (attempt >= maxRetries - 1 || controller.signal.aborted) {
        return {
          endpoint_id: endpoint.id,
          url,
          method: endpoint.method ?? 'GET',
          status: 0,
          status_text: 'Error',
          headers: {},
          body: null,
          body_text: '',
          response_time_ms: responseTime,
          error: controller.signal.aborted
            ? `Request timed out after ${timeout}ms`
            : lastError.message,
        };
      }

      await sleep(retryDelay);
    } finally {
      clearTimeout(timer);
    }
  }

  // Should not reach here, but safety net
  return {
    endpoint_id: endpoint.id,
    url: resolveUrl(options.base_url, endpoint.url),
    method: endpoint.method ?? 'GET',
    status: 0,
    status_text: 'Error',
    headers: {},
    body: null,
    body_text: '',
    response_time_ms: 0,
    error: lastError?.message ?? 'Unknown error after retries',
  };
}

/**
 * Execute requests for all endpoints, respecting optional concurrency limit.
 */
export async function executeAllRequests(
  endpoints: ApiEndpointConfig[],
  options: ClientOptions,
  concurrency = 4,
): Promise<Map<string, ApiResponse>> {
  const results = new Map<string, ApiResponse>();

  // Process in batches for concurrency control
  for (let i = 0; i < endpoints.length; i += concurrency) {
    const batch = endpoints.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(ep => executeRequest(ep, options)),
    );
    for (const result of batchResults) {
      results.set(result.endpoint_id, result);
    }
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
