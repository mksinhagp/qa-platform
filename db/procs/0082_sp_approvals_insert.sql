BEGIN
-- Stored procedure: Insert a new approval request
-- Called when the runner hits an approval-gated step.
-- Returns: TABLE with the new approval id and timeout_at

CREATE OR REPLACE FUNCTION sp_approvals_insert(
    i_run_step_id       INTEGER,
    i_category          VARCHAR(100),
    i_target_type       VARCHAR(100) DEFAULT NULL,
    i_target_id         VARCHAR(255) DEFAULT NULL,
    i_payload_summary   TEXT         DEFAULT NULL,
    i_required_strength VARCHAR(50)  DEFAULT 'one_click',
    i_timeout_at        TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_created_by        VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id         INTEGER,
    o_timeout_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id         INTEGER;
    v_timeout_at TIMESTAMP WITH TIME ZONE;
BEGIN
    v_timeout_at := COALESCE(i_timeout_at, NOW() + INTERVAL '15 minutes');

    INSERT INTO approvals (
        run_step_id,
        category,
        target_type,
        target_id,
        payload_summary,
        required_strength,
        status,
        timeout_at,
        created_date,
        updated_date,
        created_by,
        updated_by
    ) VALUES (
        i_run_step_id,
        i_category,
        i_target_type,
        i_target_id,
        i_payload_summary,
        i_required_strength,
        'pending',
        v_timeout_at,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        i_created_by,
        i_created_by
    )
    RETURNING id INTO v_id;

    o_id         := v_id;
    o_timeout_at := v_timeout_at;
    RETURN NEXT;
END;
$$;
END;
