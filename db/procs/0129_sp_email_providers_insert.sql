-- Stored Procedure: sp_email_providers_insert
-- Purpose: Insert or update an email provider configuration
CREATE OR REPLACE FUNCTION sp_email_providers_insert(
    i_name VARCHAR(255),
    i_provider_type VARCHAR(50),
    i_config_json JSONB DEFAULT '{}',
    i_secret_id INTEGER DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT TRUE,
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR(255),
    o_provider_type VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_providers (
        name, provider_type, config_json, secret_id, is_active,
        notes, created_by, updated_by
    ) VALUES (
        i_name, i_provider_type, i_config_json, i_secret_id, i_is_active,
        i_notes, i_created_by, i_created_by
    )
    ON CONFLICT (name)
    DO UPDATE SET
        provider_type = EXCLUDED.provider_type,
        config_json = EXCLUDED.config_json,
        secret_id = COALESCE(EXCLUDED.secret_id, email_providers.secret_id),
        is_active = EXCLUDED.is_active,
        notes = COALESCE(EXCLUDED.notes, email_providers.notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_created_by
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_name, i_provider_type;
END;
$$;
