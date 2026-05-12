-- Stored Procedure: sp_email_providers_update
-- Purpose: Partial update of an email provider; only non-NULL inputs overwrite existing values
CREATE OR REPLACE FUNCTION sp_email_providers_update(
    i_id INTEGER,
    i_name VARCHAR(255) DEFAULT NULL,
    i_provider_type VARCHAR(50) DEFAULT NULL,
    i_config_json JSONB DEFAULT NULL,
    i_secret_id INTEGER DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_notes TEXT DEFAULT NULL,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR(255),
    o_provider_type VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE email_providers
    SET
        name = COALESCE(i_name, name),
        provider_type = COALESCE(i_provider_type, provider_type),
        config_json = COALESCE(i_config_json, config_json),
        secret_id = COALESCE(i_secret_id, secret_id),
        is_active = COALESCE(i_is_active, is_active),
        notes = COALESCE(i_notes, notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id;

    RETURN QUERY
    SELECT ep.id, ep.name, ep.provider_type
    FROM email_providers ep
    WHERE ep.id = i_id;
END;
$$;
