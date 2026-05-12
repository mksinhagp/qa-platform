BEGIN
-- Stored Procedure 0200: Update campaign execution status
CREATE OR REPLACE FUNCTION sp_campaign_executions_update_status(
    i_id INTEGER,
    i_status VARCHAR,
    i_total_scenarios INTEGER DEFAULT NULL,
    i_executed_scenarios INTEGER DEFAULT NULL,
    i_successful_scenarios INTEGER DEFAULT NULL,
    i_failed_scenarios INTEGER DEFAULT NULL,
    i_skipped_scenarios INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_status VARCHAR,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    UPDATE campaign_executions
    SET
        status = i_status,
        total_scenarios = COALESCE(i_total_scenarios, total_scenarios),
        executed_scenarios = COALESCE(i_executed_scenarios, executed_scenarios),
        successful_scenarios = COALESCE(i_successful_scenarios, successful_scenarios),
        failed_scenarios = COALESCE(i_failed_scenarios, failed_scenarios),
        skipped_scenarios = COALESCE(i_skipped_scenarios, skipped_scenarios),
        error_message = COALESCE(i_error_message, error_message),
        started_at = CASE WHEN i_status = 'running' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
        completed_at = CASE WHEN i_status IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        duration_seconds = CASE WHEN i_status IN ('completed', 'failed', 'cancelled') AND started_at IS NOT NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::INTEGER ELSE duration_seconds END,
        updated_by = i_updated_by,
        updated_date = CURRENT_TIMESTAMP
    WHERE id = i_id
    RETURNING
        id AS o_id,
        status AS o_status,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
