BEGIN
-- Stored procedure: List site credentials enriched with secret name and env name
-- Used by the site detail Credentials tab

CREATE OR REPLACE FUNCTION sp_site_credentials_list_enriched(
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_site_env_name VARCHAR(100),
    o_secret_id INTEGER,
    o_secret_name VARCHAR(255),
    o_role_name VARCHAR(100),
    o_description TEXT,
    o_is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.site_id,
        sc.site_environment_id,
        se.name AS site_env_name,
        sc.secret_id,
        sr.name AS secret_name,
        sc.role_name,
        sc.description,
        sc.is_active
    FROM site_credentials sc
    JOIN site_environments se ON se.id = sc.site_environment_id
    JOIN secret_records sr ON sr.id = sc.secret_id
    WHERE
        (i_site_id IS NULL OR sc.site_id = i_site_id)
        AND (i_site_environment_id IS NULL OR sc.site_environment_id = i_site_environment_id)
    ORDER BY se.name, sc.role_name;
END;
$$;
END;
