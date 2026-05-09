BEGIN
-- Stored procedure: Delete (hard delete) a site credential binding by id
-- Returns: TABLE with o_deleted_id to confirm deletion

CREATE OR REPLACE FUNCTION sp_site_credentials_delete(
    i_id INTEGER
)
RETURNS TABLE(
    o_deleted_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM site_credentials
    WHERE id = i_id
    RETURNING id INTO o_deleted_id;

    RETURN NEXT;
END;
$$;
END;
