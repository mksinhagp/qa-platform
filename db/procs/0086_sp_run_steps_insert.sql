BEGIN
-- Stored procedure: Insert a new run step record.
-- Called by the runner callback when an approval-gated step is encountered.
-- Validates the callback token against the parent run_execution before inserting.
-- Returns: TABLE with the new step id.

CREATE OR REPLACE FUNCTION sp_run_steps_insert(
    i_run_execution_id INTEGER,
    i_callback_token   VARCHAR(255),
    i_step_name        VARCHAR(255),
    i_step_order       INTEGER,
    i_step_type        VARCHAR(50),  -- 'navigation', 'action', 'assertion', 'approval', 'cleanup'
    i_run_id           INTEGER      DEFAULT NULL,
    i_updated_by       VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id          INTEGER;
    v_token_match BOOLEAN;
BEGIN
    -- Validate callback token
    SELECT (callback_token = i_callback_token)
    INTO   v_token_match
    FROM   run_executions
    WHERE  id = i_run_execution_id;

    IF v_token_match IS NULL THEN
        RAISE EXCEPTION 'run_execution % not found', i_run_execution_id;
    END IF;

    IF NOT v_token_match THEN
        RAISE EXCEPTION 'Invalid callback token for run_execution %', i_run_execution_id;
    END IF;

    INSERT INTO run_steps (
        run_execution_id,
        step_name,
        step_order,
        step_type,
        status,
        created_date,
        updated_date,
        created_by,
        updated_by
    ) VALUES (
        i_run_execution_id,
        i_step_name,
        i_step_order,
        i_step_type,
        'awaiting_approval',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        i_updated_by,
        i_updated_by
    )
    RETURNING id INTO v_id;

    o_id := v_id;
    RETURN NEXT;
END;
$$;
END;
