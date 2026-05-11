/**
 * Site rules loader.
 * Dynamically imports a site's rules.ts from the sites/ directory,
 * validates it against SiteRulesSchema, and caches the result.
 *
 * Usage (runner or dashboard server component):
 *   const rules = await loadSiteRules('yugal-kunj');
 */

import path from 'node:path';
import { SiteRulesSchema, type SiteRules } from './schema.js';

// In development mode, cache entries expire after 30 seconds so that editing
// a site's rules.ts is reflected without a full process restart.
// In production, rules are cached indefinitely for the process lifetime.
const CACHE_TTL_MS = process.env.NODE_ENV === 'production' ? Infinity : 30_000;

interface CacheEntry {
  rules: SiteRules;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Validate siteId to prevent path traversal — only allow alphanumeric, hyphens, underscores
function validateSiteId(siteId: string): void {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(siteId)) {
    throw new Error(`Invalid site ID: "${siteId}". Must be alphanumeric (hyphens/underscores allowed).`);
  }
}

/**
 * Load and validate the rules for a given siteId.
 * Looks for <sitesRoot>/<siteId>/rules.ts (or .js after compilation).
 * Throws if the file is missing or fails schema validation.
 */
export async function loadSiteRules(
  siteId: string,
  sitesRoot = process.env.BUSINESS_RULES_PATH ?? './sites',
): Promise<SiteRules> {
  validateSiteId(siteId);
  const cached = cache.get(siteId);
  if (cached && Date.now() < cached.expiresAt) return cached.rules;

  const resolvedRoot = path.resolve(sitesRoot);
  const rulesPath = path.resolve(sitesRoot, siteId, 'rules.js');
  if (!rulesPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path traversal detected for site "${siteId}"`);
  }

  let mod: unknown;
  try {
    mod = await import(rulesPath);
  } catch {
    throw new Error(
      `Site rules not found for "${siteId}" at path "${rulesPath}". ` +
      `Create a rules.ts file in sites/${siteId}/.`,
    );
  }

  const raw = (mod as { default?: unknown; rules?: unknown }).default
    ?? (mod as { rules?: unknown }).rules
    ?? mod;

  const parsed = SiteRulesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Site rules validation failed for "${siteId}": ${parsed.error.message}`,
    );
  }

  cache.set(siteId, { rules: parsed.data, expiresAt: Date.now() + CACHE_TTL_MS });
  return parsed.data;
}

/**
 * Clear the rules cache (useful in tests).
 */
export function clearRulesCache(): void {
  cache.clear();
}
