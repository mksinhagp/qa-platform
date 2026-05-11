-- Stored Procedure: sp_email_inboxes_list
-- Purpose: List all email inboxes (for email validation binding)
-- Parameters:
--   i_is_active: optional filter by active status (null = all)
-- Returns: email inbox rows (no secret payload — metadata only)

CREATE OR REPLACE FUNCTION sp_email_inboxes_list(
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR(255),
    o_provider VARCHAR(100),
    o_host VARCHAR(255),
    o_port INTEGER,
    o_use_tls BOOLEAN,
    o_username VARCHAR(255),
    o_secret_id INTEGER,
    o_description TEXT,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE,
    o_created_by VARCHAR(255),
    o_updated_by VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
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
        ei.updated_date AS o_updated_date,
        ei.created_by AS o_created_by,
        ei.updated_by AS o_updated_by
    FROM email_inboxes ei
    WHERE (i_is_active IS NULL OR ei.is_active = i_is_active)
    ORDER BY ei.name ASC;
END;
$$;
