BEGIN
-- Stored Procedure 0201: List campaign executions
-- Returns executions for a given campaign with pagination, ordered by most recent first
CREATE OR REPLACE FUNCTION sp_campaign_executions_list(
    i_campaign_id INTEGER,
    i_limit INTEGER DEFAULT 50,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_campaign_id INTEGER,
    o_run_id INTEGER,
    o_execution_type VARCHAR(50),
    o_triggered_by VARCHAR(255),
    o_status VARCHAR(50),
    o_total_scenarios INTEGER,
    o_executed_scenarios INTEGER,
    o_successful_scenarios INTEGER,
    o_failed_scenarios INTEGER,
    o_skipped_scenarios INTEGER,
    o_started_at TIMESTAMP WITH TIME ZONE,
    o_completed_at TIMESTAMP WITH TIME ZONE,
    o_duration_seconds INTEGER,
    o_error_message TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        campaign_id AS o_campaign_id,
        run_id AS o_run_id,
        execution_type AS o_execution_type,
        triggered_by AS o_triggered_by,
        status AS o_status,
        total_scenarios AS o_total_scenarios,
        executed_scenarios AS o_executed_scenarios,
        successful_scenarios AS o_successful_scenarios,
        failed_scenarios AS o_failed_scenarios,
        skipped_scenarios AS o_skipped_scenarios,
        started_at AS o_started_at,
        completed_at AS o_completed_at,
        duration_seconds AS o_duration_seconds,
        error_message AS o_error_message,
        created_date AS o_created_date
    FROM campaign_executions
    WHERE
        campaign_id = i_campaign_id
    ORDER BY created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
