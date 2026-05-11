-- Stored Procedure: sp_api_test_assertions_insert
-- Purpose: Insert a single API test assertion result into a suite
-- Parameters:
--   i_api_test_suite_id: api_test_suites.id
--   i_endpoint_url: the URL that was tested
--   i_http_method: GET, POST, PUT, etc.
--   i_assertion_name: human-readable assertion name
--   i_status: 'passed', 'failed', 'error', 'skipped'
--   i_expected_value: what was expected (for diff display)
--   i_actual_value: what was received
--   i_response_status: HTTP status code
--   i_response_time_ms: response time in milliseconds
--   i_error_message: error detail
--   i_detail: arbitrary JSONB data (response snippet, schema diff, etc.)
--   i_created_by: operator login or 'system'
-- Returns: o_id, o_status

CREATE OR REPLACE FUNCTION sp_api_test_assertions_insert(
    i_api_test_suite_id INTEGER,
    i_endpoint_url VARCHAR(2048),
    i_http_method VARCHAR(10),
    i_assertion_name VARCHAR(255),
    i_status VARCHAR(50),
    i_expected_value TEXT DEFAULT NULL,
    i_actual_value TEXT DEFAULT NULL,
    i_response_status INTEGER DEFAULT NULL,
    i_response_time_ms INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_detail JSONB DEFAULT NULL,
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
    ) VALUES (
        i_api_test_suite_id,
        i_endpoint_url,
        i_http_method,
        i_assertion_name,
        i_status,
        i_expected_value,
        i_actual_value,
        i_response_status,
        i_response_time_ms,
        i_error_message,
        i_detail,
        i_created_by,
        i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_status;
END;
$$;
