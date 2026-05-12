BEGIN;
-- ============================================================
-- Migration 0023: Email provider layer tables
-- Phase 16: Generic Email Provider Layer
--
-- Purpose: Make email validation portable across providers and inbox
--   strategies. New tables:
--   1. email_providers       — provider configurations (IMAP, Gmail API, etc.)
--   2. email_inbox_bindings  — bind inboxes to site/env/persona/flow/role
--   3. email_template_assertions — reusable assertion templates per email type
--   4. email_timing_slas     — delivery timing SLA definitions and results
--   5. email_correlation_configs — correlation strategy per site/provider
-- ============================================================

-- ─── 1. Email Providers ───────────────────────────────────────────────────────
-- Abstracts email provider configuration. provider_type:
--   imap, gmail_api, mailtrap, mailosaur, mailcatcher, webhook_inbound

CREATE TABLE IF NOT EXISTS email_providers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    provider_type   VARCHAR(50) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    config_json     JSONB NOT NULL DEFAULT '{}',
    secret_id       INTEGER REFERENCES secret_records(id) ON DELETE SET NULL,
    notes           TEXT,
    created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by      VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_email_providers_name UNIQUE (name)
);

-- ─── 2. Email Inbox Bindings v2 ──────────────────────────────────────────────
-- Binds an email inbox (provider + address) to granular contexts:
--   site, environment, persona, flow type, role tag, or campaign.
-- Replaces the simpler site_env_email_bindings from Phase 2.

CREATE TABLE IF NOT EXISTS email_inbox_bindings_v2 (
    id                      SERIAL PRIMARY KEY,
    email_provider_id       INTEGER NOT NULL REFERENCES email_providers(id) ON DELETE CASCADE,
    inbox_address           VARCHAR(255) NOT NULL,
    site_id                 INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id     INTEGER REFERENCES site_environments(id) ON DELETE CASCADE,
    persona_id              VARCHAR(100),
    flow_key                VARCHAR(100),
    role_tag                VARCHAR(100),
    campaign                VARCHAR(255),
    priority                INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    notes                   TEXT,
    created_date            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by              VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_email_inbox_bindings_v2_provider
    ON email_inbox_bindings_v2 (email_provider_id);

CREATE INDEX IF NOT EXISTS idx_email_inbox_bindings_v2_site
    ON email_inbox_bindings_v2 (site_id);

CREATE INDEX IF NOT EXISTS idx_email_inbox_bindings_v2_lookup
    ON email_inbox_bindings_v2 (site_id, site_environment_id, flow_key, persona_id, is_active);

-- ─── 3. Email Template Assertions ────────────────────────────────────────────
-- Reusable assertion templates per email type (registration, verification,
-- password reset, receipt, notification).

CREATE TABLE IF NOT EXISTS email_template_assertions (
    id                  SERIAL PRIMARY KEY,
    site_id             INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    email_type          VARCHAR(50) NOT NULL,
    assertion_name      VARCHAR(255) NOT NULL,
    assertion_type      VARCHAR(50) NOT NULL,
    expected_value      TEXT,
    is_regex            BOOLEAN NOT NULL DEFAULT FALSE,
    is_required         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    notes               TEXT,
    created_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_email_template_assertions_site_type_name UNIQUE (site_id, email_type, assertion_name)
);

CREATE INDEX IF NOT EXISTS idx_email_template_assertions_site_type
    ON email_template_assertions (site_id, email_type);

-- ─── 4. Email Timing SLAs ────────────────────────────────────────────────────
-- Defines expected delivery timing thresholds and records actual results.

CREATE TABLE IF NOT EXISTS email_timing_slas (
    id                      SERIAL PRIMARY KEY,
    site_id                 INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    email_type              VARCHAR(50) NOT NULL,
    max_delivery_ms         INTEGER NOT NULL DEFAULT 300000,
    warn_delivery_ms        INTEGER NOT NULL DEFAULT 60000,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    notes                   TEXT,
    created_date            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by              VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_email_timing_slas_site_type UNIQUE (site_id, email_type)
);

-- ─── 5. Email Timing Results ─────────────────────────────────────────────────
-- Actual delivery timing results per execution.

CREATE TABLE IF NOT EXISTS email_timing_results (
    id                      SERIAL PRIMARY KEY,
    run_execution_id        INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    email_timing_sla_id     INTEGER REFERENCES email_timing_slas(id) ON DELETE SET NULL,
    email_type              VARCHAR(50) NOT NULL,
    delivery_latency_ms     INTEGER,
    sla_status              VARCHAR(50) NOT NULL DEFAULT 'unknown',
    timeout_occurred        BOOLEAN NOT NULL DEFAULT FALSE,
    correlation_token       VARCHAR(255),
    provider_type           VARCHAR(50),
    error_message           TEXT,
    created_date            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by              VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_email_timing_results_execution
    ON email_timing_results (run_execution_id);

CREATE INDEX IF NOT EXISTS idx_email_timing_results_sla_status
    ON email_timing_results (sla_status)
    WHERE sla_status IN ('failed', 'warning');

-- ─── 6. Email Correlation Configs ────────────────────────────────────────────
-- Configures how email correlation works per site/provider.
-- strategy: plus_addressing, generated_inbox, unique_subject_token, unique_body_token

CREATE TABLE IF NOT EXISTS email_correlation_configs (
    id                  SERIAL PRIMARY KEY,
    site_id             INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    email_provider_id   INTEGER REFERENCES email_providers(id) ON DELETE SET NULL,
    strategy            VARCHAR(50) NOT NULL DEFAULT 'plus_addressing',
    base_address        VARCHAR(255),
    token_pattern       VARCHAR(255),
    config_json         JSONB DEFAULT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    created_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_email_correlation_configs_site_provider UNIQUE (site_id, email_provider_id)
);

CREATE INDEX IF NOT EXISTS idx_email_correlation_configs_site
    ON email_correlation_configs (site_id);

COMMIT;
