-- Stored Procedure: sp_api_test_suites_insert
-- Purpose: Create a new API test suite record for a given run execution
-- Parameters:
--   i_run_execution_id: run_executions.id
--   i_suite_type: 'reachability', 'schema', 'business_rules', 'cross_validation'
--   i_metadata: optional JSONB metadata (endpoints config, etc.)
--   i_created_by: operator login or 'system'
-- Returns: o_id, o_status

CREATE OR REPLACE FUNCTION sp_api_test_suites_insert(
    i_run_execution_id INTEGER,
    i_suite_type VARCHAR(50),
    i_metadata JSONB DEFAULT NULL,
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
BEGIN
    INSERT INTO api_test_suites (
        run_execution_id,
        suite_type,
        status,
        metadata,
        started_at,
        created_by,
        updated_by
    ) VALUES (
        i_run_execution_id,
        i_suite_type,
        'running',
        i_metadata,
        CURRENT_TIMESTAMP,
        i_created_by,
        i_created_by
    )
    ON CONFLICT (run_execution_id, suite_type)
    DO UPDATE SET
        status = 'running',
        metadata = COALESCE(EXCLUDED.metadata, api_test_suites.metadata),
        started_at = CURRENT_TIMESTAMP,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_created_by
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, 'running'::VARCHAR(50);
END;
$$;
