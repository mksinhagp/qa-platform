BEGIN
-- Stored procedure: Bind an email inbox to a site environment with a role tag

CREATE OR REPLACE FUNCTION sp_site_env_email_bindings_insert(
    i_site_id INTEGER,
    i_site_environment_id INTEGER,
    i_email_inbox_id INTEGER,
    i_role_tag VARCHAR(100),
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_email_inbox_id INTEGER,
    o_role_tag VARCHAR(100),
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO site_env_email_bindings (
        site_id,
        site_environment_id,
        email_inbox_id,
        role_tag,
        description,
        created_by,
        updated_by
    ) VALUES (
        i_site_id,
        i_site_environment_id,
        i_email_inbox_id,
        i_role_tag,
        i_description,
        i_created_by,
        i_created_by
    )
    RETURNING
        id,
        site_id,
        site_environment_id,
        email_inbox_id,
        role_tag,
        created_date
    INTO
        o_id,
        o_site_id,
        o_site_environment_id,
        o_email_inbox_id,
        o_role_tag,
        o_created_date;

    RETURN NEXT;
END;
$$;
END;
