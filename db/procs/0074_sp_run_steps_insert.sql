BEGIN
-- Stored procedure: Insert a run step record
-- Returns: TABLE with new step id

CREATE OR REPLACE FUNCTION sp_run_steps_insert(
    i_run_execution_id INTEGER,
    i_step_name VARCHAR(255),
    i_step_order INTEGER,
    i_step_type VARCHAR(50),
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO run_steps (run_execution_id, step_name, step_order, step_type, status, created_by, updated_by)
    VALUES (i_run_execution_id, i_step_name, i_step_order, i_step_type, 'pending', i_created_by, i_created_by)
    RETURNING id, status;
END;
$$;
END;
