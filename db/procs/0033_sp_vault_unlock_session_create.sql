BEGIN
-- Stored Procedure 0033: Create vault unlock session
CREATE OR REPLACE FUNCTION sp_vault_unlock_session_create(
    i_operator_session_id INTEGER,
    i_unlock_token VARCHAR,
    i_ttl_minutes INTEGER DEFAULT 30,
    i_created_by VARCHAR DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_unlock_token VARCHAR,
    o_expires_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_expires_date TIMESTAMP WITH TIME ZONE;
BEGIN
    v_expires_date := CURRENT_TIMESTAMP + (i_ttl_minutes * INTERVAL '1 minute');
    
    INSERT INTO vault_unlock_sessions (
        operator_session_id, unlock_token, expires_date, created_by, updated_by
    )
    VALUES (i_operator_session_id, i_unlock_token, v_expires_date, i_created_by, i_created_by)
    RETURNING
        id AS o_id,
        unlock_token AS o_unlock_token,
        expires_date AS o_expires_date;
END;
$$ LANGUAGE plpgsql;
END
