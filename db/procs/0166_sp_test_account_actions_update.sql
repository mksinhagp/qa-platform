-- Stored Procedure: sp_test_account_actions_update
-- Purpose: Update status of a lifecycle action (e.g., mark completed/failed)
CREATE OR REPLACE FUNCTION sp_test_account_actions_update(
    i_id INTEGER,
    i_action_status VARCHAR(50),
    i_duration_ms INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_details JSONB DEFAULT NULL,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_action_type VARCHAR(50),
    o_action_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE test_account_actions
    SET
        action_status = i_action_status,
        duration_ms = COALESCE(i_duration_ms, duration_ms),
        error_message = COALESCE(i_error_message, error_message),
        details = COALESCE(i_details, details),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id;

    RETURN QUERY
    SELECT taa.id, taa.action_type, taa.action_status
    FROM test_account_actions taa
    WHERE taa.id = i_id;
END;
$$;
