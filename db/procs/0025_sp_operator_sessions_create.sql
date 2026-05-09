BEGIN
-- Stored Procedure 0025: Create operator session
CREATE OR REPLACE FUNCTION sp_operator_sessions_create(
    i_operator_id INTEGER,
    i_session_token VARCHAR,
    i_ip_address INET DEFAULT NULL,
    i_user_agent TEXT DEFAULT NULL,
    i_idle_timeout_seconds INTEGER DEFAULT 28800,
    i_absolute_timeout_seconds INTEGER DEFAULT 2592000,
    i_created_by VARCHAR DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_session_token VARCHAR,
    o_expires_date TIMESTAMP WITH TIME ZONE,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_expires_date TIMESTAMP WITH TIME ZONE;
BEGIN
    v_expires_date := CURRENT_TIMESTAMP + (i_absolute_timeout_seconds * INTERVAL '1 second');

    RETURN QUERY
    INSERT INTO operator_sessions (
        operator_id, session_token, ip_address, user_agent,
        expires_date, created_by, updated_by
    )
    VALUES (
        i_operator_id, i_session_token, i_ip_address, i_user_agent,
        v_expires_date, i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        session_token AS o_session_token,
        expires_date AS o_expires_date,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
