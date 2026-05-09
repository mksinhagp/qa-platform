BEGIN
-- Migration 0009: Approval policies table
-- Table: approval_policies

-- approval_policies table: Per-action-category approval strength
CREATE TABLE IF NOT EXISTS approval_policies (
    id SERIAL PRIMARY KEY,
    action_category VARCHAR(100) NOT NULL UNIQUE,
    default_strength VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_approval_policies_action_category ON approval_policies(action_category);
CREATE INDEX idx_approval_policies_is_system ON approval_policies(is_system);

END
