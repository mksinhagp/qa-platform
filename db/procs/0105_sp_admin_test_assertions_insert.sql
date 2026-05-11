-- Stored Procedure: sp_admin_test_assertions_insert
-- Purpose: Insert a single admin test assertion result
-- Parameters:
--   i_admin_test_suite_id: admin_test_suites.id
--   i_assertion_name: human-readable assertion name
--   i_status: 'passed', 'failed', 'error', 'skipped'
--   i_page_url: page URL tested
--   i_expected_value: expected outcome
--   i_actual_value: actual outcome
--   i_error_message: optional error detail
--   i_detail: optional JSONB (DOM excerpt, field values, screenshot path)
--   i_created_by: operator login or 'system'
-- Returns: o_id, o_status

CREATE OR REPLACE FUNCTION sp_admin_test_assertions_insert(
    i_admin_test_suite_id INTEGER,
    i_assertion_name VARCHAR(255),
    i_status VARCHAR(50),
    i_page_url VARCHAR(2048) DEFAULT NULL,
    i_expected_value TEXT DEFAULT NULL,
    i_actual_value TEXT DEFAULT NULL,
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
    INSERT INTO admin_test_assertions (
        admin_test_suite_id,
        assertion_name,
        status,
        page_url,
        expected_value,
        actual_value,
        error_message,
        detail,
        created_by,
        updated_by
    ) VALUES (
        i_admin_test_suite_id,
        i_assertion_name,
        i_status,
        i_page_url,
        i_expected_value,
        i_actual_value,
        i_error_message,
        i_detail,
        i_created_by,
        i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_status;
END;
$$;
