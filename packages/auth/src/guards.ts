// Server-action and route-handler guards for auth and capability checks
// These should be used in Next.js server actions and API route handlers

import { validateSession } from './sessions';
import { hasCapability, getCapabilitiesForOperator } from './capabilities';

type CookieStore = {
  get(name: string): { value: string } | undefined;
};

export interface AuthContext {
  operatorId: number;
  sessionId: number;
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Require an authenticated operator
 * Extracts session token from request headers and validates it
 * Returns operator context or throws UnauthorizedError
 */
export async function requireOperator(
  request?: Request
): Promise<AuthContext> {
  // Try to extract session token from request headers or Next.js cookies
  let sessionToken: string | undefined | null = request?.headers.get('x-session-token');

  if (!sessionToken) {
    // Server-action path: read from Next.js cookie store
    try {
      const nextHeadersModule = 'next/headers';
      const { cookies } = (await import(nextHeadersModule)) as { cookies: () => Promise<CookieStore> };
      const cookieStore = await cookies();
      sessionToken = cookieStore.get('session_token')?.value;
    } catch {
      // Not running in a Next.js server context — ignore
    }
  }

  if (!sessionToken) {
    throw new UnauthorizedError('No session token provided');
  }

  const validation = await validateSession(sessionToken);

  if (!validation.isValid || !validation.operatorId || !validation.sessionId) {
    throw new UnauthorizedError('Invalid or expired session');
  }

  return {
    operatorId: validation.operatorId,
    sessionId: validation.sessionId,
  };
}

/**
 * Require a specific capability
 * First validates operator session, then checks capability
 * Returns operator context or throws UnauthorizedError/ForbiddenError
 */
export async function requireCapability(
  requestOrCapability: Request | string,
  capabilityName?: string
): Promise<AuthContext> {
  // Support both (request, capability) and (capability) signatures
  let request: Request | undefined;
  let capability: string;
  if (typeof requestOrCapability === 'string') {
    request = undefined;
    capability = requestOrCapability;
  } else {
    request = requestOrCapability;
    capability = capabilityName!;
  }

  const authContext = await requireOperator(request);

  const hasCap = await hasCapability(authContext.operatorId, capability);

  if (!hasCap) {
    throw new ForbiddenError(
      `Operator lacks required capability: ${capability}`
    );
  }

  return authContext;
}

/**
 * Require any of the specified capabilities
 * Returns operator context or throws UnauthorizedError/ForbiddenError
 */
export async function requireAnyCapability(
  requestOrCapabilities: Request | string[],
  capabilityNames?: string[]
): Promise<AuthContext> {
  // Support both (request, capabilities) and (capabilities) signatures
  let request: Request | undefined;
  let capabilities: string[];
  if (Array.isArray(requestOrCapabilities)) {
    request = undefined;
    capabilities = requestOrCapabilities;
  } else {
    request = requestOrCapabilities;
    capabilities = capabilityNames!;
  }

  const authContext = await requireOperator(request);

  // Check each capability (could be optimized with a single proc call)
  const allCaps = await getCapabilitiesForOperator(authContext.operatorId);
  const capabilitySet = new Set(allCaps.map((c) => c.capabilityName));
  if (capabilities.some((name) => capabilitySet.has(name))) {
    return authContext;
  }

  throw new ForbiddenError(
    `Operator lacks required capabilities: ${capabilities.join(', ')}`
  );
}
