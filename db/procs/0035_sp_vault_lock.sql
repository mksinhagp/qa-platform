BEGIN
-- Stored Procedure 0035: Lock vault (invalidate unlock session)
CREATE OR REPLACE FUNCTION sp_vault_lock(
    i_unlock_token VARCHAR,
    i_updated_by VARCHAR
)
RETURNS TABLE (
    o_success BOOLEAN
) AS $$
BEGIN
    UPDATE vault_unlock_sessions
    SET is_active = FALSE, updated_by = i_updated_by, updated_date = CURRENT_TIMESTAMP
    WHERE unlock_token = i_unlock_token;
    
    RETURN QUERY SELECT FOUND AS o_success;
END;
$$ LANGUAGE plpgsql;
END
