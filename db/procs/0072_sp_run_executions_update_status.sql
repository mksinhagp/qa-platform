BEGIN
-- Stored procedure: Update run execution status, timing, friction score
-- Returns: TABLE with updated id and status

CREATE OR REPLACE FUNCTION sp_run_executions_update_status(
    i_id INTEGER,
    i_status VARCHAR(50),
    i_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_friction_score DECIMAL(5,2) DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE run_executions
    SET
        status = i_status,
        started_at = COALESCE(i_started_at, started_at),
        completed_at = COALESCE(i_completed_at, completed_at),
        friction_score = COALESCE(i_friction_score, friction_score),
        error_message = COALESCE(i_error_message, error_message),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING id, status;
END;
$$;
END;
