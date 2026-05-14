BEGIN
-- Stored Procedure 0182: Insert test identity
CREATE OR REPLACE FUNCTION sp_test_identities_insert(
    i_run_execution_id INTEGER,
    i_site_id INTEGER,
    i_site_environment_id INTEGER,
    i_identity_type VARCHAR,
    i_first_name VARCHAR,
    i_last_name VARCHAR,
    i_email VARCHAR,
    i_persona_id INTEGER DEFAULT NULL,
    i_username VARCHAR DEFAULT NULL,
    i_phone VARCHAR DEFAULT NULL,
    i_date_of_birth DATE DEFAULT NULL,
    i_address_line1 VARCHAR DEFAULT NULL,
    i_address_line2 VARCHAR DEFAULT NULL,
    i_city VARCHAR DEFAULT NULL,
    i_state VARCHAR DEFAULT NULL,
    i_postal_code VARCHAR DEFAULT NULL,
    i_country VARCHAR DEFAULT 'US',
    i_emergency_contact_name VARCHAR DEFAULT NULL,
    i_emergency_contact_phone VARCHAR DEFAULT NULL,
    i_emergency_contact_relationship VARCHAR DEFAULT NULL,
    i_custom_fields JSONB DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_email VARCHAR,
    o_identity_type VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO test_identities (
        run_execution_id, persona_id, site_id, site_environment_id,
        identity_type, first_name, last_name, full_name, email, username, phone,
        date_of_birth, address_line1, address_line2, city, state, postal_code, country,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        custom_fields, created_by, updated_by
    )
    VALUES (
        i_run_execution_id, i_persona_id, i_site_id, i_site_environment_id,
        i_identity_type, i_first_name, i_last_name,
        CONCAT(i_first_name, ' ', i_last_name),
        i_email, i_username, i_phone,
        i_date_of_birth, i_address_line1, i_address_line2, i_city, i_state, i_postal_code, i_country,
        i_emergency_contact_name, i_emergency_contact_phone, i_emergency_contact_relationship,
        i_custom_fields, i_created_by, i_created_by
    )
    ON CONFLICT (run_execution_id, email)
    DO UPDATE SET
        username = COALESCE(EXCLUDED.username, test_identities.username),
        phone = COALESCE(EXCLUDED.phone, test_identities.phone),
        custom_fields = COALESCE(EXCLUDED.custom_fields, test_identities.custom_fields),
        updated_by = i_created_by,
        updated_date = CURRENT_TIMESTAMP
    RETURNING
        id AS o_id,
        email AS o_email,
        identity_type AS o_identity_type,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
