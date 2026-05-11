BEGIN
-- Migration 0017: Admin and back-office test tables for Phase 7
-- Tables: admin_test_suites, admin_test_assertions
-- Stores results of admin/back-office flow testing (admin login, booking lookup,
-- registration lookup, admin edits, reporting screens).
-- Each admin test run is tied to a run_execution and tracks admin-specific outcomes.

-- admin_test_suites: One record per admin test suite executed for a run execution.
-- Suite types: 'admin_login', 'booking_lookup', 'registration_lookup',
--              'admin_edit', 'reporting_screens'
CREATE TABLE IF NOT EXISTS admin_test_suites (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    -- Suite type: 'admin_login', 'booking_lookup', 'registration_lookup',
    --             'admin_edit', 'reporting_screens'
    suite_type VARCHAR(50) NOT NULL,
    -- Overall status: 'pending', 'running', 'passed', 'failed', 'error', 'skipped'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_assertions INTEGER NOT NULL DEFAULT 0,
    passed_assertions INTEGER NOT NULL DEFAULT 0,
    failed_assertions INTEGER NOT NULL DEFAULT 0,
    skipped_assertions INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error_message TEXT,
    -- Metadata: admin user context, pages tested, edit details, etc.
    metadata JSONB,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_admin_test_suites_execution_id ON admin_test_suites(run_execution_id);
CREATE INDEX idx_admin_test_suites_suite_type ON admin_test_suites(suite_type);
CREATE INDEX idx_admin_test_suites_status ON admin_test_suites(status);

-- Unique constraint: one suite per type per execution (prevents duplicate inserts)
ALTER TABLE admin_test_suites
    ADD CONSTRAINT uq_admin_test_suites_execution_type
    UNIQUE (run_execution_id, suite_type);

-- admin_test_assertions: Individual assertion results within an admin test suite.
-- Each row is one atomic check (login succeeded, booking found, edit persisted, etc.)
CREATE TABLE IF NOT EXISTS admin_test_assertions (
    id SERIAL PRIMARY KEY,
    admin_test_suite_id INTEGER NOT NULL REFERENCES admin_test_suites(id) ON DELETE CASCADE,
    -- Human-readable assertion name (e.g., 'admin_login_success', 'booking_detail_visible')
    assertion_name VARCHAR(255) NOT NULL,
    -- Result: 'passed', 'failed', 'error', 'skipped'
    status VARCHAR(50) NOT NULL,
    -- The page or URL that was tested
    page_url VARCHAR(2048),
    -- Expected vs actual for diff display
    expected_value TEXT,
    actual_value TEXT,
    -- Error detail
    error_message TEXT,
    -- Arbitrary extra data (DOM snapshot excerpt, field values, screenshots path)
    detail JSONB,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_admin_test_assertions_suite_id ON admin_test_assertions(admin_test_suite_id);
CREATE INDEX idx_admin_test_assertions_status ON admin_test_assertions(status);
CREATE INDEX idx_admin_test_assertions_assertion_name ON admin_test_assertions(assertion_name);

END
