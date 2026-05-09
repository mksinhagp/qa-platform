BEGIN
-- Stored procedure: List payment profile bindings for a site or environment
-- Joins to payment_profiles to return display metadata

CREATE OR REPLACE FUNCTION sp_site_env_payment_bindings_list(
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_site_env_name VARCHAR(100),
    o_payment_profile_id INTEGER,
    o_payment_profile_name VARCHAR(255),
    o_payment_type VARCHAR(50),
    o_last_4 VARCHAR(4),
    o_role_tag VARCHAR(100),
    o_description TEXT,
    o_is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.site_id,
        b.site_environment_id,
        se.name AS site_env_name,
        b.payment_profile_id,
        pp.name AS payment_profile_name,
        pp.payment_type,
        pp.last_4,
        b.role_tag,
        b.description,
        b.is_active
    FROM site_env_payment_bindings b
    JOIN site_environments se ON se.id = b.site_environment_id
    JOIN payment_profiles pp ON pp.id = b.payment_profile_id
    WHERE
        (i_site_id IS NULL OR b.site_id = i_site_id)
        AND (i_site_environment_id IS NULL OR b.site_environment_id = i_site_environment_id)
    ORDER BY se.name, b.role_tag;
END;
$$;
END;
