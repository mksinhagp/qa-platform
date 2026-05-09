# Dockerized Local-LLM QA Platform Plan for Windsurf

## Objective

Build a browser-based local QA operations platform that can test one website at a time, starting with a booking and reservation style website such as a summer camp registration system. The platform should run in Docker, be developed in Windsurf, and use deterministic browser and API automation as the core execution model, with optional local open-source LLM reasoning at runtime for bounded adaptive behavior.[cite:85][cite:79][cite:129]

The platform must support end-to-end testing across desktop, iPhone-style, Android-style, and tablet-style formats, and cover public user flows, authenticated user flows, and admin or back-office flows. Playwright supports device emulation, authenticated state reuse, API testing, and self-hosted execution, which makes it a strong foundation for this system.[cite:1][cite:41][cite:160]

The operator experience should be a full local admin dashboard with an embedded wizard that asks questions as test setup progresses, especially for credentials, approval-gated actions, payment profiles, environment choices, and email verification setup. Next.js supports self-hosted dashboard applications, while PostgreSQL provides a stable persistent store for configuration, secrets metadata, run history, and audit data.[cite:149][cite:159]

## Intent

The goal is not just to build a test runner, but to build a reusable QA control plane that can be pointed at a single target website, collect operator input through a guided UI, securely manage credentials and payment profiles, execute full browser and API tests, validate real email confirmations, and produce detailed artifacts for review. This should be production-minded, operator-friendly, auditable, and extensible.[cite:22][cite:24]

Deterministic automation should remain the source of truth for pass and fail outcomes. Local LLM reasoning through Ollama should be used only in bounded roles such as selector healing, fallback path exploration, screenshot or DOM summarization, and failure explanation so that reliability remains higher than a purely agentic approach.[cite:22][cite:79][cite:129]

All state-changing actions should be approval-gated, including checkout submission, registration submission where appropriate, and all admin writes. The platform should support both session-only and encrypted saved credentials, with a master password required to unlock saved secrets, aligning with OWASP guidance around secure handling of credentials and secrets.[cite:135][cite:171][cite:178]

## Context and Background

The platform will be built in Windsurf or Devin, but the websites under test may be built manually or with any tool. The first target profile is a booking and reservation workflow with test payments, session selection, attendee forms, waiver and consent flows, multi-child or multi-attendee booking, and follow-up email confirmations for registration and booking.[cite:22]

The UI should be browser-based and local-first. The stack direction is now fixed as Next.js for the dashboard and PostgreSQL for persistent storage. The platform should support multiple operator accounts, a separate master-password-protected secret vault, multiple named sandbox card and ACH profiles, real email verification support, and approval requirements for all write actions.[cite:149][cite:159][cite:171][cite:178]

The test priority order is fixed as: Registration, Login, Browsing and Search, Cart and Checkout, API Health, and finally Profile and Account. The platform must also support admin and back-office flows with full functionality enabled, not just read-only coverage.[cite:20][cite:22]

## Guiding Principles

- Deterministic execution first, LLM reasoning second.[cite:22]
- One website at a time in v1, but architecture should be extensible later.[cite:22]
- Browser-based local admin dashboard with embedded guided wizard.[cite:149]
- Dockerized services for portability and repeatability.[cite:79][cite:85]
- Support real email verification flows, not only fake inboxes.[cite:173][cite:176]
- Approval required for all write actions.[cite:22][cite:178]
- Multiple operator accounts with role-based access control.[cite:178][cite:184]
- Credentials supported in both session-only and encrypted saved modes, unlocked by master password.[cite:135][cite:171]
- API validation must include reachability, schema, business rules, and response correctness.[cite:183][cite:186][cite:191]

## Locked Product Decisions

| Area | Decision |
|---|---|
| Website support | One website at a time in v1.[cite:22] |
| UI | Full admin dashboard with embedded wizard, browser-based and local.[cite:149][cite:175] |
| Frontend framework | Next.js.[cite:149] |
| Database | PostgreSQL.[cite:154][cite:159] |
| Local reasoning | Ollama with open-source local models.[cite:79][cite:129] |
| Core test engine | Playwright for browser and API tests.[cite:41][cite:85] |
| Credentials | Session-only and encrypted saved credentials.[cite:135][cite:171] |
| Vault security | Master password required to unlock secrets.[cite:171] |
| Operators | Multiple operator accounts.[cite:184][cite:187] |
| Target domain | Booking and reservation, similar to summer camp registration.[cite:22] |
| Public flow priority | Registration → Login → Browsing/Search → Cart/Checkout → API Health → Profile/Account.[cite:20] |
| Public flow complexity | Session selection, attendee forms, waiver/consent, multi-child or multi-attendee booking.[cite:22] |
| Payments | Sandbox card and ACH, approval required for submission.[cite:22] |
| Email support | Real email confirmation testing after registration and booking.[cite:173][cite:176] |
| Admin functionality | Full functionality enabled, with approval for all writes.[cite:22][cite:178] |
| API validation | Reachability, schema validation, business-rule validation, response correctness.[cite:183][cite:186][cite:191] |

## Proposed Architecture

### Core Services

1. **dashboard-web**  
   Next.js local dashboard for operator login, wizard-based site setup, vault unlock, approvals, run execution, artifact review, and reports. Next.js supports self-hosting for this kind of local dashboard application.[cite:149][cite:150]

2. **orchestrator-api**  
   TypeScript backend layer, either inside the Next.js app or as a separate service, responsible for test plan creation, run lifecycle management, approval workflows, email polling coordination, credential brokering, and audit logs.[cite:22][cite:24]

3. **postgres**  
   Persistent metadata store for sites, operators, roles, credentials metadata, encrypted secret blobs or references, payment profiles, test plans, run records, email assertions, approvals, and artifact indexes. PostgreSQL has an official Docker image suitable for this deployment style.[cite:154][cite:159]

4. **playwright-runner**  
   Dedicated runner service for browser automation, mobile and tablet emulation, visual snapshots, accessibility checks, authentication state generation, API testing, and report artifact creation. Playwright supports authentication reuse, global setup, projects, and Docker-based execution.[cite:41][cite:160][cite:85]

5. **ollama**  
   Local LLM service for bounded reasoning, selector recovery, exploratory fallback logic, page summarization, and failure explanation. Ollama provides a local API and Docker-based deployment model.[cite:79][cite:129]

6. **email-integration service or module**  
   A real email integration layer for reading incoming confirmation emails through real inbox access such as IMAP or provider APIs. This must support correlation of inbound messages with a specific test run and extraction of links, codes, and confirmation evidence.[cite:173][cite:176]

### Optional Later Services

- Browser Use or browser automation sidecar for more exploratory agent-driven runs.[cite:68][cite:118]
- Chrome DevTools Protocol or CDP tooling for deeper Chromium-specific diagnostics and emulation.[cite:106][cite:109][cite:120]
- Separate artifact storage service if the local file-based approach becomes limiting.[cite:22]

## High-Level Functional Modules

### 1. Operator Authentication and RBAC

The dashboard should support multiple operator accounts with role-based access control. Roles should be explicit and enforce least privilege for modules and actions, following OWASP authorization guidance.[cite:178][cite:190]

Suggested roles:

- Super Admin
- QA Admin
- QA Operator
- Reviewer

### 2. Secret Vault

The platform should separate dashboard login from vault unlock. Operators may log in to the dashboard, but saved website credentials, payment profiles, email credentials, and API tokens should remain locked until the master password is entered. Passwords and secrets should be encrypted at rest and never stored or logged in plain text, consistent with OWASP password and secrets guidance.[cite:135][cite:171]

Secret categories:

- Website user credentials
- Website admin credentials
- Sandbox card profiles
- Sandbox ACH profiles
- Email inbox credentials
- API keys or tokens

Modes:

- Session-only secret use
- Encrypted saved secret use

### 3. Site Onboarding Wizard

The dashboard should include a wizard inside the admin application that asks questions as setup progresses. The wizard should capture:

- Base URL
- Environment type
- Public and admin routes
- Authentication type
- Whether email verification is required
- Payment support type
- Device and browser coverage selection
- Which flows to include in smoke versus full runs

### 4. Test Planner

A reusable planner should generate a test plan from the configured site and operator selections. The planner should build ordered flow sequences and label actions as read-only or write-capable.

Default public flow order:

1. Registration
2. Login
3. Browsing and Search
4. Cart and Checkout
5. API Health
6. Profile and Account

Admin flows should be configured separately but tied to the same site definition.

### 5. Approval Engine

All write actions must require approval before execution. That includes registration submission where configured, booking finalization, payment submission, admin creates, admin updates, cancellations, and any state mutation through the UI or API.[cite:22][cite:178]

Each approval request should include:

- action category,
- target page or API,
- acting role,
- expected side effect,
- payment profile if relevant,
- run step number,
- operator approval record.

### 6. Email Verification Module

Real email support is required. The system must be able to:

- assign or select a real inbox for a run,
- poll for expected messages,
- validate subject and content patterns,
- extract confirmation links or OTPs,
- feed those back into the browser flow,
- store email evidence and timing metadata.[cite:173][cite:176][cite:166]

### 7. Playwright Execution Engine

The core runner should use Playwright projects and global setup patterns to support role-specific auth state, device coverage, and structured test grouping. Playwright supports authentication state reuse, test projects, and global setup mechanisms appropriate for this design.[cite:41][cite:160]

Coverage should include:

- Desktop Chromium
- Firefox
- WebKit
- iPhone emulation
- Android-style mobile emulation
- Tablet emulation
- API request testing
- Accessibility checks
- Visual baseline comparison
- Trace, screenshot, and video artifacts

### 8. Local LLM Reasoning Module

Ollama should be optional but integrated for bounded reasoning. The model should never be the final authority on pass and fail. Instead, it should be used for:

- selector healing,
- path recovery,
- exploratory fallback,
- screenshot or DOM summarization,
- failure explanation,
- usability commentary.

Deterministic assertions remain authoritative.[cite:22][cite:79][cite:129]

### 9. API Validation Engine

API validation must operate at four levels:

1. Reachability and status behavior
2. Schema validation
3. Business-rule validation
4. Response correctness against the run context

This can be implemented in Playwright API tests with JSON schema validation helpers such as AJV-based validation patterns.[cite:183][cite:186][cite:191]

Examples for booking systems:

- session availability counts,
- attendee totals,
- waiver requirements,
- pricing correctness,
- booking state transitions,
- confirmation status,
- account or reservation linkage.

## Suggested Data Model

At a minimum, create entities for:

- operators
- roles
- operator_role_assignments
- sites
- site_environments
- site_credentials
- payment_profiles
- email_inboxes
- test_plans
- test_plan_steps
- run_sessions
- run_step_results
- approvals
- artifacts
- auth_states
- api_contracts
- business_rules
- email_assertions

## Recommended Folder Structure

```text
qa-platform/
  apps/
    dashboard-web/
    orchestrator/
    runner/
  packages/
    ui/
    db/
    config/
    shared-types/
    auth/
    vault/
    approvals/
    email/
    reporting/
    llm/
    rules/
    playwright-core/
  docker/
    dashboard/
    runner/
    ollama/
    postgres/
  docs/
    architecture/
    prompts/
    runbooks/
  tests/
    dashboard/
    integration/
  artifacts/
  docker-compose.yml
```

## Recommended Phased Plan

### Phase 0: Discovery and Setup

- Scaffold monorepo in Windsurf.
- Set up Next.js dashboard app.
- Set up PostgreSQL and DB access layer.
- Set up Docker Compose skeleton.
- Establish coding standards, logging, env handling, and local developer workflow.[cite:149][cite:159]

### Phase 1: Auth and Vault Foundation

- Build operator login.
- Add role-based access control.
- Add master password bootstrap and unlock flow.
- Add encrypted secret storage design.
- Build credential CRUD UI for session-only and saved credentials.[cite:171][cite:178][cite:184]

### Phase 2: Site Onboarding and Wizard

- Build site creation screens.
- Build wizard for onboarding one target site.
- Add environment configuration.
- Add role-specific site credentials.
- Add named payment profiles.
- Add email inbox configuration.

### Phase 3: Playwright Runner Foundation

- Build runner container.
- Set up Playwright config, projects, and global setup.
- Add trace, screenshot, and report persistence.
- Implement guest, user, and admin auth-state handling.[cite:41][cite:160][cite:85]

### Phase 4: Public Flow Coverage

- Registration flow
- Email verification flow
- Login flow
- Browsing and search flow
- Session selection flow
- Attendee forms flow
- Waiver and consent flow
- Multi-attendee booking flow

### Phase 5: Checkout and Payment Approval

- Cart and review flow
- Approval-gated payment submission
- Sandbox card and ACH execution support
- Booking confirmation page validation
- Confirmation email validation

### Phase 6: API Testing Layer

- API reachability suite
- Schema validation suite
- Business-rule assertions
- Response correctness checks tied to browser flow outcomes.[cite:183][cite:186]

### Phase 7: Admin and Back-Office Coverage

- Admin login
- Booking lookup
- Registration lookup
- Admin edits
- Reporting and list screens
- Approval handling for all writes

### Phase 8: Local LLM Enhancements

- Ollama service integration
- Selector healing helpers
- Exploratory fallback agent
- Failure summarization
- Usability review prompts

### Phase 9: Hardening and Release Readiness

- Audit log review
- Security review for credential handling
- Backup and restore of PostgreSQL
- Artifact retention policy
- Runbook documentation
- CI or local repeatable build verification

## Development Constraints and Rules for Windsurf

- Use Next.js for the dashboard and TypeScript throughout the main codebase where practical.[cite:149]
- Use PostgreSQL as the authoritative metadata store.[cite:154][cite:159]
- Keep Playwright as the deterministic execution engine and source of truth for pass or fail.[cite:41][cite:85]
- Use Ollama only for bounded reasoning tasks and never as sole verifier.[cite:79][cite:129]
- Every write action must pass through the approval engine before execution.[cite:22][cite:178]
- Secrets must never be logged in plaintext and must be encrypted at rest.[cite:135][cite:171]
- Build the product for one website at a time in v1, but avoid hard-coding assumptions that block multi-site support later.[cite:22]
- Real email confirmation handling is required in the architecture from the beginning.[cite:173][cite:176]
- Support both public and admin roles for the site under test.[cite:22]
- Design the wizard so further questions and configuration decisions can be answered inside the platform rather than only in code.[cite:20][cite:22]

## Immediate Implementation Plan in Windsurf

1. Initialize the monorepo and Docker Compose baseline.
2. Create the Next.js dashboard shell with login page, protected admin layout, and placeholder wizard.
3. Create the PostgreSQL schema and DB access package.
4. Build operator login and role model.
5. Build vault bootstrap and master-password unlock flow.
6. Create initial site onboarding pages.
7. Create initial credentials and payment profile screens.
8. Create a basic run planner UI with mock flow steps.
9. Scaffold the Playwright runner container and baseline config.
10. Add a first thin end-to-end registration flow skeleton.
11. Add audit logging and approval objects before adding real writes.
12. Add real email module after base onboarding and runner are working.

## Detailed Mega Plan for Phase 0 and Phase 1

This section refines the earlier phased plan into an implementation-ready blueprint for the first two phases only. The goal is to reduce ambiguity before scaffolding so the initial repo shape, DB model, security boundaries, and UI routes do not need major rewrites immediately after setup.

### Recommended v1 Implementation Strategy

- Keep the first implementation as a monorepo with a single primary web application and a separate runner service.
- Keep the orchestrator logic inside the Next.js application for Phase 0 and Phase 1, but isolate it behind service modules so it can later move to a dedicated service without rewriting the UI layer.
- Treat Playwright as an external worker boundary from day one, even if the earliest calls are simple.
- Treat the vault as a distinct security boundary from dashboard login from day one.
- Centralize database access inside a dedicated DB package so the dashboard and orchestration code do not scatter raw queries across route handlers or UI code.
- Implement real approval objects and audit objects early, even if the first runner flows are mock or dry-run only.

### Phase 0 Mega Plan: Discovery and Setup

#### Phase 0 Objectives

By the end of Phase 0, the project should have:

- a working monorepo,
- a running Docker Compose stack,
- a bootable Next.js dashboard shell,
- a PostgreSQL instance with initial schema migrations,
- a DB access package,
- a baseline auth/session shell,
- a runner container shell,
- shared config, logging, and environment conventions,
- and enough structure that Phase 1 can focus on auth and vault without repo churn.

#### Recommended Monorepo Structure for v1

```text
qa-platform/
  apps/
    dashboard-web/              # Next.js admin dashboard and route handlers
    runner/                     # Playwright runner service
  packages/
    db/                         # migrations, queries, repositories, seed helpers
    shared-types/               # DTOs, enums, run states, approval states
    config/                     # env parsing, service config, feature flags
    auth/                       # auth services, RBAC policy helpers, session utilities
    vault/                      # master-password unlock, encryption helpers, secret brokers
    approvals/                  # approval request models and decision helpers
    email/                      # inbox abstractions and parsing utilities
    llm/                        # Ollama client and bounded reasoning contracts
    reporting/                  # artifact indexing and report shaping
    playwright-core/            # shared runner interfaces and step definitions
    ui/                         # shared dashboard components
  docker/
    dashboard/
    runner/
    postgres/
    ollama/
  docs/
    architecture/
    decisions/
    runbooks/
    prompts/
  artifacts/
  docker-compose.yml
  .env.example
  package.json
  pnpm-workspace.yaml
  turbo.json
```

#### Package Responsibilities

- `apps/dashboard-web`
  - operator UI,
  - protected pages,
  - setup wizard,
  - API and server actions for orchestration,
  - approval inbox,
  - audit review,
  - configuration screens.

- `apps/runner`
  - executes Playwright browser and API runs,
  - consumes run instructions,
  - uploads traces, screenshots, and structured results,
  - never stores long-term secrets locally.

- `packages/db`
  - owns migrations,
  - repository or query functions,
  - transaction helpers,
  - seed scripts for bootstrap roles and defaults,
  - a single access layer for PostgreSQL.

- `packages/auth`
  - login policy,
  - password hashing and verification,
  - session shaping,
  - RBAC checks,
  - route protection helpers.

- `packages/vault`
  - master password bootstrap state,
  - unlock state validation,
  - key derivation,
  - secret encryption and decryption,
  - brokered access for runner usage.

#### Docker Compose Services for Phase 0

The initial Compose file should include the following services:

1. `dashboard-web`
   - Next.js app in dev or local self-hosted mode.
   - Exposes the main UI and route handlers.
   - Depends on `postgres`.

2. `postgres`
   - Primary metadata database.
   - Persistent named volume.
   - Bootstrap scripts or migrations run on startup or from a separate migration task.

3. `runner`
   - Playwright container with browsers installed.
   - Mounted artifact output directory.
   - Idle in Phase 0 except for smoke wiring or health checks.

4. `ollama`
   - Included but optional to enable by profile or environment flag.
   - Not required for Phase 0 acceptance.

5. `migrator` or startup migration task
   - Optional one-shot service that applies DB migrations before the web app starts.

#### Suggested Local Ports and Volumes

- `dashboard-web`: 3000
- `postgres`: 5432
- `ollama`: 11434
- shared bind mount or named volume for `artifacts/`
- named volume for PostgreSQL data

#### Environment and Secret Conventions

Create a single shared environment contract for all services. At minimum:

- app environment name,
- dashboard session secret,
- PostgreSQL connection string,
- vault bootstrap state flag,
- artifact root path,
- runner callback or API base URL,
- Ollama base URL,
- logging level,
- encryption tuning settings such as Argon2 work factors.

The `.env.example` file should include placeholders only and no real credentials.

#### Recommended UI Route Structure in Phase 0

The dashboard should start with a route map that already anticipates later modules:

- `/login`
- `/unlock`
- `/`
- `/dashboard`
- `/dashboard/sites`
- `/dashboard/sites/new`
- `/dashboard/runs`
- `/dashboard/approvals`
- `/dashboard/artifacts`
- `/dashboard/settings/operators`
- `/dashboard/settings/roles`
- `/dashboard/settings/vault`
- `/dashboard/settings/payment-profiles`
- `/dashboard/settings/email-inboxes`
- `/dashboard/audit`

Pages may initially be placeholders, but the route contract should exist from the start.

#### Recommended API and Server Boundaries in Phase 0

For the first implementation pass, keep orchestration inside the Next.js app using route handlers or server actions, grouped by domain:

- auth
- vault
- sites
- runs
- approvals
- audit
- settings

Internally, structure logic as services rather than writing direct data access inside handlers. This keeps a clear upgrade path if orchestration later moves into its own API service.

#### PostgreSQL Schema Outline for Phase 0

Phase 0 only needs the bootstrap tables and a minimal skeleton for later expansion.

Core bootstrap tables:

- `operators`
- `roles`
- `operator_role_assignments`
- `audit_logs`
- `system_settings`
- `vault_state`
- `sites`
- `site_environments`
- `payment_profiles`
- `email_inboxes`
- `run_sessions`
- `approvals`
- `artifacts`

At this stage, some tables can be skeletal, but table names and keys should be stable.

#### Initial Table Intent

- `operators`
  - operator identity, login name, display name, active flag, password hash, last login metadata.

- `roles`
  - role name, description, immutable system role flag.

- `operator_role_assignments`
  - many-to-many mapping between operators and roles.

- `vault_state`
  - whether a master password has been initialized,
  - KDF parameters,
  - wrapped root key metadata,
  - last unlock metadata.

- `system_settings`
  - non-secret configuration flags,
  - feature toggles,
  - environment metadata.

- `audit_logs`
  - actor,
  - action,
  - target type,
  - target id,
  - before or after summary references,
  - status,
  - timestamp,
  - correlation id.

#### Logging and Audit Standards

Logging should be structured and correlation-friendly from the start.

- Every request gets a correlation id.
- Every run gets a run id.
- Every approval request gets an approval id.
- Never log plaintext secrets.
- Never log full credentials or payment instruments.
- Security-sensitive events should be written to both operational logs and persistent audit tables where appropriate.

#### Phase 0 Testing and Verification

Before Phase 0 is considered complete, verify:

- the Compose stack starts cleanly,
- the dashboard loads,
- the DB connection and initial migration run successfully,
- placeholder protected routes enforce authentication,
- the runner container is reachable,
- and artifacts can be written to the mounted location.

#### Phase 0 Exit Criteria

Phase 0 is complete when:

- repo structure is stable,
- local startup is documented and repeatable,
- the dashboard, DB, and runner all boot together,
- baseline routes exist,
- baseline schema exists,
- and the project is ready to add real operator auth and vault flows without structural rework.

### Phase 1 Mega Plan: Auth and Vault Foundation

#### Phase 1 Objectives

By the end of Phase 1, the platform should support:

- operator login,
- role-based authorization,
- master password bootstrap,
- vault unlock,
- encrypted saved secrets,
- session-only secrets,
- audit logging for security-sensitive actions,
- and protected UI flows for credentials management.

#### Recommended Authentication Approach

Use a credentials-based authentication flow suitable for local self-hosted usage.

Recommended characteristics:

- operator accounts are stored in PostgreSQL,
- passwords are hashed with Argon2id,
- authenticated sessions are HTTP-only and server-validated,
- route protection is enforced on the server side,
- and RBAC checks are performed both in the UI layer and at the action or handler level.

For Phase 1, authentication should remain separate from vault unlock. An operator may be logged in but still unable to access saved secrets until vault unlock succeeds.

#### Recommended RBAC Model

Start with the following system roles:

- `super_admin`
- `qa_admin`
- `qa_operator`
- `reviewer`

Represent permissions as explicit capabilities rather than role-name checks scattered across code. Example capability families:

- operator management,
- site configuration,
- credential management,
- vault administration,
- run execution,
- approval decision,
- artifact review,
- audit review.

This allows later custom roles without rewriting authorization logic.

#### Phase 1 Database Expansion

Add or flesh out the following tables during Phase 1:

- `operator_sessions`
- `vault_unlock_sessions`
- `secret_records`
- `secret_access_logs`
- `site_credentials`
- `approval_policies`

Recommended intent for these tables:

- `operator_sessions`
  - tracks active login sessions, issuance time, expiry, and revocation state.

- `vault_unlock_sessions`
  - short-lived unlock context tied to operator session,
  - stores unlock expiry,
  - records device or browser context metadata if desired,
  - never stores the master password itself.

- `secret_records`
  - stores metadata for encrypted website credentials, admin credentials, email inbox credentials, payment profiles, and API tokens.
  - includes category, owner scope, encryption metadata, version, and rotation fields.

- `secret_access_logs`
  - tracks every reveal, decrypt-for-run, update, or delete-like archival action.

- `site_credentials`
  - links a site environment and logical role to a stored or session-only secret reference.

- `approval_policies`
  - defines which action categories always require approval and which require elevated confirmation.

#### Vault Design Recommendation

Use an envelope encryption design.

Recommended flow:

1. During vault bootstrap, the operator sets a master password.
2. The system derives a master key using Argon2id with stored salt and tunable work factors.
3. That derived key unwraps or protects a root vault key.
4. Each saved secret is encrypted with its own data encryption key.
5. Each data encryption key is wrapped by the root vault key.
6. Only the wrapped keys and encrypted payloads are stored in PostgreSQL.

Important security rules:

- never store the master password,
- never store decrypted secrets in the database,
- never log decrypted secrets,
- keep vault unlock lifetime short,
- require re-unlock for highly sensitive operations if the unlock session is stale.

#### Session-Only Versus Saved Secret Flows

Two secret modes should exist from the start:

1. Session-only
   - operator provides credentials for the current session only,
   - secrets are kept in memory or short-lived session storage,
   - secrets are discarded on logout, unlock expiry, or browser close depending on implementation policy.

2. Saved encrypted
   - operator saves a reusable secret into the vault,
   - secret metadata is visible,
   - plaintext is never displayed after save except through explicit reveal or brokered runtime use if permitted.

#### Recommended Vault User Experience

Key screens and flows:

- first-run vault bootstrap,
- vault unlock screen,
- vault status indicator in the app shell,
- create secret flow,
- assign secret to site role flow,
- reveal or test secret flow with audit logging,
- lock vault action,
- unlock timeout handling.

The UI should make it visually obvious whether the user is:

- not logged in,
- logged in but vault locked,
- logged in and vault unlocked.

#### Recommended Route Structure for Phase 1

Add or flesh out the following pages:

- `/login`
- `/unlock`
- `/dashboard`
- `/dashboard/settings/operators`
- `/dashboard/settings/operators/new`
- `/dashboard/settings/roles`
- `/dashboard/settings/vault`
- `/dashboard/settings/vault/bootstrap`
- `/dashboard/settings/credentials`
- `/dashboard/settings/credentials/new`
- `/dashboard/settings/payment-profiles`
- `/dashboard/settings/payment-profiles/new`
- `/dashboard/settings/email-inboxes`
- `/dashboard/settings/email-inboxes/new`
- `/dashboard/audit`

#### Recommended Action and API Surface for Phase 1

The initial server-side actions or route handlers should cover:

- operator login and logout,
- password verification,
- session validation,
- role assignment management,
- vault bootstrap,
- vault unlock and lock,
- create encrypted secret,
- create session-only secret binding,
- assign secret to site environment role,
- list secret metadata,
- audit security events.

#### Audit Events Required in Phase 1

At minimum, audit these events:

- operator login success and failure,
- operator logout,
- role assignment change,
- vault bootstrap,
- vault unlock success and failure,
- vault lock,
- secret create,
- secret update,
- secret archive or disable,
- secret reveal or runtime use,
- payment profile create or update,
- email inbox credential create or update.

#### Phase 1 UI Deliverables

The dashboard should include the following usable surfaces by the end of Phase 1:

- login page,
- protected admin shell,
- vault bootstrap flow,
- vault unlock modal or page,
- operator listing page,
- operator create or edit page,
- credentials listing page,
- create credential page,
- payment profile listing page,
- email inbox listing page,
- audit log viewer with basic filters.

#### Phase 1 Testing Plan

Testing should cover:

- password hashing and verification,
- session creation and protected route enforcement,
- capability-based RBAC checks,
- master password bootstrap,
- unlock expiry behavior,
- encrypt and decrypt round trips,
- prevention of secret access when vault is locked,
- audit event creation,
- and basic UI route access behavior by role.

Add a small integration test suite early for the vault flows because this is a high-risk security boundary.

#### Phase 1 Exit Criteria

Phase 1 is complete when:

- operators can log in,
- protected routes enforce auth and role checks,
- the vault can be bootstrapped,
- saved secrets can be encrypted and stored,
- session-only secrets can be used without persistence,
- vault unlock and lock flows work reliably,
- security-sensitive actions are audited,
- and the system is ready for site onboarding and credential assignment work in Phase 2.

### Recommended Default Answers to Current Open Questions

To keep implementation moving, use the following defaults unless later requirements force a change:

- Start with IMAP-based real email integration behind an abstraction so provider APIs can be added later.
- Keep the orchestrator inside Next.js for Phase 0 and Phase 1, but isolate domain services for future extraction.
- Use envelope encryption with Argon2id-derived master unlock and per-secret encryption keys.
- Use stronger confirmation for high-risk actions such as payment submission and admin writes, not one-click approval for everything.
- Author business rules in code or config first, then add UI-managed rule editing later.
- Treat Ollama as optional in early phases and do not block Phase 0 or Phase 1 on model selection.

### Suggested Stop Point After Scaffolding

After Phase 0 and Phase 1 scaffolding is complete, stop and review before building site onboarding, approval execution pausing, or real booking flows. At that checkpoint, confirm:

- repo layout,
- auth strategy,
- vault UX,
- schema naming,
- and whether the orchestrator should remain in-process or be extracted earlier.

## Open Questions to Continue Inside Windsurf

These questions remain intentionally open so they can be answered during implementation within the dashboard and design documents:

- Should real email support begin with IMAP only, or should provider APIs be abstracted from day one?[cite:176]
- Which local models should be used first in Ollama for fast reasoning versus richer analysis?[cite:129]
- Should the orchestrator be inside Next.js server actions and route handlers, or a separate service for cleaner isolation?[cite:149]
- What encryption strategy should be used for saved secrets and master-password-derived keys?[cite:171][cite:135]
- Should approval UX use one-click approval for all writes or stronger confirmation for high-risk financial/admin actions?[cite:178]
- Which artifact retention and cleanup strategy is appropriate for local use?
- How should business rules be authored per site: UI-managed rules, config files, or both?[cite:183][cite:191]
- Which booking-specific edge cases should be made first-class templates, such as waitlists, coupons, or age restrictions?
- Should email content assertions focus only on delivery and link extraction in v1, or also cover template correctness and branding?
- How much of Chrome DevTools Protocol or Browser Use should be included in v1 versus postponed?[cite:106][cite:118]

## Starter Prompt for Windsurf

Use this project brief as the authoritative product and architecture context. Begin by creating a detailed implementation plan for Phase 0 and Phase 1 only. Show the proposed monorepo structure, Docker Compose services, PostgreSQL schema outline, auth approach, vault design, and initial UI route structure before writing code. After that, scaffold the base repo and stop for review.
