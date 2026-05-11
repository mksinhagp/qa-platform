-- Stored Procedure: sp_api_test_assertions_insert_batch
-- Purpose: Insert multiple API test assertion results in one call (JSON array input)
-- Parameters:
--   i_api_test_suite_id: api_test_suites.id
--   i_assertions: JSON array of assertion objects
--   i_created_by: operator login or 'system'
-- Returns: number of rows inserted

CREATE OR REPLACE FUNCTION sp_api_test_assertions_insert_batch(
    i_api_test_suite_id INTEGER,
    i_assertions JSONB,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_inserted_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO api_test_assertions (
        api_test_suite_id,
        endpoint_url,
        http_method,
        assertion_name,
        status,
        expected_value,
        actual_value,
        response_status,
        response_time_ms,
        error_message,
        detail,
        created_by,
        updated_by
    )
    SELECT
        i_api_test_suite_id,
        COALESCE(a->>'endpoint_url', ''),
        COALESCE(a->>'http_method', 'GET'),
        COALESCE(a->>'assertion_name', 'unnamed'),
        COALESCE(a->>'status', 'error'),
        a->>'expected_value',
        a->>'actual_value',
        (a->>'response_status')::INTEGER,
        (a->>'response_time_ms')::INTEGER,
        a->>'error_message',
        a->'detail',
        i_created_by,
        i_created_by
    FROM jsonb_array_elements(i_assertions) AS a;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$;
