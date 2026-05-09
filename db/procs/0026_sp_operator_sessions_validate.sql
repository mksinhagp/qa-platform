BEGIN
-- Stored Procedure 0026: Validate operator session
CREATE OR REPLACE FUNCTION sp_operator_sessions_validate(
    i_session_token VARCHAR,
    i_idle_timeout_hours INTEGER DEFAULT 8
)
RETURNS TABLE (
    o_is_valid BOOLEAN,
    o_operator_id INTEGER,
    o_session_id INTEGER,
    o_last_activity_date TIMESTAMP WITH TIME ZONE,
    o_expires_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_session RECORD;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_session
    FROM operator_sessions
    WHERE session_token = i_session_token AND is_active = TRUE;
    
    IF FOUND THEN
        -- Check absolute expiry
        IF v_session.expires_date > CURRENT_TIMESTAMP THEN
            -- Check idle timeout
            IF v_session.last_activity_date > (CURRENT_TIMESTAMP - (i_idle_timeout_hours * INTERVAL '1 hour')) THEN
                v_is_valid := TRUE;
                
                -- Update last activity
                UPDATE operator_sessions
                SET last_activity_date = CURRENT_TIMESTAMP
                WHERE id = v_session.id;
            END IF;
        END IF;
    END IF;
    
    RETURN QUERY
    SELECT
        v_is_valid AS o_is_valid,
        v_session.operator_id AS o_operator_id,
        v_session.id AS o_session_id,
        v_session.last_activity_date AS o_last_activity_date,
        v_session.expires_date AS o_expires_date;
END;
$$ LANGUAGE plpgsql;
END
