-- Stored Procedure: sp_test_account_actions_list
-- Purpose: List lifecycle actions for a test account
CREATE OR REPLACE FUNCTION sp_test_account_actions_list(
    i_test_account_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_test_account_id INTEGER,
    o_run_execution_id INTEGER,
    o_action_type VARCHAR(50),
    o_action_status VARCHAR(50),
    o_step_name VARCHAR(255),
    o_duration_ms INTEGER,
    o_error_message TEXT,
    o_details JSONB,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        taa.id, taa.test_account_id, taa.run_execution_id,
        taa.action_type, taa.action_status, taa.step_name,
        taa.duration_ms, taa.error_message, taa.details,
        taa.created_date
    FROM test_account_actions taa
    WHERE taa.test_account_id = i_test_account_id
    ORDER BY taa.created_date ASC;
END;
$$;
