BEGIN
-- Stored procedure: Query audit logs with optional filters
-- Returns: TABLE with all audit log columns

CREATE OR REPLACE FUNCTION sp_audit_logs_query(
    i_actor_type VARCHAR(50) DEFAULT NULL,
    i_actor_id VARCHAR(255) DEFAULT NULL,
    i_action VARCHAR(100) DEFAULT NULL,
    i_target_type VARCHAR(100) DEFAULT NULL,
    i_target_id VARCHAR(255) DEFAULT NULL,
    i_status VARCHAR(50) DEFAULT NULL,
    i_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_limit INTEGER DEFAULT 100
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
    RETURN QUERY
    SELECT
        al.id,
        al.actor_type,
        al.actor_id,
        al.action,
        al.target_type,
        al.target_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.status,
        al.error_message,
        al.created_date
    FROM audit_logs al
    WHERE
        (i_actor_type IS NULL OR al.actor_type = i_actor_type)
        AND (i_actor_id IS NULL OR al.actor_id = i_actor_id)
        AND (i_action IS NULL OR al.action = i_action)
        AND (i_target_type IS NULL OR al.target_type = i_target_type)
        AND (i_target_id IS NULL OR al.target_id = i_target_id)
        AND (i_status IS NULL OR al.status = i_status)
        AND (i_start_date IS NULL OR al.created_date >= i_start_date)
        AND (i_end_date IS NULL OR al.created_date <= i_end_date)
    ORDER BY al.created_date DESC
    LIMIT i_limit;
END;
$$;
END;
