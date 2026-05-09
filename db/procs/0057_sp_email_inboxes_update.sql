BEGIN
-- Stored Procedure 0057: Update email inbox
CREATE OR REPLACE FUNCTION sp_email_inboxes_update(
    i_id INTEGER,
    i_name VARCHAR DEFAULT NULL,
    i_host VARCHAR DEFAULT NULL,
    i_port INTEGER DEFAULT NULL,
    i_use_tls BOOLEAN DEFAULT NULL,
    i_username VARCHAR DEFAULT NULL,
    i_description TEXT DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_provider VARCHAR,
    o_host VARCHAR,
    o_port INTEGER,
    o_is_active BOOLEAN,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    UPDATE email_inboxes
    SET
        name = COALESCE(i_name, name),
        host = COALESCE(i_host, host),
        port = COALESCE(i_port, port),
        use_tls = COALESCE(i_use_tls, use_tls),
        username = COALESCE(i_username, username),
        description = COALESCE(i_description, description),
        is_active = COALESCE(i_is_active, is_active),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING
        id AS o_id,
        name AS o_name,
        provider AS o_provider,
        host AS o_host,
        port AS o_port,
        is_active AS o_is_active,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
