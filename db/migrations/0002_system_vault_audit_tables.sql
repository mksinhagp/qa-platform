BEGIN
-- Migration 0002: System, vault, and audit tables
-- Tables: system_settings, vault_state, audit_logs

-- system_settings table: Non-secret config flags
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    is_secret BOOLEAN NOT NULL DEFAULT FALSE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_is_secret ON system_settings(is_secret);

-- vault_state table: Vault bootstrap status, KDF params, wrapped root key metadata
CREATE TABLE IF NOT EXISTS vault_state (
    id SERIAL PRIMARY KEY,
    is_bootstrapped BOOLEAN NOT NULL DEFAULT FALSE,
    bootstrap_date TIMESTAMP WITH TIME ZONE,
    bootstrap_operator_id INTEGER REFERENCES operators(id),
    kdf_algorithm VARCHAR(50) NOT NULL DEFAULT 'argon2id',
    kdf_memory INTEGER NOT NULL DEFAULT 131072, -- 128 MiB in KiB
    kdf_iterations INTEGER NOT NULL DEFAULT 3,
    kdf_parallelism INTEGER NOT NULL DEFAULT 2,
    kdf_salt BYTEA NOT NULL,
    wrapped_rvk BYTEA, -- Wrapped root vault key
    aad TEXT, -- Additional authenticated data (vault id)
    master_password_last_changed TIMESTAMP WITH TIME ZONE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_vault_state_is_bootstrapped ON vault_state(is_bootstrapped);

-- audit_logs table: Append-only audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_type VARCHAR(50) NOT NULL, -- 'operator', 'system', 'runner'
    actor_id VARCHAR(255), -- operator_id or system identifier
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    details TEXT, -- JSON or structured text
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'success', -- 'success', 'failure', 'partial'
    error_message TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor_type ON audit_logs(actor_type);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX idx_audit_logs_created_date ON audit_logs(created_date);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

END;
