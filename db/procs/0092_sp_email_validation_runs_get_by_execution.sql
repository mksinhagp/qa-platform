-- Stored Procedure: sp_email_validation_runs_get_by_execution
-- Purpose: Retrieve all email validation runs for a given run execution (for dashboard display)
-- Parameters:
--   i_run_execution_id: run_executions.id
-- Returns: full email_validation_runs row + inbox name

CREATE OR REPLACE FUNCTION sp_email_validation_runs_get_by_execution(
    i_run_execution_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_inbox_id INTEGER,
    o_inbox_name VARCHAR(255),
    o_correlation_token VARCHAR(255),
    o_expected_subject_pattern VARCHAR(500),
    o_expected_from_pattern VARCHAR(255),
    o_status VARCHAR(50),
    o_wait_until TIMESTAMP WITH TIME ZONE,
    o_received_at TIMESTAMP WITH TIME ZONE,
    o_delivery_latency_ms INTEGER,
    o_poll_count INTEGER,
    o_error_message TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        evr.id AS o_id,
        evr.run_execution_id AS o_run_execution_id,
        evr.inbox_id AS o_inbox_id,
        ei.name AS o_inbox_name,
        evr.correlation_token AS o_correlation_token,
        evr.expected_subject_pattern AS o_expected_subject_pattern,
        evr.expected_from_pattern AS o_expected_from_pattern,
        evr.status AS o_status,
        evr.wait_until AS o_wait_until,
        evr.received_at AS o_received_at,
        evr.delivery_latency_ms AS o_delivery_latency_ms,
        evr.poll_count AS o_poll_count,
        evr.error_message AS o_error_message,
        evr.created_date AS o_created_date,
        evr.updated_date AS o_updated_date
    FROM email_validation_runs evr
    JOIN email_inboxes ei ON ei.id = evr.inbox_id
    WHERE evr.run_execution_id = i_run_execution_id
    ORDER BY evr.created_date ASC;
END;
$$;
