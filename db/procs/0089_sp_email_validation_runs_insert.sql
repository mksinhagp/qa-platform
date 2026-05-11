-- Stored Procedure: sp_email_validation_runs_insert
-- Purpose: Create a new email validation run record for a given run execution
-- Parameters:
--   i_run_execution_id: run_executions.id
--   i_inbox_id: email_inboxes.id
--   i_correlation_token: token embedded in test email address
--   i_expected_subject_pattern: expected subject regex/substring
--   i_expected_from_pattern: expected sender pattern
--   i_wait_until: timestamp deadline for delivery check
--   i_created_by: operator login or 'system'
-- Returns: id, status

CREATE OR REPLACE FUNCTION sp_email_validation_runs_insert(
    i_run_execution_id INTEGER,
    i_inbox_id INTEGER,
    i_correlation_token VARCHAR(255),
    i_expected_subject_pattern VARCHAR(500) DEFAULT NULL,
    i_expected_from_pattern VARCHAR(255) DEFAULT NULL,
    i_wait_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
    v_wait_until TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Default wait window: 5 minutes from now
    v_wait_until := COALESCE(i_wait_until, CURRENT_TIMESTAMP + INTERVAL '5 minutes');

    INSERT INTO email_validation_runs (
        run_execution_id,
        inbox_id,
        correlation_token,
        expected_subject_pattern,
        expected_from_pattern,
        status,
        wait_until,
        created_by,
        updated_by
    ) VALUES (
        i_run_execution_id,
        i_inbox_id,
        i_correlation_token,
        i_expected_subject_pattern,
        i_expected_from_pattern,
        'pending',
        v_wait_until,
        i_created_by,
        i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, 'pending'::VARCHAR(50);
END;
$$;
