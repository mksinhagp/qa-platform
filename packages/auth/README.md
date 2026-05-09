# @qa-platform/auth

Authentication and authorization package for the QA Automation Platform.

## Features

- **Argon2id password hashing**: Configurable memory, iterations, and parallelism via environment variables
- **Session management**: Server-side sessions with idle timeout and absolute expiry
- **Capability-based RBAC**: Resolve capabilities for operators based on role assignments
- **Auth guards**: Server-action and route-handler guards for Next.js

## Usage

### Password Hashing

```typescript
import { hashPassword, verifyPassword } from '@qa-platform/auth';

// Hash a password
const hash = await hashPassword('my-password');

// Verify a password
const result = await verifyPassword('my-password', hash);
if (result.isValid) {
  // Password is correct
  if (result.needsRehash) {
    // Rehash with new parameters
  }
}
```

### Session Management

```typescript
import { createSession, validateSession, revokeSession } from '@qa-platform/auth';

// Create a session
const session = await createSession(operatorId, ipAddress, userAgent, 'system');

// Validate a session
const validation = await validateSession(session.sessionToken);
if (validation.isValid) {
  // Session is valid, use validation.operatorId
}

// Revoke a session (logout)
await revokeSession(session.sessionToken, 'operator-1');
```

### Capability Resolution

```typescript
import {
  getCapabilitiesForOperator,
  hasCapability,
  hasAnyCapability,
  hasAllCapabilities,
} from '@qa-platform/auth';

// Get all capabilities for an operator
const capabilities = await getCapabilitiesForOperator(operatorId);

// Check specific capability
const canManage = await hasCapability(operatorId, 'site.manage');

// Check if operator has any of the capabilities
const canAccess = await hasAnyCapability(operatorId, [
  'site.manage',
  'site.read',
]);

// Check if operator has all capabilities
const canFullAccess = await hasAllCapabilities(operatorId, [
  'site.manage',
  'vault.administer',
]);
```

### Auth Guards

```typescript
import {
  requireOperator,
  requireCapability,
  requireAnyCapability,
} from '@qa-platform/auth';

// In a Next.js server action or API route handler
export async function myServerAction(request: Request) {
  // Require authenticated operator
  const authContext = await requireOperator(request);
  console.log('Operator ID:', authContext.operatorId);

  // Require specific capability
  const authContext = await requireCapability(request, 'site.manage');

  // Require any of multiple capabilities
  const authContext = await requireAnyCapability(request, [
    'site.manage',
    'site.read',
  ]);
}
```

## Environment Variables

Configure Argon2id parameters via environment variables:

- `ARGON2_MEMORY`: Memory cost in MiB (default: 128)
- `ARGON2_ITERATIONS`: Time cost/iterations (default: 3)
- `ARGON2_PARALLELISM`: Parallelism factor (default: 2)
- `SESSION_IDLE_TIMEOUT_HOURS`: Session idle timeout in hours (default: 8)
- `SESSION_ABSOLUTE_TIMEOUT_DAYS`: Session absolute timeout in days (default: 30)

## Database Dependencies

This package requires the following stored procedures from Phase 1:

- `sp_operator_sessions_create`
- `sp_operator_sessions_validate`
- `sp_operator_sessions_revoke`
- `sp_capabilities_for_operator`
