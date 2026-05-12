BEGIN
-- Migration 0025: Test data management tables for Phase 19
-- Tables: test_identities, test_data_ledger, cleanup_jobs

-- test_identities table: Generated test identity data
CREATE TABLE IF NOT EXISTS test_identities (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER REFERENCES run_executions(id) ON DELETE CASCADE,
    persona_id INTEGER REFERENCES personas(id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER REFERENCES site_environments(id) ON DELETE CASCADE,
    identity_type VARCHAR(50) NOT NULL, -- 'registrant', 'guest', 'admin', etc.
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    full_name VARCHAR(511),
    email VARCHAR(511) NOT NULL,
    username VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    address_line1 VARCHAR(511),
    address_line2 VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'US',
    emergency_contact_name VARCHAR(511),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relationship VARCHAR(100),
    custom_fields JSONB, -- Site-specific custom fields
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(run_execution_id, email)
);

CREATE INDEX idx_test_identities_run_execution_id ON test_identities(run_execution_id);
CREATE INDEX idx_test_identities_persona_id ON test_identities(persona_id);
CREATE INDEX idx_test_identities_site_id ON test_identities(site_id);
CREATE INDEX idx_test_identities_email ON test_identities(email);
CREATE INDEX idx_test_identities_username ON test_identities(username);
CREATE INDEX idx_test_identities_phone ON test_identities(phone);
CREATE INDEX idx_test_identities_is_active ON test_identities(is_active);

-- test_data_ledger table: Track all generated test data and cleanup status
CREATE TABLE IF NOT EXISTS test_data_ledger (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER REFERENCES run_executions(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL, -- 'account', 'email', 'payment', 'registration', 'booking', etc.
    data_category VARCHAR(50) NOT NULL, -- 'user', 'transaction', 'artifact', etc.
    entity_id INTEGER, -- Reference to the entity (e.g., test_accounts.id)
    entity_type VARCHAR(100), -- Table name or entity type
    identifier VARCHAR(511), -- Unique identifier (email, username, transaction_id, etc.)
    identifier_type VARCHAR(50), -- 'email', 'username', 'transaction_id', 'order_number', etc.
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER REFERENCES site_environments(id) ON DELETE CASCADE,
    persona_id INTEGER REFERENCES personas(id) ON DELETE SET NULL,
    data_json JSONB, -- Full data snapshot for debugging
    sensitive_fields TEXT[], -- List of sensitive field names that should be redacted
    cleanup_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'cleanup_requested', 'cleanup_completed', 'cleanup_failed', 'cleanup_skipped'
    cleanup_requested_at TIMESTAMP WITH TIME ZONE,
    cleanup_completed_at TIMESTAMP WITH TIME ZONE,
    cleanup_error_message TEXT,
    retention_days INTEGER DEFAULT 30, -- How long to keep this data
    expires_at TIMESTAMP WITH TIME ZONE, -- Calculated from created_date + retention_days
    is_cleanup_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_test_data_ledger_run_execution_id ON test_data_ledger(run_execution_id);
CREATE INDEX idx_test_data_ledger_data_type ON test_data_ledger(data_type);
CREATE INDEX idx_test_data_ledger_data_category ON test_data_ledger(data_category);
CREATE INDEX idx_test_data_ledger_identifier ON test_data_ledger(identifier);
CREATE INDEX idx_test_data_ledger_cleanup_status ON test_data_ledger(cleanup_status);
CREATE INDEX idx_test_data_ledger_expires_at ON test_data_ledger(expires_at);
CREATE INDEX idx_test_data_ledger_is_cleanup_eligible ON test_data_ledger(is_cleanup_eligible);

-- cleanup_jobs table: Track cleanup job executions
CREATE TABLE IF NOT EXISTS cleanup_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'test_data', 'artifacts', 'expired_sessions', etc.
    job_name VARCHAR(255) NOT NULL,
    triggered_by VARCHAR(255) NOT NULL, -- 'system', 'operator', 'schedule'
    triggered_by_operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    filters JSONB, -- Filters applied to this cleanup job
    dry_run BOOLEAN NOT NULL DEFAULT FALSE, -- If true, only show what would be deleted
    total_records_reviewed INTEGER DEFAULT 0,
    total_records_eligible INTEGER DEFAULT 0,
    total_records_deleted INTEGER DEFAULT 0,
    total_records_failed INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    approval_id INTEGER REFERENCES approvals(id) ON DELETE SET NULL,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_cleanup_jobs_job_type ON cleanup_jobs(job_type);
CREATE INDEX idx_cleanup_jobs_status ON cleanup_jobs(status);
CREATE INDEX idx_cleanup_jobs_created_date ON cleanup_jobs(created_date);
CREATE INDEX idx_cleanup_jobs_triggered_by ON cleanup_jobs(triggered_by);

-- cleanup_job_details table: Detailed log of cleanup operations
CREATE TABLE IF NOT EXISTS cleanup_job_details (
    id SERIAL PRIMARY KEY,
    cleanup_job_id INTEGER REFERENCES cleanup_jobs(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    entity_type VARCHAR(100),
    identifier VARCHAR(511),
    action VARCHAR(50) NOT NULL, -- 'reviewed', 'deleted', 'skipped', 'failed'
    action_reason TEXT,
    error_message TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cleanup_job_details_cleanup_job_id ON cleanup_job_details(cleanup_job_id);
CREATE INDEX idx_cleanup_job_details_action ON cleanup_job_details(action);

-- data_redaction_rules table: Rules for redacting sensitive data
CREATE TABLE IF NOT EXISTS data_redaction_rules (
    id SERIAL PRIMARY KEY,
    field_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- 'email', 'phone', 'card_number', 'cvv', 'ssn', 'address', etc.
    redaction_pattern VARCHAR(255) NOT NULL, -- Regex or pattern for redaction
    replacement_pattern VARCHAR(255) DEFAULT '***', -- What to replace with
    applies_to_tables TEXT[] NOT NULL, -- Which tables this rule applies to
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER DEFAULT 100, -- Higher priority rules applied first
    description TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(field_name, field_type)
);

CREATE INDEX idx_data_redaction_rules_field_name ON data_redaction_rules(field_name);
CREATE INDEX idx_data_redaction_rules_field_type ON data_redaction_rules(field_type);
CREATE INDEX idx_data_redaction_rules_is_active ON data_redaction_rules(is_active);
CREATE INDEX idx_data_redaction_rules_priority ON data_redaction_rules(priority);
END
