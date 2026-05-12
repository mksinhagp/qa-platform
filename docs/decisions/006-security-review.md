# ADR 006: Security Review

## Status

Active — Phase 10.2 baseline review. Re-run before any production deployment.

## Context

This document is a point-in-time security assessment of the QA Automation Platform covering authentication, authorization, vault cryptography, API input validation, and infrastructure. Every finding is grounded in specific file paths and line numbers in the codebase. Generic observations are excluded.

**Review scope:**
- `packages/auth/src/` — password hashing, sessions, capabilities, guards
- `packages/vault/src/` — crypto primitives, vault operations, in-memory registry
- `apps/dashboard-web/app/actions/` — server actions (auth, vault, credentials, operators, sites, runs, payment-profiles, audit)
- `apps/dashboard-web/app/api/runner/` — callback route, approval poll, email-validate route
- `docker-compose.yml`, `docker/*/Dockerfile`, `next.config.ts`, `.env.example`

---

## A. Authentication & Session Management

### A.1 Argon2id Implementation

**File:** `packages/auth/src/password.ts`

| Parameter | Configured Value | Recommendation |
|---|---|---|
| Algorithm | argon2id | Correct — winner of PHC, optimal against side-channel + GPU |
| Memory cost | 131072 KiB (128 MiB) default | Adequate. OWASP minimum is 64 MiB; 128 MiB is the higher "recommended" tier. |
| Time cost (iterations) | 3 | Adequate. OWASP minimum is 1 at 64 MiB or 2 at 19 MiB; 3 at 128 MiB is strong. |
| Parallelism | 2 | Adequate for dual-core minimum deployment. |
| Salt | Library-managed (embedded in PHC string) | Correct — argon2 library generates a 16-byte cryptographic random salt per hash automatically. |
| Output format | PHC string (`$argon2id$v=19$…`) | Correct — enables `needsRehash` to detect parameter upgrades. |

**Strengths:**
- `hashPassword` delegates salt generation entirely to the argon2 library (line 27–32), which uses OS CSPRNG. No manual salt handling that could introduce reuse bugs.
- `verifyPassword` calls `argon2.needsRehash` (line 54), enabling transparent rehash-on-login when parameters are tuned upward. This is production-quality.
- Parameters are env-configurable (`VAULT_ARGON2ID_MEMORY`, `VAULT_ARGON2ID_ITERATIONS`, `VAULT_ARGON2ID_PARALLELISM`), allowing live tuning without code changes.

**Gaps:**
1. **No password complexity enforcement at the `hashPassword` layer.** `AUTH_PASSWORD_MIN_LENGTH=8` is set in `.env.example` but is not enforced in `packages/auth/src/password.ts`. It is enforced only in the `createOperator` action layer — if any other code path creates operators (e.g., future CLI tool, seed scripts), the policy is silently bypassed.
2. **`AUTH_PASSWORD_MIN_LENGTH=8`** in `.env.example` is lower than the minimum recommended by OWASP (12 characters). The vault bootstrap correctly enforces 12 (`actions/vault.ts` line 21), but operator accounts use 8.
3. **No password-strength meter (zxcvbn or equivalent).** The vault bootstrap ADR 003 mentions a "zxcvbn strength check" but no implementation of it is present in the codebase.

**Recommendations:**
```typescript
// packages/auth/src/password.ts — add before calling argon2.hash:
const MIN_LENGTH = parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '12', 10);
if (password.length < MIN_LENGTH) {
  throw new Error(`Password must be at least ${MIN_LENGTH} characters`);
}
```
Raise `AUTH_PASSWORD_MIN_LENGTH` to 12 in `.env.example` and enforce it at the library level, not only in the action layer.

---

### A.2 Timing Attack Mitigation (Login)

**File:** `apps/dashboard-web/app/actions/auth.ts`

**Strengths:**
- Lines 24–31: A sentinel hash is lazily computed once on first login attempt (`hashPassword('__timing_safe_sentinel__')`). When the operator login is not found (line 43–46), `verifyPassword` is called against the sentinel hash, ensuring the response takes the same Argon2id compute time as a real verify. This is correct protection against username enumeration via timing.
- The sentinel hash is memoized (`sentinelHashPromise`), so after the first cold start it does not add per-request compute overhead.

**Gap:**
- The sentinel hash is computed with the **current** Argon2id parameters but may have been stored with **different** parameters. If parameters are changed mid-lifecycle the sentinel and the real verify take different times. This is minor and only affects timing for non-existent users.
- The inactive account branch (line 52–53) returns `{ success: false, error: 'Operator account is inactive' }` — a different error message than the invalid-password branch. This leaks the existence of the account. **Recommendation:** Return the same generic message for inactive accounts as for bad credentials: `'Invalid login or password'`.

---

### A.3 Session Token Entropy and Storage

**File:** `packages/auth/src/sessions.ts`

```typescript
// Line 31:
return randomBytes(32).toString('base64url');  // 256 bits of entropy
```

**Strengths:**
- 32 random bytes = 256 bits of entropy. Brute-force is computationally infeasible.
- `base64url` encoding avoids URL and cookie escaping issues.
- `httpOnly: true`, `sameSite: 'strict'` set in `auth.ts` lines 85–91. XSS cannot steal the cookie; CSRF is prevented by same-site policy.
- `secure: process.env.NODE_ENV === 'production'` — cookie is HTTPS-only in production.

**Gaps:**
1. **30-day absolute session timeout** (`AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS=2592000` in `.env.example`, sessions.ts line 47). This is unusually long for an internal admin tool. A compromised session token remains valid for a month.
2. **Session cookie `maxAge` is set to the absolute timeout** (auth.ts line 89), meaning the browser cookie survives 30 days. Idle timeout enforcement happens server-side, but the browser will keep presenting the token. If the DB is cleared without a cookie-clearing mechanism, the browser re-presents a dead token indefinitely.
3. **No session fixation protection.** On login, a fresh session token is generated (correct), but there is no mechanism to invalidate all existing sessions for a user on password change.
4. **No concurrent session limit.** A user can have unlimited simultaneous sessions (one per login). Compromised credentials result in stealth parallel sessions.

**Recommendations:**
- Reduce `AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS` to 86400 (24 hours) or 604800 (7 days) for an internal tool.
- Add `sp_operator_sessions_revoke_all` stored procedure called on password change.
- Add an optional `MAX_SESSIONS_PER_OPERATOR` env var enforced in the `sp_operator_sessions_create` stored procedure.

---

### A.4 Vault Unlock Token Lifecycle

**Files:** `packages/vault/src/registry.ts`, `packages/vault/src/vault.ts`, `apps/dashboard-web/app/actions/vault.ts`

| Property | Value | Assessment |
|---|---|---|
| Token entropy | `randomBytes(32).toString('base64url')` (256 bits) | Strong |
| Absolute TTL | `VAULT_UNLOCK_TTL_SECONDS=1800` (30 min) | Reasonable |
| Idle reset | `VAULT_UNLOCK_IDLE_RESET_SECONDS=300` (5 min) | Reasonable |
| Storage | In-process `Map<string, UnlockSession>` singleton | Risk: process restart loses all unlock state; no re-unlock prompt |
| Cookie flags | `httpOnly`, `secure` (prod), `sameSite: strict`, `maxAge: 1800` | Correct |
| RVK zeroization on expiry | `zeroize(session.rvk)` in `registry.ts` line 107 | Correct |
| Cleanup interval | Every 60 seconds (`registry.ts` line 26) | Correct |

**Gaps:**
1. **Unlock token is tied to a session but not cryptographically bound to it.** `registry.get(unlockToken)` only checks the token; it does not re-verify the operator session is still valid. A stolen `unlock_token` cookie could be used independently of the `session_token` cookie for up to 30 minutes.
2. **`email-validate/route.ts` line 88** reads the `unlock_token` cookie inside an API route handler called by the runner, not by an operator browser. This means the route requires the vault to be unlocked at the time the runner calls back. If the vault lock/idle timeout fires during a long test run, email validation will fail with 503. The design creates a coupling between vault lock state and runner callback success.
3. **No alerting on RVK residency duration.** If cleanup fails (process freeze), RVK can persist beyond TTL until the next GC cycle.

**Recommendation:**
- Add operator session re-validation inside `registry.get()` or in `withUnlocked()`:
```typescript
// vault.ts — in withUnlocked(), after registry.get():
const { validateSession } = await import('@qa-platform/auth');
const sessionCheck = await validateSession(session.operatorSessionToken);
if (!sessionCheck.isValid) {
  registry.remove(unlockToken);
  throw new Error('Operator session expired — vault re-lock required');
}
```
- Store `operatorSessionToken` in `UnlockSession` to enable this check.

---

## B. Authorization & RBAC

### B.1 Capability Model

**File:** `packages/auth/src/capabilities.ts`, `packages/auth/src/guards.ts`

**Design:** Flat capability strings resolved through role assignments via `sp_capabilities_for_operator`. The guard layer (`requireCapability`, `requireOperator`, `requireAnyCapability`) enforces auth before every server action.

**Capabilities observed in use across server actions:**

| Capability | Used In |
|---|---|
| `operator.manage` | `actions/operators.ts` — all CRUD |
| `site_credentials.manage` | `actions/credentials.ts`, `actions/payment-profiles.ts` |
| `secret.reveal` | `actions/credentials.ts` — `getCredentialWithValue` only |
| `run.execute` | `actions/runs.ts` — create run, list personas/devices/networks |
| `run.read` | `actions/runs.ts` — list/get runs |

**Strengths:**
- `getCredentialWithValue` (credentials.ts line 141) requires the more restrictive `secret.reveal` capability rather than the general `site_credentials.manage`. Correct principle of least privilege.
- All write actions verify capability before calling stored procedures — no bypasses via direct DB access.
- Capability resolution is done server-side via `sp_capabilities_for_operator`; capability names are never trusted from the client.

**Gaps:**
1. **`getCapabilitiesForOperator` fetches the full capability list on every call** (capabilities.ts lines 18–31). `requireCapability` then calls this for every server action invocation. With no caching, this is one extra DB round-trip per action. Under high-concurrency this can accumulate, and more importantly, it is a potential target for DoS (flood actions → flood DB with capability queries).
2. **`hasCapability` uses string equality** (capabilities.ts line 42: `c.capabilityName === capabilityName`). A typo in a capability name silently grants access (no capability = permission denied, but a wrong capability check never throws a warning). No compile-time capability registry exists.
3. **`listSites`, `getSite`, `listSiteEnvironments`, `getSiteEnvironment`** in `sites.ts` use only `requireOperator()` (any authenticated user) rather than a specific read capability. Any operator can enumerate all sites and environments regardless of role.
4. **`getVaultStateAction`** (vault.ts line 157–167) calls `getVaultState()` with **no auth check**. Any unauthenticated caller invoking this server action receives vault bootstrap status, KDF parameters, and bootstrap operator ID. Because this is a Next.js server action, it is only callable server-side by default, but the pattern is still a risk if the action is ever exposed differently.
5. **`queryAuditLogs`** (audit.ts line 54) requires only `requireOperator()` — any authenticated user can query all audit logs including other operators' actions.
6. **No ownership/scope check on credential/payment-profile access.** Any operator with `site_credentials.manage` can read any credential for any site. There is no site-scoped authorization (e.g., operator A restricted to site 1 cannot see site 2 credentials).

**Recommendations:**
- Add a compile-time capability registry:
```typescript
// packages/auth/src/capabilities.ts
export const CAPABILITIES = {
  OPERATOR_MANAGE: 'operator.manage',
  SECRET_REVEAL: 'secret.reveal',
  SITE_CREDENTIALS_MANAGE: 'site_credentials.manage',
  RUN_EXECUTE: 'run.execute',
  RUN_READ: 'run.read',
  AUDIT_READ: 'audit.read',
  VAULT_ADMIN: 'vault.admin',
} as const;
```
- Add short-lived in-process capability cache (TTL 30s) keyed by `operatorId`.
- Add `requireCapability(CAPABILITIES.AUDIT_READ)` to `queryAuditLogs`.
- Add an auth check to `getVaultStateAction`.
- Add a `site.read` capability and gate `listSites`/`getSite` behind it.

---

### B.2 Route Protection Coverage

**Runner API routes** (`/api/runner/callback`, `/api/runner/approvals/[id]/poll`, `/api/runner/email-validate`) use a **one-time callback token** per execution (`x-runner-token` header) validated against `run_executions.callback_token` via stored procedure. This is correct — the runner does not use operator sessions.

**Gap:** There is no Next.js middleware file (`middleware.ts` — confirmed absent via filesystem search). Route protection relies entirely on each individual server action or API route calling `requireOperator()` / `requireCapability()` explicitly. A future developer who forgets the guard call will create an unprotected endpoint with no framework-level safety net.

**Recommendation:** Add a Next.js `middleware.ts` at the app root that redirects unauthenticated requests away from `/dashboard/**` routes to `/login`. This is a defense-in-depth layer — it does not replace action-level guards but catches routes that lack them.

```typescript
// apps/dashboard-web/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token');
  if (!sessionToken && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

---

## C. Vault & Cryptography

### C.1 AES-256-GCM Implementation

**File:** `packages/vault/src/crypto.ts`

**Strengths:**
- Nonce generation: `randomBytes(12)` (line 61) — correct 96-bit GCM nonce, per NIST SP 800-38D recommendation.
- Separate nonces for payload encryption and DEK wrapping (vault.ts lines 261–263: `nonce` and `wrapNonce`). Correctly avoids nonce reuse between the two AES-GCM operations under the same key.
- AAD is consistently applied: `'qa-platform-vault-v1'` for bootstrap/unlock, `'qa-platform-secret-v1'` for per-secret operations. This provides domain separation — a ciphertext from one context cannot be replayed in another.
- Auth tag is appended to ciphertext (lines 86, 113) and split correctly on decrypt (lines 102–103). Tag length is the GCM default 16 bytes.
- `decryptSecret` with wrong key or tampered ciphertext raises an exception (AES-GCM authentication failure), which is caught and surfaces as a vault error. Ciphertext tampering is detectable.

**Gaps:**
1. **Nonce reuse risk is theoretically present but practically mitigated.** Each encrypt call generates a fresh 12-byte random nonce. With 2^96 possible nonces and 32-bit birthday bound, the probability of collision over typical secret volumes is negligible. However, there is no nonce uniqueness enforcement at the storage layer (no unique constraint on `nonce` in `secret_records`). A bug that reuses a nonce under the same DEK would silently succeed. **Recommendation:** Add a DB-layer unique constraint on `(wrapped_dek, nonce)` in the `secret_records` table.
2. **`wrapKey` / `unwrapKey` are thin wrappers over `encrypt` / `decrypt`** (crypto.ts lines 120–139). There is no explicit "AES Key Wrap" (RFC 3394) — envelope encryption is done with AES-GCM directly. This is acceptable and common, but documents should be explicit that this deviates from NIST AES Key Wrap.
3. **`aadOverride` parameter in `decryptSecret`** (vault.ts line 287). If a caller passes the wrong AAD, decryption fails (which is correct). However, the optional nature of `aadOverride` means a caller could omit it and fall through to the default `'qa-platform-secret-v1'` string — which matches the write path. This is safe today but could mask a bug if AAD is ever made per-secret-variable.
4. **Key material (`rvk`) passed as a plain `Buffer` parameter** into the `callback` in `withUnlocked`. If the callback throws an unhandled exception mid-use, the RVK reference escapes into the exception stack trace on some runtimes. The `finally` block does not zeroize (intentionally — vault.ts line 247 comment). This is acceptable because `registry.remove()` handles zeroization on session expiry.
5. **`crypto` is dynamically imported inside `encrypt`/`decrypt`** (lines 74, 99: `const crypto = await import('crypto')`). This is unnecessary for Node.js's built-in `crypto` module — it creates a microtask allocation per encrypt/decrypt call. The module should be statically imported at the top of the file.

### C.2 Argon2id KDF Parameters (Vault)

**File:** `packages/vault/src/crypto.ts`, `deriveKEK` (lines 19–41)

| Parameter | Default | Assessment |
|---|---|---|
| Memory | 128 MiB | Strong — above OWASP 64 MiB recommendation |
| Iterations | 3 | Strong — OWASP minimum at this memory is 1 |
| Parallelism | 2 | Adequate |
| Salt length | 16 bytes (128 bits) | Adequate — OWASP minimum is 16 bytes |
| Output length | 32 bytes (256-bit KEK) | Correct for AES-256 |

The vault uses `raw: true` (line 36) to extract raw bytes directly rather than the PHC hash string — correct for use as a key, not a stored hash.

**Gap:** The KDF parameters used to derive the KEK at bootstrap time are stored in the `vault_state` table and retrieved at unlock time (vault.ts line 64, `row.o_kdf_memory`). If an admin lowers the env-var parameters without bootstrapping a new vault, the stored params are used for unlock (correct) but `hashPassword` for operator logins uses the current env-var params. This parameter split is correct in design but must be documented operationally.

### C.3 Key Material Lifecycle

**File:** `packages/vault/src/registry.ts`, `packages/vault/src/vault.ts`

| Key | Created | Stored | Zeroized |
|---|---|---|---|
| RVK | bootstrap → `generateRVK()` | In-memory registry only | On `registry.remove()` → `zeroize(session.rvk)` |
| KEK | unlock → `deriveKEK()` | Never persisted | Immediately after unwrap (vault.ts lines 174–175) |
| DEK | per-secret → `generateDEK()` | Wrapped form in DB | In `encryptSecret` (line 272), in `decryptSecret` finally block (line 301) |

**Strengths:**
- KEK is zeroized immediately after unwrapping RVK (vault.ts line 175) — minimum exposure window.
- DEK is zeroized in a `finally` block, ensuring cleanup even on exception (vault.ts lines 295–301).
- RVK is zeroized via `buffer.fill(0)` on session removal (crypto.ts line 146).

**Gap:**
- **`zeroize` (crypto.ts line 145) uses `buffer.fill(0)`**, which Node.js/V8 may optimize away if the buffer is not read again. True cryptographic zeroization requires a memory barrier. In practice, Node.js does not provide a guaranteed secure erase primitive; this is a known limitation of the JavaScript runtime environment. Document this explicitly.
- **No vault master-password recovery mechanism.** Loss of master password = permanent data loss. This is noted as a known negative in ADR 003, but there is no documented break-glass procedure (e.g., operator contacts infrastructure team to re-bootstrap from a cold DB).

---

## D. API & Input Validation

### D.1 Server Action Input Validation

Input validation coverage is inconsistent across server actions:

| Action File | Validation Method | Coverage |
|---|---|---|
| `actions/sites.ts` | Zod schemas (`siteSchema`, `siteUpdateSchema`, `siteEnvironmentSchema`) | Strong — URL, length, type |
| `actions/runs.ts` | Zod schemas (`createRunSchema`, `runConfigSchema`) | Strong — enum, array, length |
| `actions/credentials.ts` | None — raw `CreateCredentialInput` interface only | **Gap** |
| `actions/operators.ts` | None — raw `CreateOperatorInput` / `UpdateOperatorInput` only | **Gap** |
| `actions/payment-profiles.ts` | None — raw `CreatePaymentProfileInput` only | **Gap** |
| `actions/vault.ts` | Minimal — only `masterPassword.length < 12` and equality check | Partial |
| `api/runner/callback/route.ts` | Zod schemas for `api_test_result`, `admin_test_result`, `llm_analysis_result` | Strong — but `execution_result` type is not Zod-validated (manual field casting at lines 153–158) |

**Gaps:**
1. **`createOperator` / `updateOperator`** accept arbitrary strings for `login`, `email`, and `full_name` with no length limits or format validation. A malformed email does not fail. An extremely long login string could produce unexpected behavior at the DB layer.
2. **`createCredential`** accepts `credential_value` of unlimited length. The plaintext is encrypted and stored, but no upper bound is enforced (could lead to oversized DB entries or memory pressure during encryption of multi-MB payloads).
3. **`execution_result` payload in `callback/route.ts`** (lines 153–158): `executionId`, `status`, `frictionScore` are cast from `body` without Zod validation. `status` is passed directly to `sp_run_executions_update_result` as `i_status`. If the stored procedure does not validate the status enum, an invalid status string could corrupt run state.

**Recommendations:**
```typescript
// actions/operators.ts — add at top:
const createOperatorSchema = z.object({
  login: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(12).max(128),
  full_name: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
  active: z.boolean().optional(),
});

// actions/credentials.ts
const createCredentialSchema = z.object({
  site_id: z.number().int().positive(),
  site_environment_id: z.number().int().positive(),
  role_name: z.string().min(1).max(100),
  credential_value: z.string().min(1).max(10000),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  is_session_only: z.boolean().optional(),
});
```

### D.2 SQL Injection Prevention

All database access goes through `invokeProc`, `invokeProcWrite`, `invokeProcScalar`, and `invokeProcInTransaction` — parameterized stored procedure calls. There is no ad-hoc SQL construction in the application layer. This is a strong architectural control against SQL injection.

**Assessment:** SQL injection risk is **very low** given the database-first stored procedure architecture. The only residual risk would be inside stored procedure bodies (where string concatenation for dynamic SQL in PostgreSQL could be unsafe), which is outside this review's scope.

### D.3 SSRF Risk

**Files:** `actions/sites.ts` (lines 11–12, 22–23), `actions/runs.ts`

`base_url` is accepted for sites and environments, validated as a URL (`z.string().url()`). This URL is later used by the runner service to drive Playwright test sessions against the target website.

**Gap:** Zod's `.url()` validator accepts `http://localhost`, `http://127.0.0.1`, `http://10.0.0.1`, `file://`, etc. A malicious operator could register a site pointing to an internal service (e.g., `http://postgres:5432` or `http://runner:4000`) and cause the runner to make connections to internal network addresses.

**Recommendation:** Add an SSRF-prevention validator:
```typescript
// actions/sites.ts — extend siteSchema:
base_url: z.string().url().max(2048).refine((url) => {
  const parsed = new URL(url);
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  const isPrivate = blocked.some(b => parsed.hostname === b)
    || /^10\./.test(parsed.hostname)
    || /^192\.168\./.test(parsed.hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname);
  return !isPrivate;
}, 'Private/internal URLs are not allowed'),
```

### D.4 Prototype Pollution

No use of `Object.assign`, `_.merge`, or dynamic property assignment from user input was found. Server actions map stored procedure output columns (`o_*` prefixed) to typed objects manually. Prototype pollution risk is **low**.

### D.5 Path Traversal

`ARTIFACT_ROOT_PATH=/artifacts` (`.env.example`). No artifact path construction from user input was found in the reviewed server action files. Risk level **low** within the reviewed scope, but artifact retrieval routes (not present in the reviewed files) should be assessed when implemented.

### D.6 XSS

- Next.js React server components escape HTML by default.
- No `dangerouslySetInnerHTML` was observed in reviewed files.
- `httpOnly` cookies prevent script-based token theft.
- **Gap:** No `Content-Security-Policy` header is configured in `next.config.ts`. The current config has no `headers()` function at all.

---

## E. Infrastructure Security

### E.1 Docker Network Isolation

**File:** `docker-compose.yml`

All services (`postgres`, `migrator`, `dashboard-web`, `runner`, `ollama`, `mailcatcher`) are on `qa-platform-network` (bridge driver). Network is flat — any container can reach any other container by service name.

| Service | External Port | Risk |
|---|---|---|
| `postgres` | **None** (no `ports:` mapping) | Low — DB not exposed to host |
| `dashboard-web` | `3000:3000` | Expected — HTTP only, no TLS |
| `runner` | `4000:4000` | **Gap** — runner API exposed to host without auth beyond callback tokens |
| `ollama` | `11434:11434` (llm profile) | Medium — LLM inference API exposed; no auth |
| `mailcatcher` | `1080:1080`, `1025:1025` (dev profile) | Low in dev; ensure profile is not used in prod |

**Gaps:**
1. **PostgreSQL credentials are hardcoded in `docker-compose.yml`** (lines 7–8: `POSTGRES_USER: qa_user`, `POSTGRES_PASSWORD: qa_password`). These are not sourced from `${VAR:?required}` pattern like `DASHBOARD_SESSION_SECRET` is. A developer copying `docker-compose.yml` to production without changing these values will run with default credentials.
2. **`DASHBOARD_SESSION_SECRET`** uses the required-variable pattern (`${DASHBOARD_SESSION_SECRET:?...}`), which is the correct approach. This pattern should be applied to `POSTGRES_PASSWORD` and `POSTGRES_USER` as well.
3. **Runner service has no DB connection** (no `POSTGRES_*` env vars in runner's compose service definition), which is correct isolation — runner does not write to DB directly.
4. **Runner port 4000 is exposed to host.** If the host is internet-facing, the runner's internal API is accessible without TLS or auth beyond the per-execution callback token. The runner should not be reachable from outside the Docker network.
5. **`POSTGRES_SSL_MODE=disable`** in `.env.example`. In production, PostgreSQL should use TLS between containers.

### E.2 Container Privilege Levels

**Files:** `docker/dashboard/Dockerfile`, `docker/runner/Dockerfile`

Both Dockerfiles:
- Create a non-root system user (`nextjs`/`runner`, UID 1001)
- Drop privileges with `USER nextjs` / `USER runner` before `CMD`

This is correct. Containers do not run as root.

**Gap:** Neither Dockerfile uses `--cap-drop=ALL` or `--security-opt=no-new-privileges` in the compose definition. Adding these to `docker-compose.yml` provides defense-in-depth against privilege escalation within the container.

### E.3 TLS / HTTPS

**Not configured anywhere in the stack.** The dashboard runs on plain HTTP (`HOSTNAME "0.0.0.0"`, port 3000). There is no TLS termination in the Docker Compose configuration.

**Impact:** Session tokens, vault unlock tokens, and all authenticated API traffic traverse the network in plaintext. In a development environment on localhost this is acceptable; in any non-localhost deployment (staging, production, shared test environment), this is a **Critical** gap.

**Recommendation:** Add a TLS-terminating reverse proxy (Nginx, Caddy, or Traefik) as a compose service in front of `dashboard-web`. Caddy example:
```yaml
# docker-compose.yml addition:
caddy:
  image: caddy:2-alpine
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./docker/caddy/Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
  networks:
    - qa-platform-network
```

### E.4 Secrets in Environment Variables

**`.env.example`** contains:
- `POSTGRES_PASSWORD=change-this-password-in-production` — commented warning, not enforced
- `DASHBOARD_SESSION_SECRET=your-session-secret-min-32-chars-change-in-production` — example value, not enforced at startup

**docker-compose.yml** has `POSTGRES_PASSWORD: qa_password` hardcoded (line 8). There is no `${POSTGRES_PASSWORD:?required}` guard.

**Recommendation:** Treat all secrets as required variables in `docker-compose.yml`:
```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
```
Add a startup validation check in `packages/config/src/env.ts` that verifies no secret is set to its example/default value.

---

## F. OWASP Top 10 (2021) Mapping

| # | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | **Partially Addressed** | Action-level RBAC enforced via `requireCapability`; no framework-level route guard middleware; `getVaultStateAction` has no auth check; site-scoped authorization absent; `queryAuditLogs` accessible to all operators |
| A02 | Cryptographic Failures | **Partially Addressed** | AES-256-GCM + Argon2id are strong; no TLS between containers or to client; `POSTGRES_SSL_MODE=disable`; no CSP header; session cookie lacks `Secure` flag in dev |
| A03 | Injection | **Addressed** | All DB access via parameterized stored procedures; no ad-hoc SQL; Zod validation on key mutation paths |
| A04 | Insecure Design | **Partially Addressed** | Vault crypto design is sound; no brute-force lockout on login or vault unlock; no account lockout; inactive-user error leaks account existence |
| A05 | Security Misconfiguration | **Partially Addressed** | Hardcoded DB credentials in compose; no security HTTP headers (CSP, HSTS, X-Frame-Options); `POSTGRES_SSL_MODE=disable`; runner port exposed to host |
| A06 | Vulnerable & Outdated Components | **Not Assessed** | Dependency audit not performed in this review; recommend `pnpm audit` and Dependabot/Renovate setup |
| A07 | Identification & Auth Failures | **Partially Addressed** | Strong Argon2id; timing-safe sentinel hash; no brute-force rate limiting; 30-day session TTL; password minimum is 8 chars (should be 12); no account lockout |
| A08 | Software & Data Integrity Failures | **Partially Addressed** | `pnpm install --frozen-lockfile` used in Dockerfiles (good); no SBOM; no supply chain policy; CI/CD pipeline not reviewed |
| A09 | Security Logging & Monitoring | **Partially Addressed** | Audit log exists (`sp_audit_logs_insert`), used for `secret.reveal` and payment profile create; login success/failure not explicitly audit-logged; no alerting on anomalous patterns |
| A10 | SSRF | **Not Addressed** | `base_url` for sites/environments accepts RFC-private IP ranges and `localhost`; no SSRF allowlist/blocklist |

---

## G. Priority Findings Table

| # | Finding | Severity | Status | Recommendation |
|---|---|---|---|---|
| F-01 | No TLS between client and server; all tokens in plaintext | **Critical** | Open | Add TLS-terminating reverse proxy (Caddy/Nginx) to compose |
| F-02 | No login brute-force rate limiting or account lockout | **High** | Open | Implement server-side attempt counter via `sp_operators_login_attempt` proc; lock after N failures |
| F-03 | `base_url` accepts private/internal IP ranges — SSRF risk | **High** | Open | Add SSRF blocklist in `siteSchema` Zod refinement (`sites.ts`) |
| F-04 | PostgreSQL credentials hardcoded in `docker-compose.yml` | **High** | Open | Use `${POSTGRES_PASSWORD:?required}` pattern; rotate before any non-local deploy |
| F-05 | Inactive account returns distinct error message (account enumeration) | **Medium** | Open | Return same message for inactive and invalid-password cases in `auth.ts` line 53 |
| F-06 | 30-day absolute session TTL — excessively long for internal tool | **Medium** | Open | Reduce `AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS` to 86400 or 604800 |
| F-07 | No Next.js middleware — routes lack framework-level auth safety net | **Medium** | Open | Add `middleware.ts` that redirects `/dashboard/**` when `session_token` cookie is absent |
| F-08 | `getVaultStateAction` has no authentication check | **Medium** | Open | Add `await requireOperator()` at top of `getVaultStateAction` in `vault.ts` |
| F-09 | No Content-Security-Policy or security response headers | **Medium** | Open | Add `headers()` block to `next.config.ts` with CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| F-10 | `queryAuditLogs` accessible to any authenticated operator | **Medium** | Open | Add `audit.read` capability check; restrict to admin roles |
| F-11 | Runner port 4000 exposed to host without TLS | **Medium** | Open | Remove `ports` mapping for runner in compose; access via internal Docker network only |
| F-12 | No Zod validation on `createCredential`, `createOperator`, `createPaymentProfile` | **Medium** | Open | Add Zod schemas mirroring the site/run patterns; enforce max lengths and format rules |
| F-13 | `execution_result` callback payload not Zod-validated; `status` passed raw to stored proc | **Medium** | Open | Add Zod schema for `execution_result` type in `callback/route.ts` |
| F-14 | Dependency vulnerability audit not set up | **Medium** | Open | Add `pnpm audit --audit-level=high` to CI pipeline; configure Dependabot or Renovate |
| F-15 | Vault unlock token not cryptographically bound to operator session | **Low** | Open | Store `sessionToken` in `UnlockSession`; re-validate on `withUnlocked()` call |
| F-16 | No concurrent session limit per operator | **Low** | Open | Add `MAX_SESSIONS_PER_OPERATOR` guard in `sp_operator_sessions_create` |
| F-17 | `crypto` dynamically imported inside `encrypt`/`decrypt` — unnecessary overhead | **Low** | Open | Move `import crypto from 'crypto'` to static top-level import in `crypto.ts` |
| F-18 | No password strength meter despite ADR 003 mention of zxcvbn | **Low** | Open | Integrate `zxcvbn-ts` on vault bootstrap and operator create pages |
| F-19 | `AUTH_PASSWORD_MIN_LENGTH=8` in `.env.example` — should be 12 minimum | **Low** | Open | Raise default to 12; enforce at `hashPassword` level |
| F-20 | `POSTGRES_SSL_MODE=disable` in `.env.example` | **Low** | Open | Set `POSTGRES_SSL_MODE=require` for any non-localhost deployment |

---

## References

- `packages/auth/src/password.ts` — Argon2id hashing
- `packages/auth/src/sessions.ts` — session management
- `packages/auth/src/capabilities.ts` — RBAC resolution
- `packages/auth/src/guards.ts` — `requireOperator`, `requireCapability`
- `packages/vault/src/crypto.ts` — AES-256-GCM primitives
- `packages/vault/src/vault.ts` — vault bootstrap/unlock/lock/withUnlocked
- `packages/vault/src/registry.ts` — in-memory unlock session registry
- `apps/dashboard-web/app/actions/auth.ts` — login, logout, session management
- `apps/dashboard-web/app/actions/vault.ts` — vault server actions
- `apps/dashboard-web/app/actions/credentials.ts` — credential CRUD + decrypt-reveal
- `apps/dashboard-web/app/actions/operators.ts` — operator management
- `apps/dashboard-web/app/actions/payment-profiles.ts` — payment profile CRUD
- `apps/dashboard-web/app/actions/sites.ts` — site/environment CRUD (Zod validation)
- `apps/dashboard-web/app/actions/runs.ts` — run creation/management
- `apps/dashboard-web/app/actions/audit.ts` — audit log query/write
- `apps/dashboard-web/app/api/runner/callback/route.ts` — runner callback
- `apps/dashboard-web/app/api/runner/approvals/[approvalId]/poll/route.ts` — approval poll
- `apps/dashboard-web/app/api/runner/email-validate/route.ts` — email validation trigger
- `docker-compose.yml`, `docker/dashboard/Dockerfile`, `docker/runner/Dockerfile`
- `apps/dashboard-web/next.config.ts`
- `.env.example`
- OWASP Top 10 2021: https://owasp.org/Top10/
- NIST SP 800-38D (AES-GCM): https://csrc.nist.gov/publications/detail/sp/800-38d/final
- OWASP Argon2id Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
