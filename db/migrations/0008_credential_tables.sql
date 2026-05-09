BEGIN
-- Migration 0008: Credential and profile tables
-- Tables: site_credentials, payment_profiles, email_inboxes

-- site_credentials table: Mapping from site env + role -> secret reference
CREATE TABLE IF NOT EXISTS site_credentials (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER NOT NULL REFERENCES site_environments(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    secret_id INTEGER NOT NULL REFERENCES secret_records(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(site_id, site_environment_id, role_name)
);

CREATE INDEX idx_site_credentials_site_id ON site_credentials(site_id);
CREATE INDEX idx_site_credentials_site_environment_id ON site_credentials(site_environment_id);
CREATE INDEX idx_site_credentials_secret_id ON site_credentials(secret_id);
CREATE INDEX idx_site_credentials_is_active ON site_credentials(is_active);

-- payment_profiles table: Sandbox card/ACH metadata pointing at vault secret
CREATE TABLE IF NOT EXISTS payment_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    last_4 VARCHAR(4),
    card_brand VARCHAR(50),
    expiry_month INTEGER,
    expiry_year INTEGER,
    secret_id INTEGER NOT NULL REFERENCES secret_records(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_payment_profiles_name ON payment_profiles(name);
CREATE INDEX idx_payment_profiles_payment_type ON payment_profiles(payment_type);
CREATE INDEX idx_payment_profiles_secret_id ON payment_profiles(secret_id);
CREATE INDEX idx_payment_profiles_is_active ON payment_profiles(is_active);

-- email_inboxes table: Inbox config pointing at vault secret
CREATE TABLE IF NOT EXISTS email_inboxes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    use_tls BOOLEAN NOT NULL DEFAULT TRUE,
    username VARCHAR(255) NOT NULL,
    secret_id INTEGER NOT NULL REFERENCES secret_records(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_email_inboxes_name ON email_inboxes(name);
CREATE INDEX idx_email_inboxes_provider ON email_inboxes(provider);
CREATE INDEX idx_email_inboxes_secret_id ON email_inboxes(secret_id);
CREATE INDEX idx_email_inboxes_is_active ON email_inboxes(is_active);

END
