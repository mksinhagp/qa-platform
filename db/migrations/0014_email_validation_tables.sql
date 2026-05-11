BEGIN
-- Migration 0014: Email validation results tables for Phase 5
-- Tables: email_validation_runs, email_validation_checks

-- email_validation_runs: One record per email validation job triggered by a run execution
-- Tracks the overall status of checking for a specific expected email
CREATE TABLE IF NOT EXISTS email_validation_runs (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    inbox_id INTEGER NOT NULL REFERENCES email_inboxes(id) ON DELETE RESTRICT,
    -- The correlation token embedded in the test email address (e.g., the +token suffix)
    correlation_token VARCHAR(255) NOT NULL,
    -- Expected email attributes from site rules
    expected_subject_pattern VARCHAR(500),
    expected_from_pattern VARCHAR(255),
    -- Overall result
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Time window for delivery check
    wait_until TIMESTAMP WITH TIME ZONE NOT NULL,
    -- When email was actually received (null if not found)
    received_at TIMESTAMP WITH TIME ZONE,
    delivery_latency_ms INTEGER,
    -- How many IMAP poll attempts were made
    poll_count INTEGER NOT NULL DEFAULT 0,
    -- Error detail if status=error
    error_message TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_email_validation_runs_execution_id ON email_validation_runs(run_execution_id);
CREATE INDEX idx_email_validation_runs_inbox_id ON email_validation_runs(inbox_id);
CREATE INDEX idx_email_validation_runs_status ON email_validation_runs(status);
CREATE INDEX idx_email_validation_runs_correlation_token ON email_validation_runs(correlation_token);

-- email_validation_checks: Individual assertion results within a validation run
-- Each row is one atomic check (delivery, subject, body pattern, link, brand, render)
CREATE TABLE IF NOT EXISTS email_validation_checks (
    id SERIAL PRIMARY KEY,
    email_validation_run_id INTEGER NOT NULL REFERENCES email_validation_runs(id) ON DELETE CASCADE,
    check_type VARCHAR(100) NOT NULL,  -- delivery, subject_pattern, body_pattern, link_extract, link_reachable, render_fidelity, brand_logo, brand_footer
    status VARCHAR(50) NOT NULL,       -- passed, failed, skipped, error
    -- Human-readable detail for reporting
    detail TEXT,
    -- For link checks: the URL tested
    url_tested VARCHAR(2048),
    -- For render fidelity: pixel diff percentage (stored as numeric string for precision)
    diff_percent VARCHAR(20),
    -- For link checks: HTTP status returned
    http_status INTEGER,
    -- Screenshot artifact path (render fidelity)
    artifact_path VARCHAR(1024),
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_email_validation_checks_validation_run_id ON email_validation_checks(email_validation_run_id);
CREATE INDEX idx_email_validation_checks_check_type ON email_validation_checks(check_type);
CREATE INDEX idx_email_validation_checks_status ON email_validation_checks(status);

END
