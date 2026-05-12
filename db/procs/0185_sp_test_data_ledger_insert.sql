BEGIN
-- Stored Procedure 0185: Insert test data ledger entry
CREATE OR REPLACE FUNCTION sp_test_data_ledger_insert(
    i_run_execution_id INTEGER,
    i_data_type VARCHAR,
    i_data_category VARCHAR,
    i_entity_id INTEGER DEFAULT NULL,
    i_entity_type VARCHAR DEFAULT NULL,
    i_identifier VARCHAR,
    i_identifier_type VARCHAR,
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL,
    i_persona_id INTEGER DEFAULT NULL,
    i_data_json JSONB DEFAULT NULL,
    i_sensitive_fields TEXT[] DEFAULT NULL,
    i_retention_days INTEGER DEFAULT 30,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_identifier VARCHAR,
    o_cleanup_status VARCHAR,
    o_expires_at TIMESTAMP WITH TIME ZONE,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate expiration date
    v_expires_at := CURRENT_TIMESTAMP + (i_retention_days || ' days')::INTERVAL;

    RETURN QUERY
    INSERT INTO test_data_ledger (
        run_execution_id, data_type, data_category,
        entity_id, entity_type, identifier, identifier_type,
        site_id, site_environment_id, persona_id,
        data_json, sensitive_fields,
        retention_days, expires_at, is_cleanup_eligible,
        created_by, updated_by
    )
    VALUES (
        i_run_execution_id, i_data_type, i_data_category,
        i_entity_id, i_entity_type, i_identifier, i_identifier_type,
        i_site_id, i_site_environment_id, i_persona_id,
        i_data_json, i_sensitive_fields,
        i_retention_days, v_expires_at, FALSE,
        i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        identifier AS o_identifier,
        cleanup_status AS o_cleanup_status,
        expires_at AS o_expires_at,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
