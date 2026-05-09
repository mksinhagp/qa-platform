BEGIN
-- Stored Procedure 0047: List email inboxes
CREATE OR REPLACE FUNCTION sp_email_inboxes_list(
    i_provider VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_provider VARCHAR,
    o_host VARCHAR,
    o_port INTEGER,
    o_username VARCHAR,
    o_description TEXT,
    o_is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        provider AS o_provider,
        host AS o_host,
        port AS o_port,
        username AS o_username,
        description AS o_description,
        is_active AS o_is_active
    FROM email_inboxes
    WHERE (i_provider IS NULL OR provider = i_provider)
    ORDER BY name;
END;
$$ LANGUAGE plpgsql;
END
