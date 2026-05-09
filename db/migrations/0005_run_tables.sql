BEGIN
-- Migration 0005: Run and execution tables
-- Tables: runs, run_executions, run_steps, approvals, artifacts

-- runs table: Parent matrix run record
CREATE TABLE IF NOT EXISTS runs (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id),
    site_environment_id INTEGER NOT NULL REFERENCES site_environments(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'awaiting_approval', 'running', 'paused_for_approval', 'completed', 'aborted', 'failed'
    config JSONB NOT NULL, -- MatrixRunConfig as JSON
    started_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_executions INTEGER NOT NULL DEFAULT 0,
    successful_executions INTEGER NOT NULL DEFAULT 0,
    failed_executions INTEGER NOT NULL DEFAULT 0,
    skipped_executions INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_runs_site_id ON runs(site_id);
CREATE INDEX idx_runs_site_environment_id ON runs(site_environment_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_started_by ON runs(started_by);
CREATE INDEX idx_runs_started_at ON runs(started_at);
CREATE INDEX idx_runs_is_pinned ON runs(is_pinned);

-- run_executions table: Child execution per persona × device × network
CREATE TABLE IF NOT EXISTS run_executions (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    persona_id VARCHAR(100) NOT NULL REFERENCES personas(id),
    device_profile_id INTEGER NOT NULL REFERENCES device_profiles(id),
    network_profile_id INTEGER NOT NULL REFERENCES network_profiles(id),
    browser VARCHAR(50) NOT NULL, -- 'chromium', 'firefox', 'webkit'
    flow_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'running', 'paused', 'passed', 'failed', 'aborted', 'skipped_by_approval', 'friction_flagged'
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    friction_score DECIMAL(5,2), -- 0..100
    error_message TEXT,
    artifact_path VARCHAR(512), -- Base path for execution artifacts
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_run_executions_run_id ON run_executions(run_id);
CREATE INDEX idx_run_executions_persona_id ON run_executions(persona_id);
CREATE INDEX idx_run_executions_status ON run_executions(status);
CREATE INDEX idx_run_executions_browser ON run_executions(browser);
CREATE INDEX idx_run_executions_flow_name ON run_executions(flow_name);

-- run_steps table: Per-step record inside an execution
CREATE TABLE IF NOT EXISTS run_steps (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    step_name VARCHAR(255) NOT NULL,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL, -- 'navigation', 'action', 'assertion', 'approval', 'cleanup'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'passed', 'failed', 'skipped', 'awaiting_approval'
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    approval_id INTEGER REFERENCES approvals(id),
    details JSONB, -- Step-specific data
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_run_steps_run_execution_id ON run_steps(run_execution_id);
CREATE INDEX idx_run_steps_step_order ON run_steps(step_order);
CREATE INDEX idx_run_steps_status ON run_steps(status);
CREATE INDEX idx_run_steps_approval_id ON run_steps(approval_id);

-- approvals table: Approval requests tied to run steps
CREATE TABLE IF NOT EXISTS approvals (
    id SERIAL PRIMARY KEY,
    run_step_id INTEGER NOT NULL REFERENCES run_steps(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- e.g. 'checkout_submit', 'admin_write'
    target_type VARCHAR(100),
    target_id VARCHAR(255),
    payload_summary TEXT,
    required_strength VARCHAR(50) NOT NULL DEFAULT 'one_click', -- 'none', 'one_click', 'strong'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'timed_out'
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    timeout_at TIMESTAMP WITH TIME ZONE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_approvals_run_step_id ON approvals(run_step_id);
CREATE INDEX idx_approvals_category ON approvals(category);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_timeout_at ON approvals(timeout_at);

-- artifacts table: Index of files on disk (trace/video/screenshot/HAR)
CREATE TABLE IF NOT EXISTS artifacts (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER NOT NULL REFERENCES run_executions(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL, -- 'trace', 'video', 'screenshot', 'har', 'console_log', 'network_log', 'walkthrough_mp4'
    file_path VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    description TEXT,
    retention_date TIMESTAMP WITH TIME ZONE, -- When to delete
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_artifacts_run_execution_id ON artifacts(run_execution_id);
CREATE INDEX idx_artifacts_artifact_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_retention_date ON artifacts(retention_date);

END;
