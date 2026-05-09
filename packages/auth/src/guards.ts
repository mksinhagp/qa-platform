// Server-action and route-handler guards for auth and capability checks
// These should be used in Next.js server actions and API route handlers

import { validateSession } from './sessions';
import { hasCapability } from './capabilities';

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
  request: Request
): Promise<AuthContext> {
  const sessionToken = request.headers.get('x-session-token');

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
  request: Request,
  capabilityName: string
): Promise<AuthContext> {
  const authContext = await requireOperator(request);

  const hasCap = await hasCapability(authContext.operatorId, capabilityName);

  if (!hasCap) {
    throw new ForbiddenError(
      `Operator lacks required capability: ${capabilityName}`
    );
  }

  return authContext;
}

/**
 * Require any of the specified capabilities
 * Returns operator context or throws UnauthorizedError/ForbiddenError
 */
export async function requireAnyCapability(
  request: Request,
  capabilityNames: string[]
): Promise<AuthContext> {
  const authContext = await requireOperator(request);

  // Check each capability (could be optimized with a single proc call)
  for (const cap of capabilityNames) {
    if (await hasCapability(authContext.operatorId, cap)) {
      return authContext;
    }
  }

  throw new ForbiddenError(
    `Operator lacks required capabilities: ${capabilityNames.join(', ')}`
  );
}
