BEGIN
-- Migration 0006: Phase 1 Auth and Vault tables
-- Tables: operator_sessions, vault_unlock_sessions

-- operator_sessions table: Server-side session records
CREATE TABLE IF NOT EXISTS operator_sessions (
    id SERIAL PRIMARY KEY,
    operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_operator_sessions_operator_id ON operator_sessions(operator_id);
CREATE INDEX idx_operator_sessions_session_token ON operator_sessions(session_token);
CREATE INDEX idx_operator_sessions_expires_date ON operator_sessions(expires_date);
CREATE INDEX idx_operator_sessions_is_active ON operator_sessions(is_active);

-- vault_unlock_sessions table: Short-lived unlock context per operator session
CREATE TABLE IF NOT EXISTS vault_unlock_sessions (
    id SERIAL PRIMARY KEY,
    operator_session_id INTEGER NOT NULL REFERENCES operator_sessions(id) ON DELETE CASCADE,
    unlock_token VARCHAR(255) NOT NULL UNIQUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_vault_unlock_sessions_operator_session_id ON vault_unlock_sessions(operator_session_id);
CREATE INDEX idx_vault_unlock_sessions_unlock_token ON vault_unlock_sessions(unlock_token);
CREATE INDEX idx_vault_unlock_sessions_expires_date ON vault_unlock_sessions(expires_date);
CREATE INDEX idx_vault_unlock_sessions_is_active ON vault_unlock_sessions(is_active);

END
