BEGIN;
-- ============================================================
-- Migration 0021: Site capabilities, flow mappings, and selector dictionary
-- Phase 14: Generic Registration Site Model
--
-- Purpose: Replace site-specific assumptions with a reusable site capability
--   and adapter model. Three new tables:
--   1. site_capabilities    — per-site capability flags (registration, login, etc.)
--   2. site_flow_mappings   — maps canonical flow keys to implementation details
--   3. site_selector_entries — structured selector dictionary with fallback order
--
-- All tables FK to sites(id) ON DELETE CASCADE for tenant isolation.
-- ============================================================

-- ─── 1. Site Capabilities ─────────────────────────────────────────────────────
-- Each row declares that a site supports (or has disabled) a given capability.
-- capability_key values: registration, login, logout, email_verification,
--   password_reset, profile_update, checkout, payment_receipt_validation,
--   admin_reconciliation, cancellation_refund, reporting

CREATE TABLE IF NOT EXISTS site_capabilities (
    id              SERIAL PRIMARY KEY,
    site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    capability_key  VARCHAR(100) NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    config_json     JSONB DEFAULT NULL,
    notes           TEXT,
    created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by      VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_site_capabilities_site_key UNIQUE (site_id, capability_key)
);

CREATE INDEX IF NOT EXISTS idx_site_capabilities_site_id
    ON site_capabilities (site_id);

-- ─── 2. Site Flow Mappings ────────────────────────────────────────────────────
-- Maps canonical flow keys to concrete implementation details.
-- flow_key values: register, verify_email, login, logout, password_reset,
--   profile_update, checkout, payment_receipt_validation, admin_reconciliation

CREATE TABLE IF NOT EXISTS site_flow_mappings (
    id              SERIAL PRIMARY KEY,
    site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    flow_key        VARCHAR(100) NOT NULL,
    flow_name       VARCHAR(255) NOT NULL,
    implementation  VARCHAR(50) NOT NULL DEFAULT 'template',
    config_json     JSONB DEFAULT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by      VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_site_flow_mappings_site_key UNIQUE (site_id, flow_key)
);

CREATE INDEX IF NOT EXISTS idx_site_flow_mappings_site_id
    ON site_flow_mappings (site_id);

-- ─── 3. Site Selector Entries ─────────────────────────────────────────────────
-- Structured selector dictionary with fallback order and human-readable labels.
-- selector_type: css, xpath, aria_role, visible_text, test_id

CREATE TABLE IF NOT EXISTS site_selector_entries (
    id              SERIAL PRIMARY KEY,
    site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    element_key     VARCHAR(100) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    selector_type   VARCHAR(50) NOT NULL DEFAULT 'css',
    selector_value  TEXT NOT NULL,
    fallback_order  INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    flow_key        VARCHAR(100) DEFAULT NULL,
    notes           TEXT,
    created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by      VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_site_selector_entries_site_id
    ON site_selector_entries (site_id);

CREATE INDEX IF NOT EXISTS idx_site_selector_entries_site_element
    ON site_selector_entries (site_id, element_key, fallback_order);

-- ─── 4. Site Rules Versions ───────────────────────────────────────────────────
-- Versioned site rules stored in DB for auditability (Phase 14.4)

CREATE TABLE IF NOT EXISTS site_rules_versions (
    id              SERIAL PRIMARY KEY,
    site_id         INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL DEFAULT 1,
    rules_json      JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    notes           TEXT,
    created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by      VARCHAR(255) NOT NULL DEFAULT 'system',

    CONSTRAINT uq_site_rules_versions_site_version UNIQUE (site_id, version)
);

CREATE INDEX IF NOT EXISTS idx_site_rules_versions_site_id
    ON site_rules_versions (site_id);

COMMIT;
