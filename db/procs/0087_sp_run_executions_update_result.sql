BEGIN
-- Stored procedure: Record the final result of a run execution.
-- Called by the runner callback (POST /api/runner/callback type=execution_result).
-- Validates callback_token before writing to prevent unauthorised updates.
-- Upserts step records and friction signals from the JSON arrays.
-- Returns: TABLE with updated execution id and status.

CREATE OR REPLACE FUNCTION sp_run_executions_update_result(
    i_id               INTEGER,
    i_callback_token   VARCHAR(255),
    i_status           VARCHAR(50),
    i_friction_score   DECIMAL(5,2)             DEFAULT NULL,
    i_error_message    TEXT                     DEFAULT NULL,
    i_started_at       TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_completed_at     TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_steps            JSONB                    DEFAULT NULL,
    i_friction_signals JSONB                    DEFAULT NULL,
    i_updated_by       VARCHAR(255)             DEFAULT 'system',
    i_correlation_id   VARCHAR(255)             DEFAULT NULL
)
RETURNS TABLE(
    o_id     INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_token_match  BOOLEAN;
    v_step         JSONB;
    v_signal       JSONB;
BEGIN
    -- Validate callback token
    SELECT (callback_token = i_callback_token)
    INTO   v_token_match
    FROM   run_executions
    WHERE  id = i_id;

    IF v_token_match IS NULL THEN
        RAISE EXCEPTION 'run_execution % not found', i_id;
    END IF;

    IF NOT v_token_match THEN
        RAISE EXCEPTION 'Invalid callback token for run_execution %', i_id;
    END IF;

    -- Update execution record
    UPDATE run_executions
    SET
        status         = i_status,
        friction_score = COALESCE(i_friction_score, friction_score),
        error_message  = COALESCE(i_error_message,  error_message),
        started_at     = COALESCE(i_started_at,     started_at),
        completed_at   = COALESCE(i_completed_at,   completed_at),
        updated_date   = CURRENT_TIMESTAMP,
        updated_by     = i_updated_by
    WHERE id = i_id;

    -- Upsert step records. If a row already exists for this step (e.g. an approval
    -- step pre-inserted by sp_run_steps_insert), update it to the final status
    -- so that approval steps do not remain stuck at 'awaiting_approval' forever.
    IF i_steps IS NOT NULL THEN
        FOR v_step IN SELECT * FROM jsonb_array_elements(i_steps)
        LOOP
            INSERT INTO run_steps (
                run_execution_id,
                step_name,
                step_order,
                step_type,
                status,
                error_message,
                created_date,
                updated_date,
                created_by,
                updated_by
            )
            VALUES (
                i_id,
                v_step->>'step_name',
                (v_step->>'step_order')::INTEGER,
                'action',
                v_step->>'status',
                v_step->>'error_message',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                i_updated_by,
                i_updated_by
            )
            ON CONFLICT (run_execution_id, step_name) DO UPDATE
                SET status        = EXCLUDED.status,
                    error_message = EXCLUDED.error_message,
                    updated_date  = CURRENT_TIMESTAMP,
                    updated_by    = i_updated_by;
        END LOOP;
    END IF;

    -- Insert friction signals
    IF i_friction_signals IS NOT NULL THEN
        FOR v_signal IN SELECT * FROM jsonb_array_elements(i_friction_signals)
        LOOP
            INSERT INTO friction_signals (
                run_execution_id,
                signal_type,
                step_name,
                element_selector,
                metadata,
                occurred_at,
                created_date,
                created_by
            )
            VALUES (
                i_id,
                v_signal->>'signal_type',
                v_signal->>'step_name',
                v_signal->>'element_selector',
                (v_signal->'metadata')::JSONB,
                COALESCE(
                    (v_signal->>'occurred_at')::TIMESTAMP WITH TIME ZONE,
                    CURRENT_TIMESTAMP
                ),
                CURRENT_TIMESTAMP,
                i_updated_by
            );
        END LOOP;
    END IF;

    o_id     := i_id;
    o_status := i_status;
    RETURN NEXT;
END;
$$;
END;
