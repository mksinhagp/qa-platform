BEGIN;
-- ============================================================
-- Migration 0022: Account lifecycle tables
-- Phase 15: Generic Account Lifecycle Automation
--
-- Purpose: Track test accounts created during QA runs, their lifecycle
--   state (registered, verified, active, cleaned_up), and cleanup status.
--
-- Tables:
--   1. test_accounts       — generated test accounts per site/execution
--   2. test_account_actions — lifecycle actions on each account
-- ============================================================

-- ─── 1. Test Accounts ─────────────────────────────────────────────────────────
-- Tracks every test account created during QA runs.

CREATE TABLE IF NOT EXISTS test_accounts (
    id                  SERIAL PRIMARY KEY,
    site_id             INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    run_execution_id    INTEGER REFERENCES run_executions(id) ON DELETE SET NULL,
    persona_id          VARCHAR(100) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    username            VARCHAR(255),
    first_name          VARCHAR(255),
    last_name           VARCHAR(255),
    phone               VARCHAR(50),
    password_hash       VARCHAR(255),
    account_status      VARCHAR(50) NOT NULL DEFAULT 'pending_registration',
    login_strategy      VARCHAR(50) NOT NULL DEFAULT 'email_password',
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    verification_method VARCHAR(50),
    cleanup_status      VARCHAR(50) NOT NULL DEFAULT 'active',
    cleanup_approved_by VARCHAR(255),
    cleanup_approved_at TIMESTAMP WITH TIME ZONE,
    cleaned_up_at       TIMESTAMP WITH TIME ZONE,
    metadata            JSONB DEFAULT NULL,
    notes               TEXT,
    created_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_test_accounts_site_id
    ON test_accounts (site_id);

CREATE INDEX IF NOT EXISTS idx_test_accounts_run_execution_id
    ON test_accounts (run_execution_id);

CREATE INDEX IF NOT EXISTS idx_test_accounts_cleanup_status
    ON test_accounts (cleanup_status)
    WHERE cleanup_status != 'cleaned_up';

CREATE INDEX IF NOT EXISTS idx_test_accounts_site_email
    ON test_accounts (site_id, email);

-- ─── 2. Test Account Actions ──────────────────────────────────────────────────
-- Audit trail of lifecycle actions performed on each test account.
-- action_type: register, verify_email, login, logout, password_reset,
--   profile_update, cleanup_request, cleanup_approved, cleanup_executed

CREATE TABLE IF NOT EXISTS test_account_actions (
    id                  SERIAL PRIMARY KEY,
    test_account_id     INTEGER NOT NULL REFERENCES test_accounts(id) ON DELETE CASCADE,
    run_execution_id    INTEGER REFERENCES run_executions(id) ON DELETE SET NULL,
    action_type         VARCHAR(50) NOT NULL,
    action_status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    step_name           VARCHAR(255),
    duration_ms         INTEGER,
    error_message       TEXT,
    details             JSONB DEFAULT NULL,
    created_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by          VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_test_account_actions_account_id
    ON test_account_actions (test_account_id);

CREATE INDEX IF NOT EXISTS idx_test_account_actions_execution_id
    ON test_account_actions (run_execution_id);

CREATE INDEX IF NOT EXISTS idx_test_account_actions_type_status
    ON test_account_actions (action_type, action_status);

COMMIT;
