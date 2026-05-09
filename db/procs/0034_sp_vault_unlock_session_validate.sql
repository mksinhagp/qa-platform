BEGIN
-- Stored Procedure 0034: Validate vault unlock session
CREATE OR REPLACE FUNCTION sp_vault_unlock_session_validate(
    i_unlock_token VARCHAR,
    i_idle_reset_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
    o_is_valid BOOLEAN,
    o_unlock_session_id INTEGER,
    o_operator_session_id INTEGER
) AS $$
DECLARE
    v_session RECORD;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_session
    FROM vault_unlock_sessions
    WHERE unlock_token = i_unlock_token AND is_active = TRUE;
    
    IF FOUND THEN
        -- Check expiry
        IF v_session.expires_date > CURRENT_TIMESTAMP THEN
            -- Check idle timeout
            IF v_session.last_activity_date > (CURRENT_TIMESTAMP - (i_idle_reset_minutes * INTERVAL '1 minute')) THEN
                v_is_valid := TRUE;
                
                -- Reset idle timer
                UPDATE vault_unlock_sessions
                SET last_activity_date = CURRENT_TIMESTAMP
                WHERE id = v_session.id;
            END IF;
        END IF;
    END IF;
    
    RETURN QUERY
    SELECT
        v_is_valid AS o_is_valid,
        v_session.id AS o_unlock_session_id,
        v_session.operator_session_id AS o_operator_session_id;
END;
$$ LANGUAGE plpgsql;
END
