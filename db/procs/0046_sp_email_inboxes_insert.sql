BEGIN
-- Stored Procedure 0046: Insert email inbox
CREATE OR REPLACE FUNCTION sp_email_inboxes_insert(
    i_name VARCHAR,
    i_provider VARCHAR,
    i_host VARCHAR,
    i_port INTEGER,
    i_use_tls BOOLEAN DEFAULT TRUE,
    i_username VARCHAR,
    i_secret_id INTEGER,
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_provider VARCHAR,
    o_host VARCHAR,
    o_port INTEGER,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO email_inboxes (
        name, provider, host, port, use_tls,
        username, secret_id, description,
        created_by, updated_by
    )
    VALUES (
        i_name, i_provider, i_host, i_port, i_use_tls,
        i_username, i_secret_id, i_description,
        i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        name AS o_name,
        provider AS o_provider,
        host AS o_host,
        port AS o_port,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
