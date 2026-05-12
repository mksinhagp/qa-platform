-- Stored Procedure: sp_email_correlation_configs_get
-- Purpose: Get the active correlation config for a site, optionally scoped to a specific provider
CREATE OR REPLACE FUNCTION sp_email_correlation_configs_get(
    i_site_id INTEGER,
    i_email_provider_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_email_provider_id INTEGER,
    o_strategy VARCHAR(50),
    o_base_address VARCHAR(255),
    o_token_pattern VARCHAR(255),
    o_config_json JSONB,
    o_is_active BOOLEAN,
    o_notes TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ecc.id, ecc.site_id, ecc.email_provider_id,
        ecc.strategy, ecc.base_address, ecc.token_pattern,
        ecc.config_json, ecc.is_active, ecc.notes
    FROM email_correlation_configs ecc
    WHERE ecc.site_id = i_site_id
      AND ecc.is_active = TRUE
      AND (i_email_provider_id IS NULL OR ecc.email_provider_id = i_email_provider_id)
    ORDER BY ecc.created_date DESC
    LIMIT 1;
END;
$$;
