BEGIN
-- Stored Procedure 0184: Get test identity by id
CREATE OR REPLACE FUNCTION sp_test_identities_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_persona_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_identity_type VARCHAR,
    o_first_name VARCHAR,
    o_last_name VARCHAR,
    o_full_name VARCHAR,
    o_email VARCHAR,
    o_username VARCHAR,
    o_phone VARCHAR,
    o_date_of_birth DATE,
    o_address_line1 VARCHAR,
    o_address_line2 VARCHAR,
    o_city VARCHAR,
    o_state VARCHAR,
    o_postal_code VARCHAR,
    o_country VARCHAR,
    o_emergency_contact_name VARCHAR,
    o_emergency_contact_phone VARCHAR,
    o_emergency_contact_relationship VARCHAR,
    o_custom_fields JSONB,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        run_execution_id AS o_run_execution_id,
        persona_id AS o_persona_id,
        site_id AS o_site_id,
        site_environment_id AS o_site_environment_id,
        identity_type AS o_identity_type,
        first_name AS o_first_name,
        last_name AS o_last_name,
        full_name AS o_full_name,
        email AS o_email,
        username AS o_username,
        phone AS o_phone,
        date_of_birth AS o_date_of_birth,
        address_line1 AS o_address_line1,
        address_line2 AS o_address_line2,
        city AS o_city,
        state AS o_state,
        postal_code AS o_postal_code,
        country AS o_country,
        emergency_contact_name AS o_emergency_contact_name,
        emergency_contact_phone AS o_emergency_contact_phone,
        emergency_contact_relationship AS o_emergency_contact_relationship,
        custom_fields AS o_custom_fields,
        is_active AS o_is_active,
        created_date AS o_created_date,
        updated_date AS o_updated_date
    FROM test_identities
    WHERE id = i_id;
END;
$$ LANGUAGE plpgsql;
END
