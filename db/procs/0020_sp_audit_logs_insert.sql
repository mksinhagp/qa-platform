BEGIN
-- Stored procedure: Insert an audit log entry
-- Returns: TABLE with the inserted audit log id and all columns

CREATE OR REPLACE FUNCTION sp_audit_logs_insert(
    i_actor_type VARCHAR(50),
    i_actor_id VARCHAR(255) DEFAULT NULL,
    i_action VARCHAR(100),
    i_target_type VARCHAR(100) DEFAULT NULL,
    i_target_id VARCHAR(255) DEFAULT NULL,
    i_details TEXT DEFAULT NULL,
    i_ip_address INET DEFAULT NULL,
    i_user_agent TEXT DEFAULT NULL,
    i_status VARCHAR(50) DEFAULT 'success',
    i_error_message TEXT DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_actor_type VARCHAR(50),
    o_actor_id VARCHAR(255),
    o_action VARCHAR(100),
    o_target_type VARCHAR(100),
    o_target_id VARCHAR(255),
    o_details TEXT,
    o_ip_address INET,
    o_user_agent TEXT,
    o_status VARCHAR(50),
    o_error_message TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO audit_logs (
        actor_type,
        actor_id,
        action,
        target_type,
        target_id,
        details,
        ip_address,
        user_agent,
        status,
        error_message
    ) VALUES (
        i_actor_type,
        i_actor_id,
        i_action,
        i_target_type,
        i_target_id,
        i_details,
        i_ip_address,
        i_user_agent,
        i_status,
        i_error_message
    )
    RETURNING
        id,
        actor_type,
        actor_id,
        action,
        target_type,
        target_id,
        details,
        ip_address,
        user_agent,
        status,
        error_message,
        created_date
    INTO
        o_id,
        o_actor_type,
        o_actor_id,
        o_action,
        o_target_type,
        o_target_id,
        o_details,
        o_ip_address,
        o_user_agent,
        o_status,
        o_error_message,
        o_created_date;

    RETURN NEXT;
END;
$$;
END;
