BEGIN
-- Stored procedure: List email inbox bindings for a site or environment
-- Joins to email_inboxes to return display metadata

CREATE OR REPLACE FUNCTION sp_site_env_email_bindings_list(
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_site_env_name VARCHAR(100),
    o_email_inbox_id INTEGER,
    o_email_inbox_name VARCHAR(255),
    o_provider VARCHAR(100),
    o_username VARCHAR(255),
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
        b.email_inbox_id,
        ei.name AS email_inbox_name,
        ei.provider,
        ei.username,
        b.role_tag,
        b.description,
        b.is_active
    FROM site_env_email_bindings b
    JOIN site_environments se ON se.id = b.site_environment_id
    JOIN email_inboxes ei ON ei.id = b.email_inbox_id
    WHERE
        (i_site_id IS NULL OR b.site_id = i_site_id)
        AND (i_site_environment_id IS NULL OR b.site_environment_id = i_site_environment_id)
    ORDER BY se.name, b.role_tag;
END;
$$;
END;
