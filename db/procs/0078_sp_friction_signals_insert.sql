BEGIN
-- Stored procedure: Insert a friction signal for a run execution
-- Returns: TABLE with new signal id

CREATE OR REPLACE FUNCTION sp_friction_signals_insert(
    i_run_execution_id INTEGER,
    i_signal_type VARCHAR(100),
    i_step_name VARCHAR(255) DEFAULT NULL,
    i_element_selector TEXT DEFAULT NULL,
    i_metadata JSONB DEFAULT NULL,
    i_occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO friction_signals (run_execution_id, signal_type, step_name, element_selector, metadata, occurred_at, created_by)
    VALUES (
        i_run_execution_id, i_signal_type, i_step_name, i_element_selector, i_metadata,
        COALESCE(i_occurred_at, CURRENT_TIMESTAMP), i_created_by
    )
    RETURNING id;
END;
$$;
END;
