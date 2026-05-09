BEGIN
-- Stored procedure: List friction signals for a run execution
-- Returns: TABLE with all friction signal columns

CREATE OR REPLACE FUNCTION sp_friction_signals_list(
    i_run_execution_id INTEGER,
    i_signal_type VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_signal_type VARCHAR(100),
    o_step_name VARCHAR(255),
    o_element_selector TEXT,
    o_metadata JSONB,
    o_occurred_at TIMESTAMP WITH TIME ZONE,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fs.id,
        fs.run_execution_id,
        fs.signal_type,
        fs.step_name,
        fs.element_selector,
        fs.metadata,
        fs.occurred_at,
        fs.created_date
    FROM friction_signals fs
    WHERE
        fs.run_execution_id = i_run_execution_id
        AND (i_signal_type IS NULL OR fs.signal_type = i_signal_type)
    ORDER BY fs.occurred_at ASC;
END;
$$;
END;
