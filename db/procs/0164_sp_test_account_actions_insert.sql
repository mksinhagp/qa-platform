-- Stored Procedure: sp_test_account_actions_insert
-- Purpose: Insert a lifecycle action for a test account
CREATE OR REPLACE FUNCTION sp_test_account_actions_insert(
    i_test_account_id INTEGER,
    i_action_type VARCHAR(50),
    i_action_status VARCHAR(50) DEFAULT 'pending',
    i_run_execution_id INTEGER DEFAULT NULL,
    i_step_name VARCHAR(255) DEFAULT NULL,
    i_duration_ms INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_details JSONB DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_action_type VARCHAR(50),
    o_action_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO test_account_actions (
        test_account_id, run_execution_id, action_type, action_status,
        step_name, duration_ms, error_message, details, created_by, updated_by
    ) VALUES (
        i_test_account_id, i_run_execution_id, i_action_type, i_action_status,
        i_step_name, i_duration_ms, i_error_message, i_details, i_created_by, i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_action_type, i_action_status;
END;
$$;
