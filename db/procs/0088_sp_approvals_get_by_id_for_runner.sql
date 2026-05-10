BEGIN
-- Stored procedure: Get a single approval record by id for runner polling.
-- Validates the runner callback token against the parent run_execution.
-- Returns: TABLE with approval decision fields needed by the poll endpoint.

CREATE OR REPLACE FUNCTION sp_approvals_get_by_id_for_runner(
    i_id             INTEGER,
    i_callback_token VARCHAR(255)
)
RETURNS TABLE(
    o_id         INTEGER,
    o_status     VARCHAR(50),
    o_reason     TEXT,
    o_timeout_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.status,
        a.reason,
        a.timeout_at
    FROM approvals a
    JOIN run_steps      rs ON rs.id = a.run_step_id
    JOIN run_executions re ON re.id = rs.run_execution_id
    WHERE a.id = i_id
      AND re.callback_token = i_callback_token;
END;
$$;
END;
