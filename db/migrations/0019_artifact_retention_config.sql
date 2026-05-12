BEGIN
-- Migration 0019: Artifact retention configuration table
-- Purpose: Per-artifact-type retention policy configuration, seeded with defaults.
-- This table drives both the cleanup job (sp_artifacts_list_expired) and the
-- dashboard audit page.

CREATE TABLE IF NOT EXISTS artifact_retention_config (
    id SERIAL PRIMARY KEY,
    artifact_type VARCHAR(50) NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

-- Seed default retention config per artifact type
INSERT INTO artifact_retention_config (artifact_type, retention_days, notes, created_by, updated_by)
VALUES
    ('trace',           30,  'Playwright traces — 30 days', 'system', 'system'),
    ('video',           14,  'Full-flow videos — 14 days',  'system', 'system'),
    ('screenshot',       7,  'Screenshots — 7 days',        'system', 'system'),
    ('har',             30,  'HAR network logs — 30 days',  'system', 'system'),
    ('console_log',     14,  'Console logs — 14 days',      'system', 'system'),
    ('network_log',     14,  'Network logs — 14 days',      'system', 'system'),
    ('walkthrough_mp4', 14,  'Walkthrough MP4s — 14 days',  'system', 'system')
ON CONFLICT (artifact_type) DO NOTHING;

END;
