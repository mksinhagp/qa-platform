-- Stored Procedure: sp_email_providers_list
-- Purpose: List all email providers
CREATE OR REPLACE FUNCTION sp_email_providers_list(
    i_active_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR(255),
    o_provider_type VARCHAR(50),
    o_is_active BOOLEAN,
    o_config_json JSONB,
    o_secret_id INTEGER,
    o_notes TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ep.id, ep.name, ep.provider_type, ep.is_active,
        ep.config_json, ep.secret_id, ep.notes,
        ep.created_date, ep.updated_date
    FROM email_providers ep
    WHERE (NOT i_active_only OR ep.is_active = TRUE)
    ORDER BY ep.name;
END;
$$;
