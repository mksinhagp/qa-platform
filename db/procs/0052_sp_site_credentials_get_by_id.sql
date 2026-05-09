BEGIN
-- Stored Procedure 0052: Get site credential by ID
CREATE OR REPLACE FUNCTION sp_site_credentials_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_role_name VARCHAR,
    o_secret_id INTEGER,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id AS o_id,
        sc.site_id AS o_site_id,
        sc.site_environment_id AS o_site_environment_id,
        sc.role_name AS o_role_name,
        sc.secret_id AS o_secret_id,
        sc.is_active AS o_is_active,
        sc.created_date AS o_created_date,
        sc.updated_date AS o_updated_date
    FROM site_credentials sc
    WHERE sc.id = i_id;
END;
$$ LANGUAGE plpgsql;
END
