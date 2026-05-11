-- Stored Procedure: sp_admin_test_assertions_list_by_suite
-- Purpose: List all assertion results for a given admin test suite
-- Parameters:
--   i_admin_test_suite_id: admin_test_suites.id
-- Returns: all admin test assertion columns ordered by id

CREATE OR REPLACE FUNCTION sp_admin_test_assertions_list_by_suite(
    i_admin_test_suite_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_admin_test_suite_id INTEGER,
    o_assertion_name VARCHAR(255),
    o_status VARCHAR(50),
    o_page_url VARCHAR(2048),
    o_expected_value TEXT,
    o_actual_value TEXT,
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
        a.id,
        a.admin_test_suite_id,
        a.assertion_name,
        a.status,
        a.page_url,
        a.expected_value,
        a.actual_value,
        a.error_message,
        a.detail,
        a.created_date,
        a.updated_date
    FROM admin_test_assertions a
    WHERE a.admin_test_suite_id = i_admin_test_suite_id
    ORDER BY a.id ASC;
END;
$$;
