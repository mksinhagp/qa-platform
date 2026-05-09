BEGIN
-- Stored Procedure 0043: List site credentials
CREATE OR REPLACE FUNCTION sp_site_credentials_list(
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_role_name VARCHAR,
    o_description TEXT,
    o_is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        site_id AS o_site_id,
        site_environment_id AS o_site_environment_id,
        role_name AS o_role_name,
        description AS o_description,
        is_active AS o_is_active
    FROM site_credentials
    WHERE
        (i_site_id IS NULL OR site_id = i_site_id)
        AND (i_site_environment_id IS NULL OR site_environment_id = i_site_environment_id)
    ORDER BY site_id, site_environment_id, role_name;
END;
$$ LANGUAGE plpgsql;
END
