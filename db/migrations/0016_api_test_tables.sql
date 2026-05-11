BEGIN
-- Migration 0016: API test result tables for Phase 6 (API Testing Layer)
-- Tables: api_test_suites, api_test_assertions
-- Stores results of API validation that runs as a post-step after each browser flow execution.
-- Four suite types: reachability, schema, business_rules, cross_validation

-- api_test_suites: One record per API test suite executed for a run execution.
-- A single run execution may have multiple suites (one per suite_type).
CREATE TABLE IF NOT EXISTS api_test_suites (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    -- Suite type: 'reachability', 'schema', 'business_rules', 'cross_validation'
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
    -- Metadata: which endpoints were tested, config used, etc.
    metadata JSONB,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_api_test_suites_execution_id ON api_test_suites(run_execution_id);
CREATE INDEX idx_api_test_suites_suite_type ON api_test_suites(suite_type);
CREATE INDEX idx_api_test_suites_status ON api_test_suites(status);

-- Unique constraint: one suite per type per execution (prevents duplicate inserts)
ALTER TABLE api_test_suites
    ADD CONSTRAINT uq_api_test_suites_execution_type
    UNIQUE (run_execution_id, suite_type);

-- api_test_assertions: Individual assertion results within a suite.
-- Each row is one atomic check (endpoint reachable, schema valid, business rule holds, etc.)
CREATE TABLE IF NOT EXISTS api_test_assertions (
    id SERIAL PRIMARY KEY,
    api_test_suite_id INTEGER NOT NULL REFERENCES api_test_suites(id) ON DELETE CASCADE,
    -- The endpoint URL that was tested
    endpoint_url VARCHAR(2048) NOT NULL,
    -- HTTP method used
    http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
    -- Human-readable assertion name (e.g., 'health_endpoint_reachable', 'camps_list_schema_valid')
    assertion_name VARCHAR(255) NOT NULL,
    -- Result: 'passed', 'failed', 'error', 'skipped'
    status VARCHAR(50) NOT NULL,
    -- Expected vs actual for easy diff display
    expected_value TEXT,
    actual_value TEXT,
    -- HTTP response metadata
    response_status INTEGER,
    response_time_ms INTEGER,
    -- Error detail
    error_message TEXT,
    -- Arbitrary extra data (response body snippet, schema diff, rule details)
    detail JSONB,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_api_test_assertions_suite_id ON api_test_assertions(api_test_suite_id);
CREATE INDEX idx_api_test_assertions_status ON api_test_assertions(status);
CREATE INDEX idx_api_test_assertions_assertion_name ON api_test_assertions(assertion_name);

END
