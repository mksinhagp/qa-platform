BEGIN
-- Migration 0026: Orchestration tables for Phase 20
-- Tables: qa_campaigns, campaign_scenarios, campaign_schedules, campaign_signoffs

-- qa_campaigns table: QA campaign definitions
CREATE TABLE IF NOT EXISTS qa_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(511) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL, -- 'smoke', 'regression', 'release_certification', 'payment_certification', 'accessibility_audit', 'email_deliverability'
    description TEXT,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER REFERENCES site_environments(id) ON DELETE CASCADE,
    -- Matrix dimensions
    persona_ids INTEGER[], -- Array of persona IDs to include
    device_profile_ids INTEGER[], -- Array of device profile IDs to include
    network_profile_ids INTEGER[], -- Array of network profile IDs to include
    browser_types VARCHAR(50)[], -- Array of browser types: 'chromium', 'firefox', 'webkit'
    payment_scenario_ids INTEGER[], -- Array of payment scenario IDs
    email_provider_ids INTEGER[], -- Array of email provider IDs
    flow_types VARCHAR(50)[], -- Array of flow types: 'registration', 'checkout', 'login', etc.
    -- Execution settings
    concurrency_cap INTEGER DEFAULT 5, -- Max concurrent executions
    retry_on_failure BOOLEAN DEFAULT FALSE,
    max_retries INTEGER DEFAULT 1,
    -- Approval gates
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_policy_id INTEGER REFERENCES approval_policies(id) ON DELETE SET NULL,
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_qa_campaigns_site_id ON qa_campaigns(site_id);
CREATE INDEX idx_qa_campaigns_campaign_type ON qa_campaigns(campaign_type);
CREATE INDEX idx_qa_campaigns_is_active ON qa_campaigns(is_active);

-- campaign_scenarios table: Materialized scenario matrix for campaigns
CREATE TABLE IF NOT EXISTS campaign_scenarios (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES qa_campaigns(id) ON DELETE CASCADE,
    persona_id INTEGER REFERENCES personas(id) ON DELETE SET NULL,
    device_profile_id INTEGER REFERENCES device_profiles(id) ON DELETE SET NULL,
    network_profile_id INTEGER REFERENCES network_profiles(id) ON DELETE SET NULL,
    browser_type VARCHAR(50),
    payment_scenario_id INTEGER REFERENCES payment_scenarios(id) ON DELETE SET NULL,
    email_provider_id INTEGER REFERENCES payment_providers(id) ON DELETE SET NULL,
    flow_type VARCHAR(50),
    scenario_hash VARCHAR(255) NOT NULL, -- Hash of all scenario dimensions for deduplication
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, scenario_hash)
);

CREATE INDEX idx_campaign_scenarios_campaign_id ON campaign_scenarios(campaign_id);
CREATE INDEX idx_campaign_scenarios_scenario_hash ON campaign_scenarios(scenario_hash);
CREATE INDEX idx_campaign_scenarios_is_active ON campaign_scenarios(is_active);

-- campaign_schedules table: Campaign scheduling configuration
CREATE TABLE IF NOT EXISTS campaign_schedules (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES qa_campaigns(id) ON DELETE CASCADE,
    schedule_type VARCHAR(50) NOT NULL, -- 'manual', 'nightly', 'pre_release', 'webhook', 'cron'
    schedule_config JSONB, -- Schedule-specific configuration (cron expression, webhook URL, etc.)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_campaign_schedules_campaign_id ON campaign_schedules(campaign_id);
CREATE INDEX idx_campaign_schedules_schedule_type ON campaign_schedules(schedule_type);
CREATE INDEX idx_campaign_schedules_is_active ON campaign_schedules(is_active);
CREATE INDEX idx_campaign_schedules_next_run_at ON campaign_schedules(next_run_at);

-- campaign_signoffs table: QA sign-off workflow results
CREATE TABLE IF NOT EXISTS campaign_signoffs (
    id SERIAL PRIMARY KEY,
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES qa_campaigns(id) ON DELETE SET NULL,
    signoff_type VARCHAR(50) NOT NULL, -- 'pass', 'fail', 'conditional_pass', 'exception'
    signed_by_operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
    signoff_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Summary
    total_scenarios INTEGER NOT NULL DEFAULT 0,
    passed_scenarios INTEGER NOT NULL DEFAULT 0,
    failed_scenarios INTEGER NOT NULL DEFAULT 0,
    unresolved_defects INTEGER NOT NULL DEFAULT 0,
    -- Details
    notes TEXT,
    exception_reason TEXT,
    known_issues TEXT[], -- Array of known issue IDs or descriptions
    -- Approval
    approval_id INTEGER REFERENCES approvals(id) ON DELETE SET NULL,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_campaign_signoffs_run_id ON campaign_signoffs(run_id);
CREATE INDEX idx_campaign_signoffs_campaign_id ON campaign_signoffs(campaign_id);
CREATE INDEX idx_campaign_signoffs_signoff_type ON campaign_signoffs(signoff_type);
CREATE INDEX idx_campaign_signoffs_signoff_date ON campaign_signoffs(signoff_date);

-- campaign_executions table: Track campaign execution runs
CREATE TABLE IF NOT EXISTS campaign_executions (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES qa_campaigns(id) ON DELETE CASCADE,
    run_id INTEGER REFERENCES runs(id) ON DELETE SET NULL,
    execution_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'webhook'
    triggered_by VARCHAR(255) NOT NULL,
    triggered_by_operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    -- Execution metrics
    total_scenarios INTEGER NOT NULL DEFAULT 0,
    executed_scenarios INTEGER NOT NULL DEFAULT 0,
    successful_scenarios INTEGER NOT NULL DEFAULT 0,
    failed_scenarios INTEGER NOT NULL DEFAULT 0,
    skipped_scenarios INTEGER NOT NULL DEFAULT 0,
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    -- Error handling
    error_message TEXT,
    -- Approval
    approval_id INTEGER REFERENCES approvals(id) ON DELETE SET NULL,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_campaign_executions_campaign_id ON campaign_executions(campaign_id);
CREATE INDEX idx_campaign_executions_run_id ON campaign_executions(run_id);
CREATE INDEX idx_campaign_executions_status ON campaign_executions(status);
CREATE INDEX idx_campaign_executions_created_date ON campaign_executions(created_date);
END
