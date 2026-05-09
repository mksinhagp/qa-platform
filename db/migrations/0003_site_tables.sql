BEGIN
-- Migration 0003: Site tables
-- Tables: sites, site_environments

-- sites table: One row per site under test
CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    base_url VARCHAR(2048) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_sites_name ON sites(name);
CREATE INDEX idx_sites_is_active ON sites(is_active);

-- site_environments table: Dev/Stage/Prod-like environments per site
CREATE TABLE IF NOT EXISTS site_environments (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'dev', 'staging', 'production', etc.
    base_url VARCHAR(2048) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system',
    UNIQUE(site_id, name)
);

CREATE INDEX idx_site_environments_site_id ON site_environments(site_id);
CREATE INDEX idx_site_environments_name ON site_environments(name);
CREATE INDEX idx_site_environments_is_active ON site_environments(is_active);

END;
