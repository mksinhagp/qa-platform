# Master Plan: QA Automation Platform (Master-Tester Edition)

A dockerized, local-first QA control plane that lets one operator act as the master tester on behalf of a diverse user population, exercising a single booking-style website end-to-end across personas, devices, networks, and accessibility profiles, with deterministic Playwright execution as the source of truth and bounded local LLM reasoning as a helper.

---

## 1. Confirmed Decisions (locked this session)

| Area | Decision |
|---|---|
| Persona library | Mid-range: 6 first-class personas with extensibility |
| Accessibility | Automated WCAG 2.2 AA (axe-core + keyboard + focus + contrast + reflow) |
| Human-error simulation | Core profile: typos, abandonment, back/refresh, decline, timeout, double-click, slow network |
| Device/network coverage | Full matrix: Chromium/Firefox/WebKit + iPhone + Android + tablet + low-end CPU + offline + zoom + slow 3G |
| Email validation | Full: delivery + branding + render fidelity + link/OTP + content assertions |
| Orchestrator boundary | Hybrid in Next.js, packaged as services for future extraction |
| Approval UX | Tiered: none / one-click / strong-confirm with reason |
| Vault crypto | Argon2id KDF + AES-256-GCM envelope (per-secret DEK wrapped by root key) |
| Run model | Matrix run: one parent run, many child executions across personas × devices × networks |
| Reporting | Operator-friendly narrative + technical drill-down |
| Artifact retention | Configurable per artifact type; daily cleanup job |
| Business rules | Hybrid: typed config files in repo now, UI editor later |
| DB access | PostgreSQL stored procedures + thin Node `pg` client (snake_case, audit columns) |
| Auth | Custom in `packages/auth`: Argon2id, server session table, capability RBAC |
| Monorepo | pnpm workspaces + Turborepo |
| Booking templates | Full library: capacity, waitlist, coupon, age, multi-attendee, waiver, email, cancellation, refund, sibling discount, holds, partial payment, date-change |

### Defaults applied without separate question

- **UI**: Next.js (App Router) + TailwindCSS + shadcn/ui + Lucide icons (per global rules).
- **Hosting**: Local Docker on Mac is primary; Compose stack designed to run unchanged on a Linux server later.
- **Ollama models**: Selection deferred to Phase 8. Plan reserves a benchmark step covering `llama3.1:8b`, `qwen2.5:7b`, `phi3:mini` for fast tasks and `qwen2.5:14b` (or larger when hardware allows) for deeper analysis.
- **CDP / Browser Use**: Neither in v1. The runner exposes an extension interface so either can be plugged in later.

---

## 2. What This Master Plan Adds Over the Existing Plan

The existing `dockerized-local-llm-qa-platform-plan.md` is directionally correct. This master plan adds:

- A **first-class Persona Engine** so the platform truly tests on behalf of diverse users.
- A **Matrix Run** data model with explicit parent/child run records.
- A **Tiered Approval Engine** with action categories and confirmation strength.
- A **detailed Vault spec** using Argon2id + AES-256-GCM envelope encryption.
- A **stored-procedure-first** PostgreSQL access pattern aligned with global rules.
- A **narrative reporting layer** specifically for non-technical stakeholders.
- A **confusion / friction telemetry** layer that captures signals real users would experience.
- **Concrete Phase 0 and Phase 1 task breakdowns** with ordered work items and exit gates.

---

## 3. New First-Class Concept: Persona Engine

Because the operator is the master tester for hundreds of people of varied ages and abilities, personas are not flavor text — they are typed configuration that drives Playwright behavior, oracles, and reporting.

### 3.1 Persona Schema

```ts
interface Persona {
  id: string;                      // e.g. "elderly_first_time"
  display_name: string;            // "Eleanor, 72, first-time online"
  age_band: "child" | "teen" | "adult" | "older_adult" | "senior";
  device_class: "desktop" | "laptop" | "tablet" | "mobile" | "low_end_mobile";
  network_profile: "fast" | "normal" | "slow_3g" | "flaky";
  typing_wpm: number;              // realistic typing speed
  typing_error_rate: number;       // 0..1, random typo probability per char
  reading_wpm: number;             // affects pre-action dwell time
  comprehension_grade_level: number; // copy assertions use this
  hesitation_ms_per_decision: number;
  retry_tolerance: number;         // how many failed attempts before abandon
  distraction_probability: number; // 0..1, chance to switch tab mid-flow
  assistive_tech: "none" | "screen_reader" | "high_contrast" | "zoom_400";
  motor_profile: "normal" | "tremor" | "single_handed";
  language_proficiency: "native" | "second_language";
  payment_familiarity: "high" | "low";
  abandons_on: string[];           // e.g. ["captcha", "phone_verification"]
}
```

### 3.2 v1 Persona Library (6 personas)

1. **`confident_desktop`** — Average tech-savvy adult on a fast desktop. Baseline.
2. **`average_mobile`** — Adult on iPhone, normal network, distracted.
3. **`elderly_first_time`** — Senior, low-end tablet, 400% zoom acceptable, slow typing, low payment familiarity, abandons on captcha.
4. **`low_literacy_slow`** — Adult, comprehension grade 4, slow reading, mobile, second language, high hesitation.
5. **`screen_reader_user`** — Adult, desktop, NVDA-style emulation via accessibility tree, keyboard-only.
6. **`motor_impaired_tremor`** — Adult, mobile, tremor profile (drift on taps), needs large targets, slower interactions.

### 3.3 Persona Effects on Playwright

- Typing speed and errors drive `page.keyboard.type` with delay + corrections.
- Hesitation drives pre-click `waitForTimeout` calibrated to reading WPM × on-screen text length.
- Network profile maps to Playwright `route` throttling or context-level conditions.
- Assistive tech profile drives:
  - `screen_reader` → keyboard-only navigation and accessibility-tree assertions.
  - `zoom_400` → context viewport scaling and reflow checks.
  - `high_contrast` → forced-colors media emulation.
- Motor profile drives jitter on click coordinates and minimum-target validation.
- Abandonment list drives oracle behavior (a captcha hit on `elderly_first_time` is an expected abandonment, not a failure).

### 3.4 Persona-Aware Oracles

Some assertions are persona-specific:

- For `screen_reader_user`: every form control must have an associated label and the focus order must match the visual order.
- For `elderly_first_time` and `motor_impaired_tremor`: every interactive target must be ≥ 44×44 CSS px (WCAG 2.5.5).
- For `low_literacy_slow` and `elderly_first_time`: critical copy (CTAs, error messages, confirmations) must score ≤ grade 7 (Flesch-Kincaid).
- Persona time budgets: a flow that takes > 2× the persona's expected completion time is reported as a friction issue, not a hard failure.

### 3.5 Confusion / Friction Telemetry

The runner captures signals that mimic real-user confusion:

- repeated clicks on non-interactive elements,
- hover-without-click on CTAs,
- scroll-up after submit (suggests they didn't see an inline error),
- form fields edited > 2 times,
- focus exits an input without a value when a value was required,
- back-button presses inside a flow,
- time-to-first-meaningful-action.

These produce a **per-persona friction score** alongside hard pass/fail.

---

## 4. Architecture (Refined)

### 4.1 Stack Lock-in

- Next.js 14+ (App Router) with TypeScript
- TailwindCSS + shadcn/ui + Lucide
- PostgreSQL 16
- Stored procedures (`PL/pgSQL`) for all data access
- `pg` Node client behind a typed `packages/db` wrapper that only invokes procs
- Playwright (latest LTS) in a dedicated runner container with all browsers
- Ollama (optional Compose profile)
- Docker + Docker Compose
- pnpm workspaces + Turborepo

### 4.2 Monorepo Layout

```text
qa-platform/
  apps/
    dashboard-web/            # Next.js dashboard (UI + orchestrator services)
    runner/                   # Playwright runner service (HTTP-controlled)
  packages/
    db/                       # pg client + typed proc wrappers + migrations
    shared-types/             # DTOs, enums, run states, persona schema
    config/                   # env parsing, feature flags
    auth/                     # custom auth + capability RBAC
    vault/                    # Argon2id + AES-256-GCM envelope vault
    approvals/                # tiered approval engine
    email/                    # IMAP + provider API abstraction
    llm/                      # Ollama client and bounded prompts
    reporting/                # narrative + technical report assembly
    personas/                 # persona schema + v1 library + oracles
    playwright-core/          # shared step library, persona-aware helpers
    accessibility/            # axe-core wrapper, keyboard nav, contrast, reflow
    rules/                    # site business-rule loader (typed config files)
    ui/                       # shared dashboard components (shadcn/ui)
  docker/
    dashboard/Dockerfile
    runner/Dockerfile
    postgres/init/            # role + extension init only (NOT app schema)
  db/
    migrations/               # numbered, idempotent SQL files
    procs/                    # stored procedure definitions
    seed/                     # bootstrap roles, default personas, dev fixtures
  sites/                      # per-site config (rules, secrets refs, fixtures)
  artifacts/                  # mounted volume for traces/screenshots/videos
  docs/
    architecture/
    decisions/                # ADRs
    runbooks/
    prompts/
  docker-compose.yml
  docker-compose.override.yml # local dev overrides
  .env.example
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
```

### 4.3 Docker Compose Services

```yaml
# Conceptual outline only; final docker-compose.yml will match this shape.
services:
  postgres:        # PostgreSQL 16, named volume, healthcheck
  migrator:        # one-shot, runs SQL migrations + procs, exits
  dashboard-web:   # Next.js, depends_on migrator, port 3000
  runner:          # Playwright image with browsers, port 4000, HTTP API
  ollama:          # optional, profile: llm, port 11434
  mailcatcher:     # optional, profile: dev, for local SMTP capture
```

- Profiles: `default` (postgres, migrator, dashboard-web, runner), `llm` (adds ollama), `dev` (adds mailcatcher).
- Volumes: `pg_data`, `artifacts`, `ollama_models`.
- Networks: a single internal bridge network; only `dashboard-web` exposes a host port by default.

### 4.4 Service Responsibilities

- **`dashboard-web`** owns: UI, orchestrator services (run lifecycle, approvals, email polling, vault, audit), API surface for the runner.
- **`runner`** owns: Playwright execution, persona-aware step execution, accessibility checks, artifact production, structured result reporting back to `dashboard-web`. The runner pulls run instructions and posts results; it never reads the DB directly and never holds long-term secrets.
- **`postgres`** owns: persistence. All access through procs.
- **`ollama`** owns: bounded reasoning calls (selector healing, failure summarization). Never authoritative.

---

## 5. Data Model

### 5.1 Conventions (per global rules)

- All tables in `dbo`-equivalent default schema (`public` for PostgreSQL).
- `snake_case` table and column names.
- Every table includes `created_date`, `updated_date`, `created_by`, `updated_by`.
- Numbered migrations (`0001_*.sql`, `0002_*.sql`, ...).
- All inserts/updates/reads via stored procs; naming `sp_<entity>_<action>` (e.g. `sp_operators_insert`, `sp_runs_get_by_id`).
- Procs use `i_`, `o_`, `io_` prefixes for parameters.

### 5.2 Phase 0 Tables

| Table | Purpose |
|---|---|
| `operators` | Login identity, password hash, active flag |
| `roles` | System and custom roles |
| `capabilities` | Fine-grained permissions |
| `role_capabilities` | Role → capability mapping |
| `operator_role_assignments` | Operator → role mapping |
| `system_settings` | Non-secret config flags |
| `vault_state` | Vault bootstrap status, KDF params, wrapped root key metadata |
| `audit_logs` | Append-only audit trail |
| `sites` | One row per site under test |
| `site_environments` | Dev/Stage/Prod-like environments per site |
| `personas` | Persona definitions (ships seeded with v1 library) |
| `device_profiles` | Device + viewport + UA configurations |
| `network_profiles` | Throughput / latency / loss profiles |
| `runs` | Parent matrix run record |
| `run_executions` | Child execution per persona × device × network |
| `run_steps` | Per-step record inside an execution |
| `approvals` | Approval requests tied to run steps |
| `artifacts` | Index of files on disk (trace/video/screenshot/HAR) |

### 5.3 Phase 1 Additional Tables

| Table | Purpose |
|---|---|
| `operator_sessions` | Server-side session records |
| `vault_unlock_sessions` | Short-lived unlock context per operator session |
| `secret_records` | Encrypted secret payloads + metadata |
| `secret_access_logs` | Every reveal/decrypt-for-run event |
| `site_credentials` | Mapping from site env + role → secret reference |
| `payment_profiles` | Sandbox card/ACH metadata pointing at vault secret |
| `email_inboxes` | Inbox config pointing at vault secret |
| `approval_policies` | Per-action-category approval strength |

### 5.4 Stored Procedure Set (Phase 0 + 1, indicative)

- Auth: `sp_operators_insert`, `sp_operators_update`, `sp_operators_get_by_login`, `sp_operator_sessions_create`, `sp_operator_sessions_validate`, `sp_operator_sessions_revoke`.
- RBAC: `sp_roles_list`, `sp_capabilities_for_operator`, `sp_role_assignments_set`.
- Vault: `sp_vault_state_get`, `sp_vault_bootstrap`, `sp_vault_unlock_session_create`, `sp_vault_unlock_session_validate`, `sp_vault_lock`, `sp_secret_records_insert`, `sp_secret_records_update`, `sp_secret_records_archive`, `sp_secret_records_get_for_use`.
- Sites: `sp_sites_insert`, `sp_sites_update`, `sp_sites_list`, `sp_site_environments_set`.
- Personas/devices/networks: read-only `sp_*_list` for the seeded library.
- Audit: `sp_audit_logs_insert`, `sp_audit_logs_query`.

---

## 6. Vault Specification

### 6.1 Bootstrap

1. First operator with `vault_admin` capability initializes the vault.
2. They set a master password (min length, zxcvbn strength check).
3. System generates a random 32-byte **root vault key** (`RVK`).
4. System generates a 16-byte salt, runs Argon2id (`memory=128 MiB, iterations=3, parallelism=2` as v1 defaults; tunable via env).
5. The Argon2id output is the **key encryption key** (`KEK`).
6. `RVK` is encrypted with `KEK` using AES-256-GCM (random nonce, AAD = vault id) and stored in `vault_state.wrapped_rvk`.
7. `vault_state` stores: salt, KDF params, AAD, wrapped RVK, bootstrap timestamp, bootstrap operator id.

### 6.2 Unlock

1. Operator submits master password.
2. Server re-derives `KEK` using stored salt and KDF params.
3. Server decrypts `wrapped_rvk` to recover `RVK`.
4. Server creates a `vault_unlock_sessions` row with TTL (default 30 min, idle reset).
5. `RVK` is held only in process memory keyed by unlock-session id; never persisted.
6. On lock, logout, or TTL expiry, the in-memory `RVK` is wiped.

### 6.3 Secret Storage

1. For each saved secret, generate a random 32-byte **data encryption key** (`DEK`).
2. Encrypt secret plaintext with `DEK` using AES-256-GCM.
3. Wrap `DEK` with `RVK` using AES-256-GCM.
4. Store `secret_records`: id, category, owner scope, encrypted payload, nonce, AAD, wrapped DEK, KDF version, created/updated timestamps and actors.
5. Plaintext is never written to disk or logs.

### 6.4 Brokered Runtime Use

- The runner never receives `RVK` or master password.
- When a run needs a secret, `dashboard-web` decrypts inside its own process and passes plaintext over an internal-only HTTP call protected by a one-time token tied to the run execution.
- Every decrypt-for-run event writes a `secret_access_logs` row.

### 6.5 Rotation and Re-key

- Master password change re-wraps `RVK` only; secrets are unaffected.
- KDF parameter upgrade re-derives `KEK` and re-wraps `RVK`.
- Per-secret rotation re-encrypts the payload under a new `DEK`.

---

## 7. Auth and RBAC

### 7.1 Auth Flow

- Login: POST credentials → server verifies Argon2id hash → creates `operator_sessions` row → sets HTTP-only, `SameSite=Strict`, `Secure` cookie containing the session id.
- Every server action / route handler validates the session via `sp_operator_sessions_validate`.
- Logout revokes the session row; cookie cleared.
- Optional idle timeout (default 8 hours) and absolute timeout (default 30 days) configurable per env.

### 7.2 RBAC Model (Capability-based)

System roles seeded:

- `super_admin` — all capabilities.
- `qa_admin` — site config, credentials, runs, approvals, audit read.
- `qa_operator` — runs, approvals (within policy), credentials read-only metadata.
- `reviewer` — read-only across runs, artifacts, audit.

Capability families:

- `operator.manage`, `role.manage`, `capability.manage`
- `site.manage`, `site_credentials.manage`
- `vault.administer`, `vault.unlock`, `secret.manage`, `secret.reveal`
- `run.execute`, `run.read`, `approval.decide`, `approval.read`
- `artifact.read`, `audit.read`

Capability checks are enforced both in UI guards and at the server-action layer; UI-only checks are never trusted.

---

## 8. Approval Engine (Tiered)

### 8.1 Action Categories

| Category | Default Strength |
|---|---|
| Read-only API health probe | None |
| Browsing / search interactions | None |
| Form fill (no submit) | None |
| Registration submit | One-click |
| Login attempt with saved cred | One-click |
| Cart add/remove | One-click |
| Checkout submit (payment) | Strong (typed reason, profile confirm) |
| Admin write (create/update) | Strong (typed reason) |
| Admin delete / cancel / refund | Strong (typed reason + second approver toggle, configurable) |
| Vault administration | Strong (re-enter master password) |

### 8.2 Approval Lifecycle

1. Runner reaches a write step and pauses, posting an `approvals` row with category, target, payload summary, run_step id.
2. Dashboard renders an approval card; the appropriate UI control is shown based on category strength.
3. Operator approves, rejects, or times out.
4. Decision is written to `approvals` with decider operator id, reason, and timestamp.
5. Runner resumes and executes — or skips and reports as `skipped_by_approval`.
6. Every approval action is also written to `audit_logs`.

### 8.3 Configurability

`approval_policies` table allows the QA admin to override default strength per category, per site environment. Production envs default to maximum strength.

---

## 9. Run Model

### 9.1 Matrix Run

- Operator selects: site env, flow(s), persona set, device set, network set, browser set.
- A single `runs` row is created.
- The matrix is materialized as N `run_executions` children: one per (persona × device × network × browser × flow).
- Executions run in parallel up to a concurrency cap (default 4, tunable).
- Each execution writes `run_steps` rows and produces artifacts in `artifacts/<run_id>/<execution_id>/...`.

### 9.2 Run Lifecycle States

`runs.status` ∈ {`draft`, `awaiting_approval`, `running`, `paused_for_approval`, `completed`, `aborted`, `failed`}.

`run_executions.status` ∈ {`queued`, `running`, `paused`, `passed`, `failed`, `aborted`, `skipped_by_approval`, `friction_flagged`}.

### 9.3 Run Configuration Object

```ts
interface MatrixRunConfig {
  site_id: string;
  site_environment_id: string;
  flow_ids: string[];                  // e.g. ["registration", "login"]
  persona_ids: string[];
  device_profile_ids: string[];
  network_profile_ids: string[];
  browsers: ("chromium" | "firefox" | "webkit")[];
  approval_policy_overrides?: Record<string, "none" | "one_click" | "strong">;
  artifact_retention_override?: string; // ISO duration
  notes?: string;
}
```

---

## 10. Reporting

### 10.1 Two-Layer Report

- **Narrative layer (top of run page)**:
  - Per-persona summary card: completion status, time, friction score, top 3 issues.
  - Aggregate accessibility scorecard (axe-core severity counts, keyboard-nav pass rate, contrast pass rate).
  - Severity-ranked issue list across all executions, deduplicated.
  - Generated MP4 walkthrough per persona (5-30s clip from the trace) for sharing with non-technical stakeholders.
- **Technical drill-down (per execution)**:
  - Playwright trace viewer link.
  - Screenshots, video, HAR, console logs, network logs.
  - Step-by-step timeline with friction signals overlaid.
  - LLM failure-explanation block (when Ollama is enabled), clearly labeled as advisory only.

### 10.2 Stored vs Generated

- Structured run/execution/step data lives in PostgreSQL.
- Binary artifacts live on disk under the `artifacts/` volume, indexed by the `artifacts` table.
- Reports are rendered server-side from the indexed data; nothing is precomputed at run time except the MP4 walkthrough.

---

## 11. UI Route Map

### 11.1 Phase 0 routes (placeholders allowed but contract fixed)

- `/login`
- `/unlock`
- `/`
- `/dashboard`
- `/dashboard/sites`
- `/dashboard/sites/new`
- `/dashboard/sites/[siteId]`
- `/dashboard/runs`
- `/dashboard/runs/new`
- `/dashboard/runs/[runId]`
- `/dashboard/approvals`
- `/dashboard/artifacts`
- `/dashboard/personas` (read-only seeded list)
- `/dashboard/settings/operators`
- `/dashboard/settings/roles`
- `/dashboard/settings/vault`
- `/dashboard/settings/payment-profiles`
- `/dashboard/settings/email-inboxes`
- `/dashboard/audit`

### 11.2 Phase 1 functional pages

- `/login` — fully working.
- `/unlock` — vault unlock UI.
- `/dashboard/settings/vault/bootstrap` — first-run.
- `/dashboard/settings/operators` + `/new` — CRUD.
- `/dashboard/settings/roles` — read + assign capabilities to system roles only in v1.
- `/dashboard/settings/credentials` + `/new` — saved + session-only secret CRUD.
- `/dashboard/settings/payment-profiles` + `/new` — CRUD.
- `/dashboard/settings/email-inboxes` + `/new` — CRUD.
- `/dashboard/audit` — filterable audit log viewer.

### 11.3 Global App Shell

- Persistent header shows: logged-in operator, role badges, vault state pill (`Locked` / `Unlocked, expires in 27:14`), lock-now button, current run banner if any.
- Inactivity warning toast at 80% of vault TTL, auto-lock at 100%.

---

## 12. Email Validation Module

### 12.1 v1 Capabilities (Full)

- IMAP-first integration; provider-API interface defined for Gmail API and Microsoft Graph as future plug-ins.
- Per-run inbox correlation token (placed in registration email field as `+token` suffix or via a configured alias inbox).
- Delivery confirmation with timing metadata.
- Subject and body pattern assertions per site rule.
- Link extraction (confirmation, OTP, unsubscribe).
- Broken-link checker against extracted links.
- Attachment presence and MIME validation.
- Render fidelity: capture HTML body, render in a headless Chromium frame, screenshot at desktop and mobile widths, diff against per-site baseline (allow tolerance).
- Brand assertions: required logo, required footer text, required disclaimer text, color samples within tolerance.

### 12.2 Out of Scope for v1

- True multi-client render fidelity (Outlook, Apple Mail, Yahoo). Single headless-Chromium render is the v1 baseline.

---

## 13. Business Rules Authoring

- Each site has a `sites/<siteId>/rules.ts` file exporting a typed `SiteRules` object.
- Schema validated at load time (Zod).
- Rules drive both runner oracles (e.g. capacity respected) and API validation (e.g. response counts match).
- Rule categories in v1: capacity, waitlist, coupon validity, age restriction, multi-attendee limits, waiver requirements, cancellation windows, refund eligibility, sibling-discount eligibility, hold expiry, partial-payment rules, date-change rules.
- A future UI editor (post-v1) will read/write the same schema, optionally backed by `business_rules` DB tables.

---

## 14. Artifact Retention

### 14.1 Defaults

| Artifact | Default Retention |
|---|---|
| Playwright trace zip | 30 days |
| Video | 30 days |
| Screenshots | 90 days |
| HAR | 30 days |
| Console + network logs | 90 days |
| Narrative MP4 walkthroughs | 180 days |
| Run/execution/step records | 1 year |
| Audit logs | indefinite |

### 14.2 Mechanism

- Per-site override in `system_settings` keyed by site id.
- Daily cleanup job (cron-like; runs inside `dashboard-web` worker tick or a small `migrator`-style sidecar).
- Cleanup is recorded as audit events.
- Cleanup respects "pinned" runs (operator can pin a run to prevent deletion).

---

## 15. Logging, Audit, Observability

- Structured JSON logs from every service.
- Correlation id propagated from UI request → server action → runner call → DB proc invocation logs.
- Every security-sensitive event lands in `audit_logs`, not just stdout.
- Plaintext secrets, full payment numbers, and master password attempts are never logged. Only redacted markers.
- Health endpoints: `/api/health` on `dashboard-web`, `/health` on `runner`, basic Postgres healthcheck.
- Optional: pluggable OpenTelemetry exporter (deferred past v1 unless requested).

---

## 16. Phase 0 — Detailed Task Breakdown

### 16.1 Objective

Bootable monorepo with all services running, schema migrated, baseline routes scaffolded, runner reachable, but no real auth/vault logic yet. Code is structured so Phase 1 work doesn't churn the layout.

### 16.2 Ordered Tasks

1. Initialize git repo, `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.gitignore`, `.editorconfig`, Prettier and ESLint configs.
2. Create folder skeleton (apps/, packages/, db/, sites/, docker/, docs/, artifacts/).
3. Add `.env.example` covering all known environment variables.
4. Create `packages/config` with typed env parsing (Zod).
5. Create `packages/shared-types` with run, persona, approval, audit, secret enums and DTO types.
6. Create `packages/db` with `pg` client, transaction helper, proc-invocation wrapper, migration runner that applies numbered SQL files from `db/migrations` and `db/procs`.
7. Author Phase 0 migrations covering the tables in §5.2 with audit columns and indexes.
8. Author Phase 0 stored procedures covering minimum CRUD-by-proc for sites, personas, device/network profiles list, and audit log insert/query.
9. Seed personas, device profiles, and network profiles via SQL seed files.
10. Create `apps/dashboard-web` Next.js app (App Router, TypeScript, Tailwind, shadcn/ui, Lucide). Add a minimal layout with the global app shell shell (no real auth yet) and placeholder pages matching §11.1.
11. Create `apps/runner` Node service skeleton (Express or Fastify) with a `/health` endpoint and a stub `/run` endpoint that echoes back the config; wire Playwright dependency but no real flows yet.
12. Create `docker/dashboard/Dockerfile`, `docker/runner/Dockerfile` (Playwright base image with browsers).
13. Create `docker-compose.yml` with `postgres`, `migrator`, `dashboard-web`, `runner`; `docker-compose.override.yml` for local dev (mount source, hot reload).
14. Add Compose profiles `llm` (ollama) and `dev` (mailcatcher).
15. Wire structured logging in both services with correlation ids.
16. Add `README.md` covering local startup, common commands, and troubleshooting.
17. Add an ADR folder under `docs/decisions/` and record ADRs for: monorepo tooling, DB access pattern, vault crypto, run model, reporting model.

### 16.3 Phase 0 Exit Criteria

- `docker compose up` brings up all default services healthy.
- Migrator applies all migrations and procs idempotently.
- Dashboard loads at `http://localhost:3000`, all placeholder routes resolve.
- Runner `/health` returns 200; runner `/run` accepts a config and echoes a stub response.
- Personas, device profiles, and network profiles are visible read-only at `/dashboard/personas`.
- ADRs are committed.
- README explains start, stop, reset, and migration commands.

---

## 17. Phase 1 — Detailed Task Breakdown

### 17.1 Objective

Working operator login, capability RBAC, master-password vault bootstrap, vault unlock/lock, encrypted saved secrets, session-only secrets, and CRUD UIs for credentials, payment profiles, and email inboxes — with comprehensive audit coverage.

### 17.2 Ordered Tasks

1. Author Phase 1 migrations: `operator_sessions`, `vault_unlock_sessions`, `secret_records`, `secret_access_logs`, `site_credentials`, `payment_profiles`, `email_inboxes`, `approval_policies`, `capabilities`, `role_capabilities`.
2. Author Phase 1 stored procedures from §5.4.
3. Build `packages/auth`:
   - Argon2id password hashing utility (memory/iterations/parallelism configurable via env).
   - Session creation, validation, revocation backed by `sp_operator_sessions_*`.
   - Capability resolver (`getCapabilitiesForOperator`) backed by procs.
   - Server-action and route-handler guards: `requireOperator`, `requireCapability(cap)`.
4. Build `packages/vault`:
   - Argon2id KDF wrapper.
   - AES-256-GCM helpers (encrypt, decrypt, wrap, unwrap).
   - In-memory unlock-session registry with TTL and idle reset.
   - `bootstrap`, `unlock`, `lock`, `withUnlocked` brokered API.
   - Strict zeroization of buffers on lock.
5. Build login page (`/login`) and logout server action.
6. Build vault bootstrap page (`/dashboard/settings/vault/bootstrap`) gated on `vault.administer` capability and "no vault yet" state.
7. Build vault unlock page/modal (`/unlock`) and global app-shell vault state pill.
8. Build operator management pages (`/dashboard/settings/operators` + `/new` + edit) gated on `operator.manage`.
9. Build credentials pages (`/dashboard/settings/credentials` + `/new`) supporting both saved-encrypted and session-only modes; reveal action requires `secret.reveal` and audited.
10. Build payment-profile pages with name, type (card/ACH), last-4 metadata, and a vault-stored secret payload.
11. Build email-inbox pages with host/port/user metadata and vault-stored password.
12. Build audit log viewer with filters by actor, action, target, time range, status.
13. Wire approval-policy seeding (default tier table from §8.1) and a read-only viewer in settings.
14. Add comprehensive integration tests (Vitest):
    - Argon2id round-trip and cost calibration.
    - Vault bootstrap → unlock → encrypt secret → decrypt secret → lock → access denied.
    - KDF parameter rotation.
    - Master password rotation re-wraps RVK only.
    - Session timeout behavior.
    - Capability checks enforced server-side.
    - Audit row written for every security-sensitive action.
15. Add a smoke E2E (Playwright against `dashboard-web`) covering: bootstrap, login, unlock, create secret, lock, attempted reveal denied while locked.

### 17.3 Phase 1 Exit Criteria

- A fresh stack can: bootstrap vault → log in → unlock → create a saved secret → lock → fail to reveal → unlock → reveal → audit log shows everything.
- Session-only secrets work end-to-end and are wiped on logout.
- All security-sensitive actions appear in `audit_logs`.
- All capabilities are enforced server-side, not just in UI.
- Vault TTL idle-reset and absolute expiry behave as configured.
- Integration test suite passes in CI (or locally with a `make test` equivalent).
- Documentation: a `docs/runbooks/vault.md` runbook for bootstrap, master-password rotation, KDF upgrade, and emergency lock-out recovery.

---

## 18. Deferred to Later Phases (explicit non-goals for v1 setup)

| Item | Phase |
|---|---|
| Site onboarding wizard, env config, role-specific creds binding | 2 |
| Playwright runner real auth-state generation, persona-aware step library | 3 |
| Public flow templates (registration → profile/account) with friction telemetry | 4 |
| Approval-gated checkout + sandbox payments + confirmation email | 5 |
| API validation engine (reachability, schema, business rules, response correctness) | 6 |
| Admin / back-office full coverage | 7 |
| Ollama integration: selector healing, failure summarization, model benchmarking | 8 |
| Hardening: backups, retention enforcement audits, security review, CI templates | 9 |
| UI editor for business rules | post-v1 |
| Multi-client email render fidelity | post-v1 |
| CDP / Browser Use sidecar | post-v1 |
| Multi-site / multi-tenant general availability | post-v1 (architecture supports it; UX does not) |

---

## 19. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Persona simulation produces flaky tests | Persona time and error budgets are reported as friction, not hard fails; hard fails reserved for deterministic oracles. |
| Stored-procedure-only DB access slows feature work | Generated TS bindings for procs and a strict review checklist; allow read-only views for reporting if needed. |
| Vault complexity bugs | Dedicated integration test suite, ADR with threat model, and a documented runbook for recovery. |
| Runner secrets leakage | Brokered runtime decryption only; one-time tokens; audit on every decrypt-for-run; runner image runs as non-root. |
| Artifact disk growth | Per-type retention defaults and a daily cleanup job from day one; size dashboard exposed in settings. |
| Email render fidelity flakiness | Tolerance thresholds + per-site baselines + an explicit "branding-only" subset that can be muted without muting delivery checks. |
| Concurrency in matrix runs overwhelms local hardware | Concurrency cap + per-persona/device queue + visible queue depth in UI. |
| Local-only design later constrains a server move | Compose stack and env contract designed to work unchanged on Linux; no Mac-specific paths or assumptions. |

---

## 20. Acceptance Criteria for This Master Plan

This plan is considered ready to implement when the user confirms:

- The locked decisions table in §1 is correct.
- The Persona Engine spec (§3) matches the master-tester intent for diverse users.
- The Phase 0 task list (§16.2) is the right starting work and stops at the right gate.
- The Phase 1 task list (§17.2) is the right next slice.
- The deferred list (§18) accurately reflects what is intentionally out of scope for the initial scaffold.

---

## 21. Implementation Notes

This master plan is now the authoritative reference. Implementation proceeds step-by-step through Phase 0 tasks in §16.2. Each task is considered complete only when its acceptance criteria are met and the next task begins. The Phase 0 exit gate (§16.3) must be satisfied before Phase 1 work begins.
