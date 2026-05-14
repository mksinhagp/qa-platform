# QA Automation Platform -- User Guide

**Version:** 1.0  
**Last Updated:** 2026-05-12  
**Audience:** Operators and administrators of the QA Automation Platform

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Installation and Startup](#3-installation-and-startup)
4. [First-Time Setup](#4-first-time-setup)
5. [Dashboard Navigation](#5-dashboard-navigation)
6. [Managing Sites](#6-managing-sites)
7. [Configuring Site Details](#7-configuring-site-details)
8. [Settings: Vault, Credentials, Payments, Email](#8-settings-vault-credentials-payments-email)
9. [Managing Operators](#9-managing-operators)
10. [Personas Library](#10-personas-library)
11. [Creating and Running Test Runs](#11-creating-and-running-test-runs)
12. [Campaigns](#12-campaigns)
13. [Approvals](#13-approvals)
14. [Reports and Artifacts](#14-reports-and-artifacts)
15. [Walkthrough: Testing Registration on Yugal Kunj QA Portal](#15-walkthrough-testing-registration-on-yugal-kunj-qa-portal)
16. [Audit Log](#16-audit-log)
17. [LLM Benchmark (AI Models)](#17-llm-benchmark-ai-models)
18. [Troubleshooting](#18-troubleshooting)
19. [Architecture Reference](#19-architecture-reference)

---

## 1. Overview

The QA Automation Platform (Master-Tester Edition) is a dockerized, local-first QA control plane. It allows a single operator to act as the master tester on behalf of a diverse user population, exercising a booking-style website end-to-end across:

- **Personas** -- simulated users with varying typing speed, age, device class, assistive technology, and motor profiles
- **Devices** -- desktop, mobile, tablet viewports
- **Browsers** -- Chromium, Firefox, WebKit
- **Networks** -- fast, normal, slow 3G, flaky
- **Accessibility profiles** -- screen reader, high contrast, zoom 400%, keyboard-only navigation

The platform uses Playwright for browser automation and PostgreSQL stored procedures for all data access. An optional local Ollama LLM provides AI-powered failure summarization.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Site** | A website under test (e.g., a camp registration portal) |
| **Environment** | A deployment of a site (e.g., staging, production) |
| **Flow** | A scripted user journey (e.g., Registration, Checkout, Browse) |
| **Persona** | A simulated user profile that drives realistic browser behavior |
| **Run** | A single test execution combining site + environment + persona/device/browser matrix |
| **Campaign** | A reusable test configuration (test matrix) that can be executed repeatedly |
| **Approval Gate** | A pause point where the operator must approve/reject before the test proceeds |
| **Vault** | An encrypted store for sensitive data (credentials, payment profiles) |
| **Artifact** | Test output files: screenshots, traces, videos, HAR files, logs |
| **Friction Signal** | UX telemetry indicating user confusion (repeated clicks, hover-without-click, etc.) |

---

## 2. Prerequisites

Before running the platform, ensure you have:

- **Docker Desktop** (with Docker Compose v2)
- **Node.js 20+**
- **pnpm 8.15+** (package manager)
- A modern web browser (for accessing the dashboard)

### Hardware Recommendations

- 8 GB RAM minimum (16 GB recommended for concurrent browser testing)
- 10 GB free disk space (for Docker images, artifacts, and database)

---

## 3. Installation and Startup

### 3.1 Clone and Install

```bash
# Clone the repository
git clone <repository-url> WebsiteTester
cd WebsiteTester

# Install all dependencies
pnpm install
```

### 3.2 Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Run the interactive DB credential setup
npx tsx scripts/setup-db-credentials.ts
```

The setup script prompts for:
- PostgreSQL Host (default: `postgres`)
- PostgreSQL Port (default: `5432`)
- Database Name (default: `qa_platform`)
- Username (default: `qa_user`)
- Password (required, min 8 characters)

### 3.3 Start All Services

```bash
# Start the full stack (PostgreSQL, migrator, dashboard, runner)
docker compose up
```

To include optional services:

```bash
# Include local LLM (Ollama)
docker compose --profile llm up

# Include email testing (Mailcatcher)
docker compose --profile dev up

# Include both
docker compose --profile llm --profile dev up
```

### 3.4 Verify Services Are Running

Once started, the services are available at:

| Service | URL | Purpose |
|---------|-----|---------|
| **Dashboard** | http://localhost:3000 | Main UI for managing tests |
| **Runner** | http://localhost:4000 | Playwright execution engine |
| **PostgreSQL** | localhost:5434 | Database (mapped from internal 5432) |
| **Mailcatcher** | http://localhost:1080 | Email capture UI (dev profile only) |
| **Ollama** | http://localhost:11434 | Local LLM API (llm profile only) |

Verify the runner is healthy:

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "runner",
  "busy": false,
  "active_run_id": null,
  "timestamp": "2026-05-12T12:00:00.000Z"
}
```

### 3.5 Local Development (Without Docker)

For development without Docker containers:

```bash
# Start dashboard in dev mode (hot reload)
cd apps/dashboard-web
pnpm dev

# Start runner in dev mode (in a separate terminal)
cd apps/runner
pnpm dev
```

Or use the convenience script:
```bash
./start-dev.sh
```

---

## 4. First-Time Setup

After starting the services for the first time, complete these steps in order:

### Step 1: Login

1. Open http://localhost:3000 in your browser
2. Click **Login**
3. Enter your operator credentials (see seed data for defaults)
4. After successful login, you are redirected to the Dashboard

### Step 2: Bootstrap the Vault

The vault must be initialized before you can store any credentials or payment profiles.

1. Navigate to **Settings > Vault** (or go directly to `/dashboard/settings/vault/bootstrap`)
2. Enter a **Master Password** (minimum 12 characters)
3. Confirm the password
4. Click **Bootstrap Vault**

**Important:**
- The master password cannot be recovered. Store it securely.
- The vault uses Argon2id key derivation + AES-256-GCM envelope encryption.
- After bootstrapping, the vault is automatically unlocked for the current session.

### Step 3: Unlock the Vault (Subsequent Sessions)

On future logins, you need to unlock the vault to access encrypted data:

1. Navigate to `/unlock` (or you will be prompted automatically)
2. Enter your master password
3. Click **Unlock**
4. The vault remains unlocked for 30 minutes of activity (configurable)

---

## 5. Dashboard Navigation

The dashboard header provides navigation to all major sections:

```
+------------------------------------------------------------------+
| Dashboard | Sites | Runs | Campaigns | Approvals | Artifacts |    |
| Personas  |                           AI Models | Settings | Audit|
+------------------------------------------------------------------+
```

### Left Navigation

| Link | Page | Purpose |
|------|------|---------|
| **Dashboard** | `/dashboard` | Home page with quick-access cards |
| **Sites** | `/dashboard/sites` | Manage websites under test |
| **Runs** | `/dashboard/runs` | View and manage test runs |
| **Campaigns** | `/dashboard/campaigns` | Reusable test configurations |
| **Approvals** | `/dashboard/approvals` | Pending approval requests |
| **Artifacts** | `/dashboard/artifacts` | Test output management and cleanup |
| **Personas** | `/dashboard/personas` | Read-only persona library |

### Right Navigation

| Link | Page | Purpose |
|------|------|---------|
| **AI Models** | `/dashboard/settings/llm-benchmark` | LLM model benchmarking |
| **Settings** | `/dashboard/settings/operators` | System settings (operators, credentials, etc.) |
| **Audit** | `/dashboard/audit` | System audit log |

### Vault State Indicator

A pill-shaped indicator in the top-right shows the current vault state:
- **Unlocked** (green) -- vault is ready; encrypted data accessible
- **Locked** (amber) -- vault needs master password to access secrets
- **Not Bootstrapped** (red) -- vault has not been initialized

---

## 6. Managing Sites

A **Site** represents a website you want to test. Each site can have multiple environments (staging, production, etc.).

### 6.1 View All Sites

Navigate to **Sites** (`/dashboard/sites`).

The sites list shows:
- Site name
- Base URL
- Number of environments
- Status (Active / Inactive)
- Link to site details

### 6.2 Create a New Site

1. Click **New Site** (top right)
2. Complete the 3-step wizard:

**Step 1 -- Site Identity:**
- **Site Name** (required): Human-readable name (e.g., "Yugal Kunj QA Portal")
- **Base URL** (required): Primary URL (e.g., `https://ykportalnextgenqa.yugalkunj.org`)
- **Description** (optional): Notes for operator reference

**Step 2 -- Environments:**
- Click **Add Environment** to define deployment targets
- For each environment, provide:
  - **Name**: e.g., `staging`, `production`
  - **Base URL**: Environment-specific URL
  - **Description**: Purpose and access notes
- You can skip this step and add environments later

**Step 3 -- Review & Create:**
- Review all settings
- Click **Create Site**

After creation, you are redirected to the site detail page.

### 6.3 Edit a Site

1. Navigate to the site detail page (click **Details** from the sites list)
2. On the **Overview** tab, click **Edit**
3. Modify the site name, base URL, description, or active status
4. Click **Save**

---

## 7. Configuring Site Details

The site detail page (`/dashboard/sites/{siteId}`) is the central hub for all site configuration. It has 8 tabs:

### 7.1 Overview Tab

Displays site metadata (name, base URL, description, status, creation date) with an inline edit form.

### 7.2 Environments Tab

Manage deployment environments for this site.

- **Add Environment**: Click to add a new environment with name, base URL, and description
- **Edit**: Modify an existing environment inline
- **Delete**: Remove an environment (with confirmation)

Each environment gets its own base URL, allowing you to test staging vs. production independently.

### 7.3 Capabilities Tab

Define site-specific capabilities (e.g., supported payment methods, features the site offers). These inform which test flows are applicable.

### 7.4 Flows Tab (Flow Mappings)

Map user flows to the site. This is where you configure which test flows the runner will execute.

To create a new flow mapping:

1. Click **Add flow** (top right) or **New flow mapping**
2. Select a **Flow type** from the available options:
   - **Registration** -- user sign-up flow
   - **Login** -- authentication flow
   - **Email Verification** -- email confirmation flow
   - **Password Reset** -- password recovery flow
   - **Checkout** -- payment/purchase flow
   - **Donation** -- donation flow
   - **Profile Update** -- user profile modification flow
3. Fill in the fields:
   - **Flow key** (required): Unique identifier (e.g., `registration`)
   - **Display name** (required): Human-readable name (e.g., "Registration")
   - **Implementation**: Choose `Template` (uses the site's flow definition from `sites/{site_slug}/flows/`)
4. Click **Save**

**How flow mappings relate to test execution:**
- When you create a run and select "registration" as a flow, the runner loads the corresponding flow definition from `sites/{site_slug}/flows/registration.ts`.
- The flow definition contains step-by-step Playwright automation: navigate to page, fill forms, submit, verify confirmation.

### 7.5 Selectors Tab

Define CSS/XPath selectors for UI elements the runner needs to interact with:
- Navigation elements (camp list items, register buttons)
- Form fields (first name, last name, email, phone, DOB)
- Success/error messages
- Admin UI elements

These selectors are referenced by the flow definitions during test execution.

### 7.6 Credentials Tab

Bind stored credentials to this site. Credentials are encrypted in the vault and linked to a specific site + environment.

- **Add Binding**: Link an existing secret to this site with a role name (e.g., `test_user`, `admin`)
- **Remove Binding**: Unlink a credential from the site

### 7.7 Payment Profiles Tab

Bind payment profiles (test credit cards, ACH accounts) to this site for checkout flow testing.

- **Add Binding**: Link a payment profile to a site + environment with a role tag and description
- **Remove Binding**: Unlink a payment profile

### 7.8 Email Inboxes Tab

Bind email inboxes for registration/email verification testing.

- **Add Binding**: Link an email inbox to a site + environment
- **Remove Binding**: Unlink an email inbox

---

## 8. Settings: Vault, Credentials, Payments, Email

Access settings pages via **Settings** in the top-right navigation.

### 8.1 Vault (`/dashboard/settings/vault`)

Manage the encryption vault:
- View vault state (bootstrapped, KDF parameters)
- Bootstrap the vault (first-time only)
- Lock/unlock the vault

### 8.2 Credentials (`/dashboard/settings/credentials`)

Manage site test credentials (usernames, passwords, emails for test accounts).

**List view** shows:
- Site name
- Role (e.g., `test_user`, `admin`)
- Credential value (masked by default; click the eye icon to reveal)
- Active/Inactive status

**Create a new credential:**

1. Click **New Credential**
2. Select the **Site** (dropdown)
3. Select the **Environment** (loads after site selection)
4. Enter a **Role Name** (e.g., `test_user`)
5. Enter the **Credential Value** (encrypted at rest with AES-256-GCM)
6. Optionally add a display name and description
7. Check **Session-only** if the credential should not persist beyond the session
8. Click **Create**

**Edit a credential:**

1. Click **Edit** on any credential row
2. Optionally enter a new credential value (leave blank to keep current)
3. Toggle active status
4. Click **Save Changes**

### 8.3 Payment Profiles (`/dashboard/settings/payment-profiles`)

Manage test payment methods for checkout flow testing.

**Supported types:**
- **Credit Card** -- card number, brand, expiry month/year
- **ACH/Bank Account** -- account number, routing number

**Create a new payment profile:**

1. Click **New Payment Profile**
2. Select payment type: **Credit Card** or **ACH/Bank Account**
3. For credit card:
   - Enter card number (auto-formats, extracts last 4 digits)
   - Select card brand (Visa, Mastercard, Amex, Discover)
   - Select expiry month and year
4. For ACH:
   - Enter account number
   - Enter routing number
5. Add a profile name and optional description
6. Click **Create**

All payment data is encrypted with AES-256-GCM before storage.

**Common test cards for sandbox testing:**

| Card Number | Brand | Use Case |
|-------------|-------|----------|
| `4111111111111111` | Visa | Standard approval |
| `4242424242424242` | Visa | Stripe test card |
| `5424000000000015` | Mastercard | Standard approval |
| `370000000000002` | Amex | Standard approval |

### 8.4 Email Inboxes (`/dashboard/settings/email-inboxes`)

Configure email accounts for automated email verification during registration and checkout flows.

**Supported providers:**
- **Gmail** (imap.gmail.com:993, TLS)
- **Microsoft 365** (outlook.office365.com:993, TLS)
- **IMAP** (custom host, port 993, TLS)
- **Custom** (custom host, port 143, no TLS by default)

**Create a new email inbox:**

1. Click **New Email Inbox**
2. Select a provider (pre-fills host/port/TLS settings)
3. Enter profile name
4. Adjust IMAP host, port, and TLS if needed
5. Enter email address and password
6. Add optional description
7. Click **Create**

**For Gmail:** Use an App Password (not your regular password). Enable 2FA first, then generate an app-specific password at https://myaccount.google.com/apppasswords.

**For development:** Use Mailcatcher (start with `docker compose --profile dev up`):
- Host: `mailcatcher`
- Port: `1025`
- Web UI: http://localhost:1080

### 8.5 Approval Policies (`/dashboard/settings/approval-policies`)

View the configured approval requirements for different action categories. This page is read-only and shows:

| Approval Strength | Meaning |
|-------------------|---------|
| **None** | Action executes without operator input |
| **One-Click** | Operator clicks "Approve" to proceed |
| **Strong** | Operator must type a reason before approving |

Common approval categories:
- `browse` -- typically **None** (read-only navigation)
- `login` -- typically **One-Click**
- `registration_submit` -- typically **One-Click** (form submission)
- `checkout_submit` -- typically **Strong** (payment transaction)
- `admin_write` -- typically **Strong** (admin data modifications)
- `admin_delete` -- typically **Strong** (admin deletions)

---

## 9. Managing Operators

Navigate to **Settings > Operators** (`/dashboard/settings/operators`).

### 9.1 View Operators

The operators list shows login, full name, email, status, and creation date.

### 9.2 Create an Operator

1. Click **New Operator**
2. Enter:
   - **Login** (required): Username for authentication
   - **Password** (required): Minimum 12 characters
   - **Confirm Password** (required): Must match
   - **Full Name** (optional)
   - **Email** (optional)
   - **Active** (checkbox, default: true)
3. Click **Create Operator**

### 9.3 Edit an Operator

1. Click **Edit** on the operator row
2. The login field is read-only (cannot be changed)
3. Optionally update password (min 12 chars if provided)
4. Update full name, email, or active status
5. Click **Save Changes**

---

## 10. Personas Library

Navigate to **Personas** (`/dashboard/personas`).

Personas are read-only seeded profiles that simulate diverse users. The platform ships with 6 v1 personas:

| Persona | Age | Device | Assistive Tech | Motor Profile |
|---------|-----|--------|----------------|---------------|
| **Confident Desktop** | 18-34 | Desktop | None | Normal |
| **Average Mobile** | 35-54 | Mobile | None | Normal |
| **Elderly First-Time** | 75+ | Desktop | None | Normal |
| **Low-Literacy Slow** | 35-54 | Mobile | None | Normal |
| **Screen Reader User** | 35-54 | Desktop | Screen Reader | Normal |
| **Motor-Impaired Tremor** | 55-74 | Desktop | None | Tremor |

Each persona drives Playwright behavior:
- **Typing speed/errors**: Realistic keystroke delays with configurable typo rates
- **Hesitation**: Pre-click wait times calibrated to reading WPM
- **Network throttling**: Slow 3G, flaky connections
- **Assistive tech**: Keyboard-only navigation, accessibility assertions
- **Motor profile**: Click coordinate jitter, minimum target size validation
- **Friction telemetry**: Repeated clicks, hover-without-click, form re-edits

Personas are selected when creating a Run or Campaign and cannot be edited through the UI (they are seeded from the database).

---

## 11. Creating and Running Test Runs

A **Run** is a single test execution that combines a site, environment, and a matrix of personas/devices/browsers/flows.

### 11.1 Create a New Run

Navigate to **Runs** > click **New Run**.

**Step 1 -- Site & Environment:**
- Select the **Site** (dropdown of active sites)
- Select the **Environment** (loads after site selection)
- Enter a **Run Name** (required, e.g., "Registration Smoke Test 2026-05-12")
- Add an optional **Description**

**Step 2 -- Execution Matrix:**
Select the dimensions for your test matrix:
- **Personas**: Check one or more personas (e.g., Confident Desktop, Average Mobile)
- **Device Profiles**: Select viewport configurations
- **Network Profiles**: Select network conditions
- **Browsers**: Check Chromium, Firefox, and/or WebKit
- **Flows**: Select which user journeys to test (e.g., Registration, Browse, Checkout)
- **Payment Scenarios**: (for checkout flows only) Select payment test scenarios

The UI shows the total number of generated scenarios (cartesian product of all selected dimensions).

> **Example:** 2 personas x 2 browsers x 1 flow = 4 executions

**Step 3 -- Review & Create:**
- Review all settings and the execution count
- Click **Create Run**

The run is created and executions are dispatched to the runner service automatically.

### 11.2 Monitor a Running Test

Navigate to the run detail page (`/dashboard/runs/{runId}`).

The detail page shows:

**Summary Cards:**
- Total executions
- Passed (green)
- Failed (red)
- Skipped (gray)

**Execution Table:**
Each row shows one execution with: persona, device, browser, flow, status, duration.

**Status indicators:**
- **Draft** -- run created but not yet started
- **Running** (blue pulse) -- currently executing
- **Awaiting Approval** (amber) -- paused at an approval gate
- **Completed** (green) -- all executions finished
- **Failed** (red) -- one or more executions failed
- **Aborted** (gray) -- operator manually stopped the run

**Run Controls:**
- **Play** button -- start a draft run
- **Stop** button -- abort the current run (best-effort)

**Collapsible Sections:**
- **Pending Approvals** -- approve/reject decisions for approval-gated steps
- **Email Validation Runs** -- email verification results
- **API Test Suites** -- API-level test results
- **Admin Test Suites** -- admin flow test results
- **LLM Analysis** -- AI-generated failure analysis (if Ollama is configured)

The page auto-refreshes while the run is active.

### 11.3 Handle Approval Gates

When a flow reaches an approval gate (e.g., before submitting a registration form or making a payment), the run pauses and waits for the operator:

1. A notification appears in the **Pending Approvals** section of the run detail page
2. Also visible on the global **Approvals** page (`/dashboard/approvals`)
3. Each approval shows:
   - **Category** (e.g., `registration_submit`, `checkout_submit`)
   - **Strength** (One-Click or Strong)
   - **Countdown timer** (default: 15 minutes before auto-timeout)
   - **Context** (run name, flow, step, persona)
4. Click **Approve** to let the test proceed
5. Click **Reject** to skip remaining steps (optionally provide a reason)

**One-Click approvals:** Single click on "Approve" is sufficient.  
**Strong approvals:** You must type a reason before the Approve button is enabled.

> **Tip:** Keep the Approvals page open in a separate browser tab during test runs so you can respond to approval gates promptly.

---

## 12. Campaigns

A **Campaign** is a reusable test configuration (test matrix) that can be executed multiple times.

### 12.1 Campaign Types

| Type | Purpose |
|------|---------|
| **Smoke** | Quick validation of core flows |
| **Regression** | Full test suite for release validation |
| **Release Certification** | Formal certification before go-live |
| **Payment Certification** | Payment-specific test scenarios |
| **Accessibility Audit** | WCAG 2.2 AA compliance testing |
| **Email Deliverability** | Email delivery and content validation |

### 12.2 Create a Campaign

Navigate to **Campaigns** > click **New Campaign**.

**Step 1 -- Campaign Identity:**
- Campaign Name (required)
- Campaign Type (select from radio buttons)
- Description (optional)
- Site (dropdown)
- Environment (dropdown)

**Step 2 -- Test Matrix:**
Select dimensions (same as Run creation):
- Personas, devices, browsers, networks, flows, payment scenarios

The UI shows the total scenario count.

**Step 3 -- Execution Settings:**
- **Concurrency cap**: Maximum parallel browser instances
- **Approval policy**: Which approval tier to use
- **Timeout settings**: Per-execution timeout

**Step 4 -- Review & Create:**
- Review all settings
- Click **Create Campaign**

### 12.3 Execute a Campaign

1. Navigate to the campaign detail page (`/dashboard/campaigns/{campaignId}`)
2. Click **Execute Campaign**
3. A new campaign execution is created and dispatched to the runner
4. Monitor execution progress in the **Executions** section (collapsible)
5. Each execution shows: status, scenario counts (successful/failed/skipped), duration

### 12.4 Filter Campaigns

On the campaigns list page, use the type dropdown to filter by campaign type (All, Smoke, Regression, etc.).

---

## 13. Approvals

Navigate to **Approvals** (`/dashboard/approvals`).

The approvals page shows all pending, approved, rejected, and timed-out approval requests across all runs.

### Approval Card Layout

Each approval card shows:
- **Status badge**: Pending (amber pulse), Approved (green), Rejected (red), Timed Out (gray)
- **Strength badge**: None, One-Click, Strong
- **Category tag**: e.g., `registration_submit`
- **Countdown timer**: Live countdown; turns red when less than 2 minutes remain
- **Context section**: Run name (clickable link), flow, step, persona, decided-by (if decided)

### Actions

- **Approve**: Click the green Approve button (for strong approvals, you must type a reason first)
- **Reject**: Click the red Reject button; a reason input field appears (optional)

The page auto-refreshes to show new approval requests.

---

## 14. Reports and Artifacts

### 14.1 Run Reports

After a run completes, navigate to the run detail page and click **View Report**.

The report page (`/dashboard/runs/{runId}/report`) contains:

**Summary Cards:**
- Total executions, passed, failed, skipped, pass rate %

**Persona Summaries:**
- One card per persona showing: pass rate, total/passed/failed counts, avg friction score, avg duration, top 3 issues

**Accessibility Scorecard:**
- Total checks, pass rate
- Axe-Core violation counts by severity: Critical, Serious, Minor, Best Practice

**Deduplicated Issues:**
- Consolidated list of unique issues across all executions
- Each issue shows: title, severity (Critical/High/Medium/Low), occurrence count, affected personas

**LLM Analysis:**
- AI-generated insights and recommendations (requires Ollama to be configured and running)

### 14.2 Artifacts Management

Navigate to **Artifacts** (`/dashboard/artifacts`).

**Retention Audit:**
- Table showing artifact types, storage used, count, last cleanup date

**Retention Config:**
- Editable table to configure retention days per artifact type
- Default retention periods:
  - Traces: 30 days
  - Videos: 30 days
  - Screenshots: 90 days
  - HAR files: 30 days
  - Logs: 90 days
  - MP4 recordings: 180 days
  - Records: 365 days

**Expired Artifacts:**
- Expand this section to see artifacts past their retention date
- Click **Run Cleanup** to delete expired artifacts from disk and database
- Cleanup results show: files found, deleted, missing, errors, DB rows removed

---

## 15. Walkthrough: Testing Registration on Yugal Kunj QA Portal

This section walks through a complete end-to-end example using `https://ykportalnextgenqa.yugalkunj.org/#/camp/center` as the target site for a Registration flow test.

### Prerequisites for This Walkthrough

- Platform running (`docker compose up`)
- Vault bootstrapped and unlocked
- Yugal Kunj site already configured (or follow steps below to create it)

### Step 1: Register the Site

1. Navigate to **Sites** > **New Site**
2. **Site Identity:**
   - Name: `Yugal Kunj QA Portal`
   - Base URL: `https://ykportalnextgenqa.yugalkunj.org`
   - Description: `React SPA with hash routing for camp registration`
3. **Environments:**
   - Add environment:
     - Name: `staging`
     - Base URL: `https://ykportalnextgenqa.yugalkunj.org`
     - Description: `QA staging environment`
4. **Review & Create** -- click **Create Site**

### Step 2: Configure Flow Mappings

1. Navigate to the site detail page (click **Details** from sites list)
2. Click the **Flows** tab
3. Click **Add flow** or **New flow mapping**
4. Select the **Registration** flow type button
5. Fill in:
   - **Flow key**: `registration`
   - **Display name**: `Registration`
   - **Implementation**: `Template`
6. Click **Save**

This maps the `registration` flow key to the site. When a run executes with this flow, the runner loads the flow definition from `sites/yugal-kunj/flows/registration.ts`.

**What the Registration flow does (under the hood):**

The `registration.ts` flow file defines these automated steps:

| Step | Action | Description |
|------|--------|-------------|
| 1. `navigate_to_camp_listing` | Navigate | Opens `https://ykportalnextgenqa.yugalkunj.org/#/camp/center` |
| 2. `select_first_camp` | Click | Clicks the first camp card or register button |
| 3. `find_register_button` | Locate | Finds the Register/Sign Up CTA on the camp detail page |
| 4. `fill_registration_form` | Type | Fills in first name, last name, email, phone, DOB using persona-driven typing |
| 5. `check_form_accessibility` | Validate | Runs axe-core accessibility audit on the form |
| 6. `await_registration_approval` | **Approval Gate** | Pauses for operator approval (one-click strength) |
| 7. `submit_registration` | Click | Clicks the submit button |
| 8. `verify_confirmation` | Assert | Checks for success message or error display |

### Step 3: Add Test Credentials (Optional)

If the registration flow requires pre-existing credentials (e.g., for login before registration):

1. Navigate to **Settings > Credentials**
2. Click **New Credential**
3. Select the Yugal Kunj site and staging environment
4. Role Name: `test_user`
5. Credential Value: Enter the test account password
6. Click **Create**

Then bind the credential to the site:
1. Go to the site detail page > **Credentials** tab
2. Add the credential binding

### Step 4: Configure Payment Profile (If Testing Checkout Too)

For testing the checkout flow alongside registration:

1. Navigate to **Settings > Payment Profiles**
2. Click **New Payment Profile**
3. Select **Credit Card**
4. Enter sandbox card details:
   - Card Number: `4111111111111111`
   - Brand: Visa
   - Expiry: 12/2029
   - Profile Name: `Sandbox Visa`
5. Click **Create**
6. Bind to the site via the site detail page > **Payment Profiles** tab

### Step 5: Create the Registration Test Run

1. Navigate to **Runs** > **New Run**
2. **Step 1 -- Site & Environment:**
   - Site: `Yugal Kunj QA Portal`
   - Environment: `staging`
   - Run Name: `Registration Test - Yugal Kunj - 2026-05-12`
   - Description: `Testing camp registration flow on YK QA portal`
3. **Step 2 -- Execution Matrix:**
   - **Personas**: Select `Confident Desktop` (start with one for smoke testing)
   - **Device Profiles**: Select a desktop profile
   - **Network Profiles**: Select `Normal`
   - **Browsers**: Check `Chromium`
   - **Flows**: Check `Registration`
   - Total scenarios: 1
4. **Step 3 -- Review & Create:**
   - Verify settings
   - Click **Create Run**

### Step 6: Monitor the Run

1. You are redirected to the run detail page
2. Watch the status change from **Draft** to **Running**
3. The runner:
   - Launches a Chromium browser
   - Loads the Confident Desktop persona (realistic typing speed, no errors)
   - Navigates to `https://ykportalnextgenqa.yugalkunj.org/#/camp/center`
   - Selects the first camp
   - Fills in the registration form with test data
   - Runs an accessibility check on the form

### Step 7: Handle the Approval Gate

When the runner reaches the `await_registration_approval` step:

1. The run status changes to **Awaiting Approval**
2. A pending approval appears in:
   - The **Pending Approvals** section on the run detail page
   - The global **Approvals** page
3. Review the approval:
   - Category: `registration_submit`
   - Strength: **One-Click**
   - Countdown: 15 minutes
4. Click **Approve** to let the runner submit the registration form

### Step 8: View Results

After the run completes:

1. Check the **Summary Cards**: 1 total, 1 passed (green) or 1 failed (red)
2. Click **View Report** for the detailed report:
   - Persona summary for Confident Desktop
   - Accessibility scorecard (axe-core violations)
   - Any detected issues
3. If the run failed, check:
   - The error message in the execution table
   - The **LLM Analysis** section (if Ollama configured) for AI-generated failure summary
   - Artifacts (screenshots, traces) for debugging

### Step 9: Scale Up Testing

After a successful smoke test, create a more comprehensive run:

1. **New Run** with multiple personas:
   - Confident Desktop + Average Mobile + Elderly First-Time
2. Add multiple browsers: Chromium + Firefox + WebKit
3. Add multiple flows: Registration + Browse + Checkout
4. This creates a matrix (e.g., 3 personas x 3 browsers x 3 flows = 27 executions)

Or create a **Campaign** for repeatable test suites that you can execute before each release.

---

## 16. Audit Log

Navigate to **Audit** (`/dashboard/audit`).

The audit log records all system actions for compliance and debugging.

**Filter Options:**
- **Actor ID**: Filter by operator
- **Action**: Filter by action type
- **Target**: Filter by target entity
- **Status**: All / Success / Failure / Error

**Table Columns:**
- Timestamp
- Actor (type:id badge)
- Action performed
- Target entity
- Status (Success/Failure/Error with color-coded badge)
- Details

Use the **Refresh** button to reload the latest entries.

---

## 17. LLM Benchmark (AI Models)

Navigate to **AI Models** (`/dashboard/settings/llm-benchmark`).

This page benchmarks local LLM models (via Ollama) for two tasks:
- **Selector Healing**: Can the model fix broken CSS selectors?
- **Failure Summarization**: Can the model generate useful failure summaries?

**To run a benchmark:**

1. Ensure Ollama is running (`docker compose --profile llm up`)
2. Click **Run Benchmark** (top right)
3. Wait for results (tests each configured model on both tasks)
4. Review results:
   - Model availability
   - Latency (ms)
   - Response parseability
   - Quality score (0-100%)

**Benchmark History:**
Scroll down to see previous benchmark runs grouped by date.

---

## 18. Troubleshooting

### Port Conflicts

If port 5432 is in use, PostgreSQL is mapped to 5434 in `docker-compose.override.yml`. Edit this file to change the port mapping.

### Migration Failures

```bash
# Check migrator logs
docker compose logs migrator

# Full database reset (WARNING: deletes all data)
docker compose down -v
docker compose up
```

### Runner Not Responding

```bash
# Check runner health
curl http://localhost:4000/health

# Check runner logs
docker compose logs -f runner
```

### Vault Locked Errors

If you see "Vault is locked" errors when accessing credentials or payment profiles:
1. Navigate to `/unlock`
2. Enter your master password
3. Click **Unlock**

### Run Stuck in "Running" State

1. Check the runner health: `curl http://localhost:4000/health`
2. If the runner reports `busy: true` with the correct `active_run_id`, the run is still executing
3. If the runner is healthy but the run is stuck, try aborting: click **Stop** on the run detail page
4. Check runner logs for errors: `docker compose logs -f runner`

### Approval Gate Timed Out

If you miss an approval gate (15-minute default timeout):
- The approval status changes to **Timed Out**
- Remaining flow steps are marked as **Skipped by Approval**
- You can create a new run to re-test

### Docker Build Failures

```bash
# Clear Docker cache
docker system prune -a

# Rebuild from scratch
docker compose build --no-cache
```

### Hot Reload Not Working

Ensure `docker-compose.override.yml` exists and is loaded (Docker Compose reads it automatically).

For local development without Docker:
```bash
cd apps/dashboard-web && pnpm dev
# or
cd apps/runner && pnpm dev
```

---

## 19. Architecture Reference

### Service Architecture

```
                    +------------------+
                    |   Dashboard Web  |
                    |   (Next.js)      |
                    |   Port 3000      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+     +-------------v-----------+
    |    PostgreSQL      |     |      Runner Service     |
    |    Port 5432       |     |      (Express/Playwright)|
    |    (16-alpine)     |     |      Port 4000          |
    +-------------------+     +-------------------------+
                                        |
                              +---------+---------+
                              |                   |
                    +---------v---+     +---------v---+
                    |   Ollama    |     | Mailcatcher  |
                    |   (LLM)    |     |   (Email)    |
                    |   :11434   |     |   :1080      |
                    +------------+     +-------------+
```

### Data Flow: Test Execution

```
1. Operator creates Run via Dashboard UI
2. Dashboard materializes execution matrix (personas x devices x browsers x flows)
3. Dashboard POSTs /run to Runner with all executions
4. Runner returns 202 Accepted, begins async execution
5. For each execution:
   a. Launch browser with persona config
   b. Execute flow steps (navigate, fill forms, click)
   c. At approval gates: POST to Dashboard, poll for decision
   d. Capture friction signals and accessibility results
   e. POST results back to Dashboard via callback URL
6. Dashboard stores results, updates run status
7. Operator views report with persona summaries, accessibility scorecard, issues
```

### Database-First Design

All data access goes through PostgreSQL stored procedures:
- No ad-hoc SQL in application code
- Stored procedures in `db/procs/` with naming: `XXXX_sp_entity_action.sql`
- Invoked via `invokeProc('sp_name', { i_param: value })`
- All tables include audit columns: `Created_Date`, `Update_Date`, `Created_By`, `Updated_By`

### Site Configuration Files

Each site has configuration files in `sites/{site_slug}/`:

```
sites/yugal-kunj/
  rules.ts            # Business rules, selectors, approval categories
  api-endpoints.ts    # API endpoint stubs for API testing
  flows/
    index.ts          # Flow registry (exports all flows)
    browse.ts         # Browse/navigation flow
    registration.ts   # Registration flow
    checkout.ts       # Payment/checkout flow
    admin-login.ts    # Admin authentication flow
    admin-edit.ts     # Admin record editing flow
    booking-lookup.ts # Admin booking search flow
    registration-lookup.ts  # Admin registration search flow
    reporting-screens.ts    # Admin reporting flow
```

### Monorepo Package Map

| Package | Purpose |
|---------|---------|
| `apps/dashboard-web` | Next.js dashboard (UI + orchestrator) |
| `apps/runner` | Playwright runner service |
| `packages/db` | PostgreSQL client + proc wrappers |
| `packages/shared-types` | DTOs, enums, logging |
| `packages/config` | Env parsing, feature flags |
| `packages/auth` | Custom auth + capability RBAC |
| `packages/vault` | Argon2id + AES-256-GCM vault |
| `packages/approvals` | Tiered approval engine |
| `packages/email` | IMAP + provider API abstraction |
| `packages/llm` | Ollama client, bounded prompts |
| `packages/personas` | Persona schema + v1 library |
| `packages/playwright-core` | PersonaRunner + flow execution |
| `packages/api-testing` | HTTP test orchestration |
| `packages/rules` | Site business rules loader |
| `packages/payment` | Payment provider abstraction |
| `packages/orchestration` | Campaign orchestration |
| `packages/test-data` | Test data management |

---

## Quick Reference: Common Workflows

### Run a Registration Smoke Test

1. Ensure site is configured with a Registration flow mapping
2. **Runs** > **New Run** > select site, environment, 1 persona, 1 browser, Registration flow
3. **Create Run** > wait for approval gate > **Approve** > view report

### Run a Full Regression Suite

1. **Campaigns** > **New Campaign** > type: Regression
2. Select all personas, all browsers, all flows
3. **Create Campaign** > **Execute Campaign**
4. Monitor executions and handle approval gates
5. Review campaign execution results

### Add a New Site

1. **Sites** > **New Site** > enter name, URL, environments
2. Configure flows (Flows tab), selectors, credentials, payment profiles
3. Create site flow files in `sites/{site_slug}/flows/`
4. Run `pnpm build` to compile flow TypeScript to JavaScript
5. Create a smoke test run to verify configuration

### Rotate Credentials

1. **Settings > Credentials** > click **Edit** on the credential
2. Enter new credential value
3. Click **Save Changes**
4. Old value is archived (not deleted)

### Clean Up Test Artifacts

1. **Artifacts** > review **Retention Audit** for storage usage
2. Adjust retention days in **Retention Config** if needed
3. Expand **Expired Artifacts** > click **Run Cleanup**

---

*For detailed implementation plans and architectural decisions, see:*
- `master-plan-qa-automation.md` -- Full implementation roadmap
- `docs/decisions/` -- Architectural Decision Records (ADRs)
- `docs/runbooks/` -- Operational runbooks (site onboarding, backup, DR, troubleshooting)
