-- Stored Procedure: sp_admin_test_suites_list_by_execution
-- Purpose: List all admin test suites for a given run execution
-- Parameters:
--   i_run_execution_id: run_executions.id
-- Returns: all admin test suite columns ordered by suite_type

CREATE OR REPLACE FUNCTION sp_admin_test_suites_list_by_execution(
    i_run_execution_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_suite_type VARCHAR(50),
    o_status VARCHAR(50),
    o_total_assertions INTEGER,
    o_passed_assertions INTEGER,
    o_failed_assertions INTEGER,
    o_skipped_assertions INTEGER,
    o_started_at TIMESTAMP WITH TIME ZONE,
    o_completed_at TIMESTAMP WITH TIME ZONE,
    o_duration_ms INTEGER,
    o_error_message TEXT,
    o_metadata JSONB,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.run_execution_id,
        s.suite_type,
        s.status,
        s.total_assertions,
        s.passed_assertions,
        s.failed_assertions,
        s.skipped_assertions,
        s.started_at,
        s.completed_at,
        s.duration_ms,
        s.error_message,
        s.metadata,
        s.created_date,
        s.updated_date
    FROM admin_test_suites s
    WHERE s.run_execution_id = i_run_execution_id
    ORDER BY s.suite_type ASC;
END;
$$;
