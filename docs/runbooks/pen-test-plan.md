# Penetration Testing Plan — QA Automation Platform

**Version:** 1.0  
**Baseline:** Phase 10.2 security review (see `docs/decisions/006-security-review.md`)  
**Last Updated:** 2025-07  

---

## A. Scope & Objectives

### A.1 Objectives

1. Validate or refute findings F-01 through F-20 from the security review under real attack conditions.
2. Discover findings not captured by code-only review (runtime behavior, configuration drift, chained exploits).
3. Produce a reproducible evidence package that can be re-run after remediation to confirm closure.

### A.2 In-Scope

| Component | Description |
|---|---|
| `dashboard-web` | Next.js application at `http://localhost:3000` — all routes under `/login`, `/unlock`, `/dashboard/**`, and `/api/**` |
| Runner API | Internal Express service at `http://localhost:4000` — `/api/runner/callback`, approval poll, email-validate |
| PostgreSQL | Port 5432 — only accessible from within the Docker network (test via container-exec) |
| Auth flows | Login, logout, session lifecycle, vault bootstrap, vault unlock/lock |
| Vault | Master password handling, unlock token lifecycle, secret encrypt/decrypt/reveal |
| RBAC | Capability enforcement across all server actions |
| Secrets exposure | Env vars, logs, error messages, API responses |

### A.3 Out-of-Scope

| Component | Reason |
|---|---|
| Host operating system | Not part of the application attack surface |
| Docker daemon / host network | Infrastructure layer — covered by infrastructure security review |
| GitHub / CI pipeline | Separate review track |
| Third-party services (Ollama, mailcatcher) | Tested only as they relate to `dashboard-web` integration points |
| Stored procedure internals | DB security review is a separate track |

### A.4 Rules of Engagement

- All testing is performed against an **isolated test instance** (see Section B.1). Never test against production data.
- Testers must not modify or delete data beyond what is required to reproduce a finding.
- Findings that reveal actual credentials or PII must be redacted in the public report.
- Maximum tolerated downtime per individual test: 5 minutes. If a test causes service unavailability, stop and document.

---

## B. Test Environment Requirements

### B.1 Spin-Up Procedure

```bash
# 1. Clone the repository into an isolated directory
git clone <repo-url> /opt/pentest/qa-platform
cd /opt/pentest/qa-platform

# 2. Create a test-specific .env file — never reuse production values
cp .env.example .env.pentest
# Edit .env.pentest:
#   POSTGRES_PASSWORD=pentest_pg_password_$(openssl rand -hex 8)
#   DASHBOARD_SESSION_SECRET=$(openssl rand -base64 48)
#   NODE_ENV=production
#   AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS=86400

# 3. Start the isolated stack
docker compose --env-file .env.pentest -p qa-pentest up -d --build

# 4. Verify all services healthy
docker compose -p qa-pentest ps

# 5. Confirm dashboard is reachable
curl -I http://localhost:3000/login

# 6. After testing — full teardown including volumes
docker compose -p qa-pentest down -v --remove-orphans
```

### B.2 Test Account Setup

Before testing, create the following accounts by bootstrapping via the dashboard UI or a seed script:

| Account | Role | Password | Purpose |
|---|---|---|---|
| `pentest_admin` | Admin (all capabilities) | `PentestAdmin!2025` | Full-privilege baseline |
| `pentest_viewer` | Read-only (`run.read` only) | `PentestViewer!2025` | Privilege escalation tests |
| `pentest_cred` | `site_credentials.manage` only | `PentestCred!2025` | Lateral movement tests |
| `pentest_inactive` | Admin (deactivated) | `PentestInactive!2025` | Account state tests |

After account setup, bootstrap the vault with master password: `VaultMasterPentest!2025` (minimum 12 chars, satisfies current policy).

Create at least:
- 2 test sites (one with an internal URL `http://localhost:9999` to test SSRF, one valid external URL)
- 2 site credentials (one per test site)
- 1 payment profile (card type)

### B.3 Required Tools

| Tool | Version | Purpose |
|---|---|---|
| OWASP ZAP | 2.15+ | Automated spider, active scan, CSRF testing |
| Burp Suite Community | Latest | Manual interception, replay, session analysis |
| `sqlmap` | 1.8+ | SQL injection verification (expected: no findings) |
| `nuclei` | 3.x | Template-based vulnerability scanning |
| `ffuf` | 2.x | Endpoint/directory fuzzing |
| `jwt_tool` | Latest | Session token analysis |
| `hydra` or `medusa` | Latest | Brute-force rate limit testing |
| `curl` | System | API-level manual tests |
| Docker CLI | System | Container escape / network tests |
| `nmap` | Latest | Port scan of host and Docker bridge network |

---

## C. Test Cases

### Category 1: Authentication Bypass

> Target: `apps/dashboard-web/app/actions/auth.ts`, `packages/auth/src/password.ts`, `packages/auth/src/sessions.ts`

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| AUTH-01 | **Valid login** — baseline | POST login form with `pentest_admin` / correct password | `session_token` cookie set; redirect to `/dashboard` | Cookie is `httpOnly`, `SameSite=Strict`; 200 response |
| AUTH-02 | **Wrong password** | POST login with correct `login`, wrong `password` | `{ success: false, error: 'Invalid login or password' }` | Same error message as unknown user (no enumeration) |
| AUTH-03 | **Unknown user** | POST login with `nonexistent_user` / any password | `{ success: false, error: 'Invalid login or password' }` | Response time comparable to wrong-password case (≤ 20% variance) |
| AUTH-04 | **Timing attack — user enumeration** | Measure 100 requests each: unknown user vs. wrong password | Response times should be statistically indistinguishable | Argon2id sentinel hash ensures timing parity; confirm with `hdrhistogram` |
| AUTH-05 | **Inactive account** | POST login with `pentest_inactive` / correct password | `{ success: false, error: ... }` | Error message must NOT differ from wrong-password message (F-05); if it does, flag as Medium finding |
| AUTH-06 | **Brute-force login — 100 attempts** | Use `hydra` or looped `curl`: 100 rapid POST requests for `pentest_admin` with random passwords | After N failures, request should be rate-limited or account should lock | **Expected to fail** (no rate limiting exists per F-02); document number of attempts before any lockout |
| AUTH-07 | **Session fixation** | Set a pre-crafted `session_token` cookie before logging in; complete login; check if the same token is now accepted | Cookie must be newly generated post-login; pre-set value must not become a valid session | Cookie value changes after login |
| AUTH-08 | **Session token in URL / Referer** | Inspect all redirects and requests for `session_token` in URL params or `Referer` headers | Token must not appear in URL or referrer | No token in URL or Referer |
| AUTH-09 | **Logout completes revocation** | Log in; copy `session_token`; log out; replay the token against `/dashboard` | Replay must be rejected | `{ isValid: false }` on `validateSession`; redirect to login |
| AUTH-10 | **Concurrent session test** | Log in from two browser contexts simultaneously with same account | Both sessions should be valid | Verify both cookies return valid sessions (documents F-16: no session limit) |
| AUTH-11 | **Cookie flags verification** | Inspect `Set-Cookie` header after login | `httpOnly`, `SameSite=Strict`; `Secure` if HTTPS is available | All flags present |
| AUTH-12 | **Absolute session TTL** | Create session; wait for `AUTH_SESSION_ABSOLUTE_TIMEOUT_SECONDS`; replay | Token rejected after TTL | Confirm TTL is enforced server-side regardless of cookie `maxAge` |

---

### Category 2: Authorization Bypass

> Target: `packages/auth/src/guards.ts`, all `actions/*.ts` files

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| AUTHZ-01 | **Access dashboard without session** | GET `/dashboard` with no cookies | Redirect to `/login` | 302 to `/login` (or 401); **if 200, flag as Critical** |
| AUTHZ-02 | **Forged `session_token` cookie** | Set `session_token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`; GET `/dashboard` | Redirect to `/login` | 302; `validateSession` returns `isValid: false` |
| AUTHZ-03 | **Access operator management as viewer** | Log in as `pentest_viewer`; invoke `listOperators` server action (via form/fetch) | `{ success: false, error: 'Failed to list operators' }` or Forbidden | `requireCapability('operator.manage')` throws `ForbiddenError`; no data returned |
| AUTHZ-04 | **Access secret reveal as credential-manage-only** | Log in as `pentest_cred`; invoke `getCredentialWithValue` for any credential ID | Forbidden | `requireCapability('secret.reveal')` blocks; credential value not returned |
| AUTHZ-05 | **IDOR — access other operator's data** | As `pentest_viewer`, call `getOperator(id)` with IDs of all known operators | Forbidden for all attempts | `requireCapability('operator.manage')` enforces; no data returned regardless of ID |
| AUTHZ-06 | **Horizontal priv esc — credential IDOR** | As `pentest_cred`, call `getCredential(id)` cycling through IDs 1–100 | Only allowed credentials returned; foreign site credentials rejected | If site-scoped authorization is absent (F-06 in review), document which IDs are accessible |
| AUTHZ-07 | **Access vault state without auth** | Invoke `getVaultStateAction` server action with no session cookie | Should return empty/error | **Expected to return vault state** per F-08; document as Medium finding if it does |
| AUTHZ-08 | **Access audit logs as viewer** | Log in as `pentest_viewer`; invoke `queryAuditLogs` | Forbidden | `requireOperator()` passes; but all logs visible (F-10); document finding |
| AUTHZ-09 | **Capability string injection** | Attempt to inject capability name via action parameter: pass `capabilityName = "operator.manage\x00"` | No capability granted | String comparison in `hasCapability` must be exact; no injection effect |
| AUTHZ-10 | **Runner token replay** | Record a valid `x-runner-token` from a test execution; replay it 60 seconds after use | Token rejected | Callback token is one-time use; `sp_run_executions_validate_token` should reject reuse |
| AUTHZ-11 | **Unauthenticated runner callback** | POST to `/api/runner/callback` with no `x-runner-token` header | 401 | Confirmed at `route.ts` line 139–141 |
| AUTHZ-12 | **Runner callback with wrong token** | POST to `/api/runner/callback` with `x-runner-token: wrong`; valid JSON body | 500 or DB error from stored proc | Stored proc rejects token; no execution data written |

---

### Category 3: Vault Security

> Target: `packages/vault/src/`, `apps/dashboard-web/app/actions/vault.ts`

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| VAULT-01 | **Vault unlock — correct password** | POST `unlockVaultAction` with correct master password | `unlock_token` cookie set; `isVaultUnlocked()` returns true | Cookie flags: `httpOnly`, `SameSite=Strict`, `maxAge=1800` |
| VAULT-02 | **Vault unlock — wrong password** | POST `unlockVaultAction` with incorrect master password | `{ success: false, error: 'Invalid master password' }` | AES-GCM auth tag failure propagates correctly; no partial state |
| VAULT-03 | **Vault brute-force — 50 attempts** | Loop `unlockVaultAction` with random 12-char passwords | No rate limiting expected (F-02 equivalent for vault) | Document attempts before any lockout; flag as High if unlimited |
| VAULT-04 | **Vault lock clears RVK** | Unlock vault; lock via `lockVaultAction`; attempt `isVaultUnlocked()` | Returns false; `registry.get()` returns null | Confirms `registry.remove()` → `zeroize(session.rvk)` |
| VAULT-05 | **Unlock token expiry** | Unlock vault; wait `VAULT_UNLOCK_TTL_SECONDS + 60` seconds; attempt `getCredentialWithValue` | `{ success: false, error: 'Vault is locked' }` | Registry TTL enforced; RVK no longer in memory |
| VAULT-06 | **Unlock token idle expiry** | Unlock vault; wait `VAULT_UNLOCK_IDLE_RESET_SECONDS + 60` seconds with no vault activity; attempt `getCredentialWithValue` | `{ success: false, error: 'Vault is locked' }` | Idle timeout enforced |
| VAULT-07 | **Forged unlock token** | Set `unlock_token=<random 43-char base64url>` cookie; call `getCredentialWithValue` | `{ success: false, error: 'Vault is locked. Please unlock first.' }` | `registry.get()` returns null for unknown token |
| VAULT-08 | **Stolen unlock token — cross-session** | Unlock vault as `pentest_admin`; extract `unlock_token` value; use it in a separate browser context with a different or no session | `withUnlocked()` succeeds (token-only check) | **Expected gap** per F-15; document that unlock token is not session-bound |
| VAULT-09 | **Secret value not in response for list** | Log in; unlock vault; call `listCredentials` | Response contains no `credential_value` field | Only metadata returned; no plaintext |
| VAULT-10 | **Secret decryption audit trail** | Call `getCredentialWithValue(id)` for a known credential | `secret.reveal` audit log entry written with `actor_id`, `target`, `status: success` | Query `queryAuditLogs` and confirm entry |
| VAULT-11 | **Bootstrap idempotency** | With vault already bootstrapped, call `bootstrapVaultAction` again | `{ success: false, error: 'Vault is already bootstrapped' }` | No second RVK generation; stored state unchanged |
| VAULT-12 | **Master password min length** | Call `bootstrapVaultAction` with 11-char password | `{ success: false, error: 'Password must be at least 12 characters' }` | Validation at `vault.ts` line 21 |

---

### Category 4: Input Validation

> Target: all `actions/*.ts`, `api/runner/callback/route.ts`

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| INJ-01 | **SQL injection via login field** | POST login with `login = "' OR '1'='1"` | Auth fails; no SQL error exposed | Stored procedure parameterization prevents injection |
| INJ-02 | **SQL injection via site name** | Create site with `name = "'; DROP TABLE sites; --"` | Either validation error or safe insert of literal string | DB unchanged; Zod `.string()` passes it through — check stored proc safety |
| INJ-03 | **SQL injection via credential value** | Create credential with `credential_value = "'; SELECT * FROM secret_records; --"` | Value encrypted and stored as literal string; no query execution | Vault encrypts before DB insert; parameterized call prevents injection |
| INJ-04 | **XSS via site name** | Create site with `name = "<script>alert(1)</script>"` | Value stored as literal; rendered escaped in the UI | React escaping prevents execution; confirm in browser |
| INJ-05 | **XSS via operator full_name** | Create operator with `full_name = "<img src=x onerror=alert(1)>"` | Stored and rendered escaped | React escaping; no CSP header currently (F-09) — document |
| INJ-06 | **SSRF via site base_url** | Create site with `base_url = "http://postgres:5432"` | Zod `.url()` accepts this — **expected to pass** (F-03) | Document that internal URL was accepted; confirm runner would connect to it |
| INJ-07 | **SSRF via site base_url — localhost** | Create site with `base_url = "http://localhost:4000/admin"` | Same as INJ-06 | Document finding |
| INJ-08 | **Overlong credential value** | Create credential with `credential_value` = 100,000-char string | No input length limit — encryption of large buffer | Measure response time; document memory impact |
| INJ-09 | **Prototype pollution via callback body** | POST to `/api/runner/callback` with body `{"__proto__": {"isAdmin": true}, "type": "execution_result", ...}` | No prototype modification; request processed normally or rejected | `Object.assign` not used; prototype unchanged |
| INJ-10 | **Path traversal via artifact_path** | If any route accepts `artifact_path`, attempt `../../etc/passwd` | Path rejected or sanitized | Document if any artifact retrieval routes exist |
| INJ-11 | **Zod bypass — execution_result type** | POST to `/api/runner/callback` with valid token but `status = "'; DROP TABLE runs; --"` | Stored proc receives literal string; no SQL execution | Document that `status` field is not Zod-validated in `execution_result` branch (F-13) |
| INJ-12 | **JSON body size bomb** | POST to `/api/runner/callback` with 10 MB JSON body | Request rejected or body parsing fails cleanly | Next.js default body size limit; confirm limit is enforced |
| CSRF-01 | **CSRF on state-changing server action** | From a different origin, trigger a POST to a server action form endpoint | Next.js server actions use `SameSite=Strict` cookie; request should fail | Cookie not sent cross-origin with `SameSite=Strict`; confirm |
| CSRF-02 | **Cross-origin preflight** | From `http://evil.example.com`, OPTIONS request to `/api/runner/callback` | CORS not configured; browser blocks cross-origin fetch | No `Access-Control-Allow-Origin` header returned |

---

### Category 5: API Security

> Target: `apps/dashboard-web/app/api/runner/`

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| API-01 | **Rate limiting — runner callback** | Send 1000 POST requests to `/api/runner/callback` in 10 seconds | Requests should be rate-limited | **Expected gap** — no rate limiting implemented; document |
| API-02 | **Replay attack — callback token** | Use a valid callback token twice for the same execution | Second use should fail | Stored proc validates token and marks used; confirm one-time use behavior |
| API-03 | **Approval poll — IDOR** | GET `/api/runner/approvals/999/poll` with a valid token for execution 1 | 404 or 401 | `sp_approvals_get_by_id_for_runner` validates token against approval |
| API-04 | **Approval poll — negative ID** | GET `/api/runner/approvals/-1/poll` with any token | 400 Bad Request | `parseInt` + `approvalId <= 0` check at route.ts line 25 |
| API-05 | **Approval poll — string ID** | GET `/api/runner/approvals/abc/poll` | 400 Bad Request | `Number.isFinite` check |
| API-06 | **Email-validate — missing fields** | POST to `/api/runner/email-validate` with missing `inbox_id` | 400 with descriptive error | Validated at route.ts line 48 |
| API-07 | **Email-validate — vault locked** | POST to `/api/runner/email-validate` with valid token but vault locked (no `unlock_token` cookie) | 503 with `'Vault is locked'` message | Route.ts line 91 |
| API-08 | **Runner port direct access — bypass dashboard** | From host, `curl http://localhost:4000/` | Runner internal API accessible from host | **Gap F-11** — document all accessible runner endpoints |
| API-09 | **LLM benchmark endpoint auth** | GET/POST `/api/llm/benchmark` with no auth | Should require authentication | Review `apps/dashboard-web/app/api/llm/benchmark/route.ts`; check if guarded |
| API-10 | **Test setup endpoint auth** | GET/POST `/api/test/setup` with no auth | Should not be accessible in production | Review `apps/dashboard-web/app/api/test/setup/route.ts`; should be dev-only |

---

### Category 6: Infrastructure

> Target: `docker-compose.yml`, Dockerfiles, container runtime

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| INFRA-01 | **Port scan — host** | `nmap -sV -p 1-65535 127.0.0.1` | Only ports 3000 (dashboard) and 4000 (runner) exposed | No unexpected open ports; postgres (5432) not exposed to host |
| INFRA-02 | **Port scan — Docker bridge network** | From within a container: `nmap -sV 172.18.0.0/24` | All services visible on bridge; postgres at 5432 | Document internal network topology |
| INFRA-03 | **PostgreSQL access from dashboard container** | `docker exec qa-pentest-dashboard pg_isready -h postgres -U qa_user` | Connects successfully | Expected; document that DB is accessible from dashboard container only |
| INFRA-04 | **PostgreSQL access from host** | `psql -h 127.0.0.1 -p 5432 -U qa_user -d qa_platform` | Connection refused | No host port mapping for postgres in compose |
| INFRA-05 | **Container running as root** | `docker exec qa-pentest-dashboard whoami` | `nextjs` (UID 1001) | Non-root user confirmed per Dockerfile |
| INFRA-06 | **Container privilege escalation** | From within dashboard container: `sudo su`, attempt to write to `/etc/passwd` | Permission denied | Non-root user; no sudo configured |
| INFRA-07 | **Docker socket access** | `docker exec qa-pentest-dashboard ls /var/run/docker.sock` | Not present | Socket not mounted into app containers |
| INFRA-08 | **Sensitive env vars in process list** | `docker exec qa-pentest-dashboard cat /proc/1/environ` | Env vars present, including `POSTGRES_PASSWORD` | Document; env vars in memory are readable by root on host — document risk |
| INFRA-09 | **Env vars in container inspect** | `docker inspect qa-pentest-dashboard | jq '.[].Config.Env'` | `POSTGRES_PASSWORD` visible in plaintext | Document as Medium gap; use Docker secrets in production |
| INFRA-10 | **Runner → Dashboard internal call** | From runner container: `curl http://dashboard-web:3000/api/runner/callback` | Runner can reach dashboard internally | Expected; confirm dashboard validates runner token |
| INFRA-11 | **Ollama API — no auth** | `curl http://localhost:11434/api/tags` (if llm profile active) | List of models returned with no authentication | Document; Ollama has no built-in auth |
| INFRA-12 | **Mailcatcher — no auth** | `curl http://localhost:1080/` (if dev profile active) | Mailcatcher UI accessible | Acceptable in dev; ensure `dev` profile is not active in prod |

---

### Category 7: Secrets Exposure

> Target: logs, error messages, HTTP responses, environment variables

| ID | Description | Method | Expected Result | Pass Criteria |
|---|---|---|---|---|
| SEC-01 | **Password in server logs** | Trigger a login error; check `docker logs qa-pentest-dashboard` | No password string in logs | `console.error('Login error:', error)` should only log error object, not `password` param |
| SEC-02 | **Vault master password in logs** | Trigger a vault unlock error; check logs | No master password in logs | Same as above |
| SEC-03 | **Secret plaintext in logs** | Trigger `getCredentialWithValue` for a known credential; check logs | No credential plaintext in logs | Audit log writes `secret_id`, not plaintext |
| SEC-04 | **Password hash in API response** | Call `listOperators` or `getOperator` as admin | No `password_hash` field in response | Stored proc outputs only `o_id`, `o_login`, `o_full_name`, `o_email`, `o_active` — confirm |
| SEC-05 | **Wrapped RVK / KEK in response** | Call `getVaultStateAction` | Response includes `kdfMemory`, `kdfIterations`, `kdfParallelism` — no wrapped RVK | `VaultState` interface has no `wrappedRvk` field; confirm |
| SEC-06 | **Stack trace in error responses** | Trigger a server error (malformed proc call); inspect HTTP response body | Generic error message; no stack trace | `console.error` is server-side; response returns `{ error: 'Failed to ...' }` only |
| SEC-07 | **Sensitive headers in responses** | Inspect all response headers from dashboard | No `X-Powered-By: Next.js` or verbose server headers | Next.js removes `X-Powered-By` by default; confirm |
| SEC-08 | **Credential value in `listCredentials` response** | Call `listCredentials` (not `getCredentialWithValue`) | Response has no `credential_value` field | `Credential` interface has no `credential_value`; only `CredentialWithValue` does |
| SEC-09 | **Env file accessible via web server** | GET `http://localhost:3000/.env`, `/.env.example`, `/.env.pentest` | 404 | Next.js does not serve root-level files unless in `public/` |
| SEC-10 | **Source maps in production build** | GET `http://localhost:3000/_next/static/chunks/*.js.map` | 404 | Source maps should not be deployed in production build |
| SEC-11 | **Correlation ID leaks** | Inspect `x-correlation-id` usage in runner callback responses | Correlation ID is an internal tracking value; should not expose execution internals | Acceptable if opaque; flag if it maps directly to sensitive IDs |
| SEC-12 | **Inactive-user distinct error** | See AUTH-05 | Error message must match wrong-password message | Per F-05 in security review |

---

## D. Finding Report Template

Use this template for every confirmed finding. One finding per file. Store in `/pentest-results/findings/PTFIND-NNN.md`.

```markdown
# PTFIND-NNN: [Short Title]

## Metadata
- **Finding ID:** PTFIND-NNN
- **Test Case ID:** [e.g., AUTH-06]
- **Date Discovered:** YYYY-MM-DD
- **Tester:** [Name / handle]
- **Severity:** Critical | High | Medium | Low | Informational
- **CWE:** [e.g., CWE-307 — Improper Restriction of Excessive Authentication Attempts]
- **OWASP 2021:** [e.g., A07: Identification and Authentication Failures]
- **Status:** Open | In Remediation | Verified Closed

## Description

[Clear, concise description of the vulnerability. Explain why this is a security risk,
not just that the behavior differs from expectation.]

## Steps to Reproduce

1. Start isolated test instance per Section B.1.
2. [Exact commands / browser steps to reproduce]
3. [Include exact request/response where applicable]

```http
POST /api/... HTTP/1.1
Host: localhost:3000
Cookie: session_token=...

{"field": "..."}
```

```http
HTTP/1.1 200 OK
...
```

## Evidence

[Screenshots, curl output, tool reports — attach as files or embed as code blocks]

## Impact

[What an attacker can achieve by exploiting this finding. Be specific.
e.g., "An unauthenticated attacker can enumerate all valid operator logins within
5 minutes by comparing response times, requiring approximately 50 test requests."]

## Recommendation

[Specific code-level guidance. Reference the exact file and line where the fix should be applied.
Match recommendations in `docs/decisions/006-security-review.md` where applicable.]

## Verification Test

[How to confirm the finding is fixed after remediation. Include the exact test case
that should now pass.]

## References

- `docs/decisions/006-security-review.md` finding F-XX
- [CWE link]
- [OWASP link]
```

---

## E. Remediation Priority Matrix

| Severity | SLA | Owner | Process |
|---|---|---|---|
| **Critical** | Fix and redeploy within **24 hours** of confirmation | Lead developer + security reviewer sign-off | Hotfix branch; expedited code review; immediate redeploy |
| **High** | Fix within **1 week** of confirmation | Assigned developer; security reviewer sign-off | Standard PR + review; regression test suite must pass |
| **Medium** | Fix within **30 days** of confirmation | Backlog ticket created; assigned in next sprint | Normal development flow; include in release |
| **Low** | Fix within **90 days** or next major release | Backlog ticket; lower priority | Batch with planned improvements |
| **Informational** | No SLA — document and track | Architect / tech lead | Architectural note or ADR update |

### E.1 Pre-Production Gate

The following findings must be **Verified Closed** before any deployment to a non-localhost environment:

| Finding | Source Test | Reason |
|---|---|---|
| F-01 (No TLS) | INFRA-01, AUTH-11 | Tokens in plaintext on any non-localhost network |
| F-02 (No brute-force protection) | AUTH-06, VAULT-03 | Automated password attacks are trivial without rate limiting |
| F-03 (SSRF via base_url) | INJ-06, INJ-07 | Runner can be weaponized against internal services |
| F-04 (Hardcoded DB credentials) | INFRA-09 | Default credentials are publicly documented |
| F-08 (Unauth vault state) | AUTHZ-07 | KDF parameters and bootstrap identity leak without auth |

### E.2 Severity Escalation Triggers

Escalate the severity of any finding by one level if:
- The finding is **chained** with another finding to produce a higher-impact exploit (e.g., SSRF + internal service access + credential exposure = Critical chain).
- The finding is **reproducible in under 60 seconds** with no special tooling.
- Exploitation results in **persistence** (backdoor account, persistent session, DB modification).

---

## F. Retesting Protocol

After remediation of any finding, follow this protocol:

1. Developer marks finding as `In Remediation` with commit hash.
2. Tester re-runs the specific test case(s) mapped to that finding.
3. Tester also runs the full test category containing the finding (e.g., all AUTH-* cases if AUTH-06 was patched).
4. If the fix passes, tester marks finding as `Verified Closed` with date and re-test evidence.
5. If the fix introduces a regression, open a new `PTFIND-NNN` linked to the original.
6. Update `docs/decisions/006-security-review.md` finding table with `Status: Closed`.

---

## G. Tooling Quick Reference

### OWASP ZAP — Spider and Active Scan

```bash
# Start ZAP daemon
zap.sh -daemon -host 127.0.0.1 -port 8090 -config api.key=pentest123

# Run spider on dashboard
curl "http://127.0.0.1:8090/JSON/spider/action/scan/?apikey=pentest123&url=http://localhost:3000&maxChildren=10"

# Run active scan
curl "http://127.0.0.1:8090/JSON/ascan/action/scan/?apikey=pentest123&url=http://localhost:3000"

# Get alerts
curl "http://127.0.0.1:8090/JSON/alert/view/alerts/?apikey=pentest123" | jq .
```

### Burp Suite — Intercept Login

1. Configure browser proxy to `127.0.0.1:8080`.
2. Navigate to `http://localhost:3000/login`.
3. Submit login form; intercept POST in Burp.
4. Use **Repeater** for manual replay testing.
5. Use **Intruder** for AUTH-06 brute-force test.

### sqlmap — Test Login Endpoint

```bash
# sqlmap against login (expected: no injection found)
sqlmap -u "http://localhost:3000/api/auth/login" \
  --data='{"login":"pentest_admin","password":"test"}' \
  --method=POST \
  --headers="Content-Type: application/json" \
  --level=5 --risk=3 \
  --batch \
  --output-dir=/opt/pentest/results/sqlmap/
```

### nuclei — Template Scan

```bash
nuclei -u http://localhost:3000 \
  -t nuclei-templates/http/technologies/ \
  -t nuclei-templates/http/exposures/ \
  -t nuclei-templates/http/misconfiguration/ \
  -o /opt/pentest/results/nuclei-output.txt \
  -severity medium,high,critical
```

### ffuf — Endpoint Discovery

```bash
# Fuzz unknown API routes
ffuf -u http://localhost:3000/api/FUZZ \
  -w /usr/share/wordlists/dirb/common.txt \
  -mc 200,201,204,301,302,400,401,403 \
  -o /opt/pentest/results/ffuf-api.json \
  -of json

# Fuzz dashboard sub-routes
ffuf -u http://localhost:3000/dashboard/FUZZ \
  -w /usr/share/wordlists/dirb/common.txt \
  -b "session_token=<valid_token>" \
  -mc 200,201,204,301,302
```

### Hydra — Brute Force Rate Limit Test (AUTH-06)

```bash
# Test for rate limiting on login
hydra -l pentest_admin \
  -P /usr/share/wordlists/rockyou.txt \
  -s 3000 localhost \
  http-post-form \
  "/api/auth/login:login=^USER^&password=^PASS^:Invalid login" \
  -t 4 -V -o /opt/pentest/results/hydra-login.txt
```

> **Note:** Adapt the form target and failure string to match the actual Next.js server action endpoint once confirmed.

### curl — Manual API Tests

```bash
# Test runner callback with no token (AUTH-11)
curl -s -X POST http://localhost:3000/api/runner/callback \
  -H "Content-Type: application/json" \
  -d '{"type":"execution_result","execution_id":1,"status":"passed"}' | jq .

# Test runner callback with bad token
curl -s -X POST http://localhost:3000/api/runner/callback \
  -H "x-runner-token: BADTOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"execution_result","execution_id":1,"status":"passed"}' | jq .

# Test SSRF via site creation (INJ-06) — requires valid session cookie
curl -s -X POST http://localhost:3000/dashboard/sites/new \
  -H "Content-Type: application/json" \
  -b "session_token=<VALID_TOKEN>" \
  -d '{"name":"SSRF Test","base_url":"http://postgres:5432","description":"SSRF probe"}' | jq .
```

---

## H. Results Summary Template

After completing all test cases, complete this table and attach as the executive summary:

| Category | Total Cases | Passed | Failed (Finding) | Not Tested | Notes |
|---|---|---|---|---|---|
| Authentication Bypass | 12 | | | | |
| Authorization Bypass | 12 | | | | |
| Vault Security | 12 | | | | |
| Input Validation | 15 | | | | |
| API Security | 10 | | | | |
| Infrastructure | 12 | | | | |
| Secrets Exposure | 12 | | | | |
| **Total** | **85** | | | | |

**A "Passed" result means the system behaved securely (the attack was blocked). A "Failed" result means a finding was confirmed.**
