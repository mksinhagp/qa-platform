BEGIN
-- Stored procedure: Update run status and optional timing fields
-- Returns: TABLE with updated id and status

CREATE OR REPLACE FUNCTION sp_runs_update_status(
    i_id INTEGER,
    i_status VARCHAR(50),
    i_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
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
    UPDATE runs
    SET
        status = i_status,
        started_at = COALESCE(i_started_at, started_at),
        completed_at = COALESCE(i_completed_at, completed_at),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING id, status;
END;
$$;
END;
