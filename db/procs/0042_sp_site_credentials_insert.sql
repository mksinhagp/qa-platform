BEGIN
-- Stored Procedure 0042: Insert site credential
CREATE OR REPLACE FUNCTION sp_site_credentials_insert(
    i_site_id INTEGER,
    i_site_environment_id INTEGER,
    i_role_name VARCHAR,
    i_secret_id INTEGER,
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_role_name VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    INSERT INTO site_credentials (
        site_id, site_environment_id, role_name, secret_id,
        description, created_by, updated_by
    )
    VALUES (
        i_site_id, i_site_environment_id, i_role_name, i_secret_id,
        i_description, i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        site_id AS o_site_id,
        site_environment_id AS o_site_environment_id,
        role_name AS o_role_name,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
