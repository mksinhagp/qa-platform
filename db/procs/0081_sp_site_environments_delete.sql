BEGIN
-- Stored procedure: Soft-delete a site environment by setting is_active = false
-- Uses soft-delete because environments may have active child bindings
-- (credentials, payment profiles, email inboxes) that reference them.
-- Returns: TABLE with the deactivated environment id to confirm the operation

CREATE OR REPLACE FUNCTION sp_site_environments_delete(
    i_id INTEGER,
    i_updated_by VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE(
    o_deleted_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE site_environments
    SET
        is_active = FALSE,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING id INTO o_deleted_id;

    RETURN NEXT;
END;
$$;
END;
