BEGIN
-- Migration 0010: Site binding tables for payment profiles and email inboxes
-- Adds site_env_payment_bindings and site_env_email_bindings
-- site_credentials already exists (migration 0008) for credential binding

-- site_env_payment_bindings: Maps a site environment to a payment profile, tagged by role
CREATE TABLE IF NOT EXISTS site_env_payment_bindings (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER NOT NULL REFERENCES site_environments(id) ON DELETE CASCADE,
    payment_profile_id INTEGER NOT NULL REFERENCES payment_profiles(id) ON DELETE CASCADE,
    role_tag VARCHAR(100) NOT NULL,          -- free-text, e.g. 'registrant', 'admin'
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(site_environment_id, payment_profile_id, role_tag)
);

CREATE INDEX idx_site_env_payment_bindings_site_id ON site_env_payment_bindings(site_id);
CREATE INDEX idx_site_env_payment_bindings_env_id ON site_env_payment_bindings(site_environment_id);
CREATE INDEX idx_site_env_payment_bindings_profile_id ON site_env_payment_bindings(payment_profile_id);

-- site_env_email_bindings: Maps a site environment to an email inbox, tagged by role
CREATE TABLE IF NOT EXISTS site_env_email_bindings (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER NOT NULL REFERENCES site_environments(id) ON DELETE CASCADE,
    email_inbox_id INTEGER NOT NULL REFERENCES email_inboxes(id) ON DELETE CASCADE,
    role_tag VARCHAR(100) NOT NULL,          -- free-text, e.g. 'registrant', 'email_validator'
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(site_environment_id, email_inbox_id, role_tag)
);

CREATE INDEX idx_site_env_email_bindings_site_id ON site_env_email_bindings(site_id);
CREATE INDEX idx_site_env_email_bindings_env_id ON site_env_email_bindings(site_environment_id);
CREATE INDEX idx_site_env_email_bindings_inbox_id ON site_env_email_bindings(email_inbox_id);

END;
