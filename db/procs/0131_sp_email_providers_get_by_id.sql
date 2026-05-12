-- Stored Procedure: sp_email_providers_get_by_id
-- Purpose: Retrieve a single email provider record by its primary key
CREATE OR REPLACE FUNCTION sp_email_providers_get_by_id(
    i_id INTEGER
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
    WHERE ep.id = i_id;
END;
$$;
