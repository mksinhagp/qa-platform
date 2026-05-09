BEGIN
-- Stored procedure: Delete an email inbox binding by id

CREATE OR REPLACE FUNCTION sp_site_env_email_bindings_delete(
    i_id INTEGER
)
RETURNS TABLE(
    o_deleted_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM site_env_email_bindings
    WHERE id = i_id
    RETURNING id INTO o_deleted_id;

    RETURN NEXT;
END;
$$;
END;
