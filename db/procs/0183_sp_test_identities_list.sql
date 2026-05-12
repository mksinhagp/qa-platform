BEGIN
-- Stored Procedure 0183: List test identities
CREATE OR REPLACE FUNCTION sp_test_identities_list(
    i_run_execution_id INTEGER DEFAULT NULL,
    i_site_id INTEGER DEFAULT NULL,
    i_persona_id INTEGER DEFAULT NULL,
    i_identity_type VARCHAR DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_persona_id INTEGER,
    o_site_id INTEGER,
    o_identity_type VARCHAR,
    o_full_name VARCHAR,
    o_email VARCHAR,
    o_username VARCHAR,
    o_phone VARCHAR,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        run_execution_id AS o_run_execution_id,
        persona_id AS o_persona_id,
        site_id AS o_site_id,
        identity_type AS o_identity_type,
        full_name AS o_full_name,
        email AS o_email,
        username AS o_username,
        phone AS o_phone,
        is_active AS o_is_active,
        created_date AS o_created_date
    FROM test_identities
    WHERE
        (i_run_execution_id IS NULL OR run_execution_id = i_run_execution_id)
        AND (i_site_id IS NULL OR site_id = i_site_id)
        AND (i_persona_id IS NULL OR persona_id = i_persona_id)
        AND (i_identity_type IS NULL OR identity_type = i_identity_type)
        AND (i_is_active IS NULL OR is_active = i_is_active)
    ORDER BY created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
