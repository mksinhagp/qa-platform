BEGIN
-- Migration 0007: Secret management tables
-- Tables: secret_records, secret_access_logs

-- secret_records table: Encrypted secret payloads + metadata
CREATE TABLE IF NOT EXISTS secret_records (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    owner_scope VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    encrypted_payload BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    aad TEXT,
    wrapped_dek BYTEA NOT NULL,
    wrap_nonce BYTEA,
    kdf_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    is_session_only BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(owner_scope, name)
);

CREATE INDEX idx_secret_records_category ON secret_records(category);
CREATE INDEX idx_secret_records_owner_scope ON secret_records(owner_scope);
CREATE INDEX idx_secret_records_is_active ON secret_records(is_active);
CREATE INDEX idx_secret_records_is_session_only ON secret_records(is_session_only);

-- secret_access_logs table: Every reveal/decrypt-for-run event
CREATE TABLE IF NOT EXISTS secret_access_logs (
    id SERIAL PRIMARY KEY,
    secret_id INTEGER NOT NULL REFERENCES secret_records(id) ON DELETE CASCADE,
    operator_id INTEGER NOT NULL REFERENCES operators(id),
    operator_session_id INTEGER REFERENCES operator_sessions(id),
    access_type VARCHAR(50) NOT NULL,
    access_reason TEXT,
    run_execution_id INTEGER,
    ip_address INET,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_secret_access_logs_secret_id ON secret_access_logs(secret_id);
CREATE INDEX idx_secret_access_logs_operator_id ON secret_access_logs(operator_id);
CREATE INDEX idx_secret_access_logs_operator_session_id ON secret_access_logs(operator_session_id);
CREATE INDEX idx_secret_access_logs_access_type ON secret_access_logs(access_type);
CREATE INDEX idx_secret_access_logs_created_date ON secret_access_logs(created_date);
CREATE INDEX idx_secret_access_logs_run_execution_id ON secret_access_logs(run_execution_id);

END
