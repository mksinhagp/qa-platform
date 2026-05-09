BEGIN
-- Stored Procedure 0027: Revoke operator session
CREATE OR REPLACE FUNCTION sp_operator_sessions_revoke(
    i_session_token VARCHAR,
    i_updated_by VARCHAR
)
RETURNS TABLE (
    o_success BOOLEAN
) AS $$
BEGIN
    UPDATE operator_sessions
    SET is_active = FALSE, updated_by = i_updated_by, updated_date = CURRENT_TIMESTAMP
    WHERE session_token = i_session_token;
    
    RETURN QUERY SELECT FOUND AS o_success;
END;
$$ LANGUAGE plpgsql;
END
