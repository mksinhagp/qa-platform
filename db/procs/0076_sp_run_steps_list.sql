BEGIN
-- Stored procedure: List all steps for a run execution
-- Returns: TABLE with all step columns

CREATE OR REPLACE FUNCTION sp_run_steps_list(
    i_run_execution_id INTEGER
)
RETURNS TABLE(
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_step_name VARCHAR(255),
    o_step_order INTEGER,
    o_step_type VARCHAR(50),
    o_status VARCHAR(50),
    o_started_at TIMESTAMP WITH TIME ZONE,
    o_completed_at TIMESTAMP WITH TIME ZONE,
    o_error_message TEXT,
    o_approval_id INTEGER,
    o_details JSONB,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.id,
        rs.run_execution_id,
        rs.step_name,
        rs.step_order,
        rs.step_type,
        rs.status,
        rs.started_at,
        rs.completed_at,
        rs.error_message,
        rs.approval_id,
        rs.details,
        rs.created_date
    FROM run_steps rs
    WHERE rs.run_execution_id = i_run_execution_id
    ORDER BY rs.step_order ASC;
END;
$$;
END;
