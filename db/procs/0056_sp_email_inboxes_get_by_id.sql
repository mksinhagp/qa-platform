BEGIN
-- Stored Procedure 0056: Get email inbox by ID
CREATE OR REPLACE FUNCTION sp_email_inboxes_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_provider VARCHAR,
    o_host VARCHAR,
    o_port INTEGER,
    o_use_tls BOOLEAN,
    o_username VARCHAR,
    o_secret_id INTEGER,
    o_description TEXT,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ei.id AS o_id,
        ei.name AS o_name,
        ei.provider AS o_provider,
        ei.host AS o_host,
        ei.port AS o_port,
        ei.use_tls AS o_use_tls,
        ei.username AS o_username,
        ei.secret_id AS o_secret_id,
        ei.description AS o_description,
        ei.is_active AS o_is_active,
        ei.created_date AS o_created_date,
        ei.updated_date AS o_updated_date
    FROM email_inboxes ei
    WHERE ei.id = i_id;
END;
$$ LANGUAGE plpgsql;
END
