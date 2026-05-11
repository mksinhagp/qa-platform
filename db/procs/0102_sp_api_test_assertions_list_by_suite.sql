-- Stored Procedure: sp_api_test_assertions_list_by_suite
-- Purpose: Retrieve all API test assertions for a given suite (for dashboard drill-down)
-- Parameters:
--   i_api_test_suite_id: api_test_suites.id
-- Returns: full api_test_assertions rows ordered by id

CREATE OR REPLACE FUNCTION sp_api_test_assertions_list_by_suite(
    i_api_test_suite_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_api_test_suite_id INTEGER,
    o_endpoint_url VARCHAR(2048),
    o_http_method VARCHAR(10),
    o_assertion_name VARCHAR(255),
    o_status VARCHAR(50),
    o_expected_value TEXT,
    o_actual_value TEXT,
    o_response_status INTEGER,
    o_response_time_ms INTEGER,
    o_error_message TEXT,
    o_detail JSONB,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ata.id,
        ata.api_test_suite_id,
        ata.endpoint_url,
        ata.http_method,
        ata.assertion_name,
        ata.status,
        ata.expected_value,
        ata.actual_value,
        ata.response_status,
        ata.response_time_ms,
        ata.error_message,
        ata.detail,
        ata.created_date,
        ata.updated_date
    FROM api_test_assertions ata
    WHERE ata.api_test_suite_id = i_api_test_suite_id
    ORDER BY ata.id ASC;
END;
$$;
