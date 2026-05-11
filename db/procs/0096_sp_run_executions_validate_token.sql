BEGIN
-- Stored procedure: Validate a runner callback token for a run execution

CREATE OR REPLACE FUNCTION sp_run_executions_validate_token(
    i_id INTEGER,
    i_callback_token VARCHAR(255)
)
RETURNS TABLE(
    o_is_valid BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT EXISTS (
        SELECT 1
        FROM run_executions re
        WHERE re.id = i_id
          AND re.callback_token = i_callback_token
    );
END;
$$;
END;
