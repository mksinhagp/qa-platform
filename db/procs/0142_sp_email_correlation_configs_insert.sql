-- Stored Procedure: sp_email_correlation_configs_insert
-- Purpose: Insert or update an email correlation config for a site/provider combination
CREATE OR REPLACE FUNCTION sp_email_correlation_configs_insert(
    i_site_id INTEGER,
    i_strategy VARCHAR(50) DEFAULT 'plus_addressing',
    i_email_provider_id INTEGER DEFAULT NULL,
    i_base_address VARCHAR(255) DEFAULT NULL,
    i_token_pattern VARCHAR(255) DEFAULT NULL,
    i_config_json JSONB DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT TRUE,
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_strategy VARCHAR(50),
    o_base_address VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_correlation_configs (
        site_id, email_provider_id, strategy, base_address,
        token_pattern, config_json, is_active, notes,
        created_by, updated_by
    ) VALUES (
        i_site_id, i_email_provider_id, i_strategy, i_base_address,
        i_token_pattern, i_config_json, i_is_active, i_notes,
        i_created_by, i_created_by
    )
    ON CONFLICT (site_id, email_provider_id)
    DO UPDATE SET
        strategy = EXCLUDED.strategy,
        base_address = COALESCE(EXCLUDED.base_address, email_correlation_configs.base_address),
        token_pattern = COALESCE(EXCLUDED.token_pattern, email_correlation_configs.token_pattern),
        config_json = COALESCE(EXCLUDED.config_json, email_correlation_configs.config_json),
        is_active = EXCLUDED.is_active,
        notes = COALESCE(EXCLUDED.notes, email_correlation_configs.notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_created_by
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_strategy, i_base_address;
END;
$$;
