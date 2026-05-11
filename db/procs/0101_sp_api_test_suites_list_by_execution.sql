-- Stored Procedure: sp_api_test_suites_list_by_execution
-- Purpose: Retrieve all API test suites for a given run execution (for dashboard display)
-- Parameters:
--   i_run_execution_id: run_executions.id
-- Returns: full api_test_suites rows ordered by suite_type

CREATE OR REPLACE FUNCTION sp_api_test_suites_list_by_execution(
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
        ats.id,
        ats.run_execution_id,
        ats.suite_type,
        ats.status,
        ats.total_assertions,
        ats.passed_assertions,
        ats.failed_assertions,
        ats.skipped_assertions,
        ats.started_at,
        ats.completed_at,
        ats.duration_ms,
        ats.error_message,
        ats.metadata,
        ats.created_date,
        ats.updated_date
    FROM api_test_suites ats
    WHERE ats.run_execution_id = i_run_execution_id
    ORDER BY
        CASE ats.suite_type
            WHEN 'reachability' THEN 1
            WHEN 'schema' THEN 2
            WHEN 'business_rules' THEN 3
            WHEN 'cross_validation' THEN 4
            ELSE 5
        END;
END;
$$;
