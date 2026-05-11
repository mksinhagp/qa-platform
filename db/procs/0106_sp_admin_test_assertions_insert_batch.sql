-- Stored Procedure: sp_admin_test_assertions_insert_batch
-- Purpose: Batch insert admin test assertion results from a JSONB array
-- Parameters:
--   i_admin_test_suite_id: admin_test_suites.id
--   i_assertions: JSONB array of assertion objects, each with:
--     assertion_name, status, page_url, expected_value, actual_value,
--     error_message, detail
--   i_created_by: operator login or 'system'
-- Returns: o_inserted_count

CREATE OR REPLACE FUNCTION sp_admin_test_assertions_insert_batch(
    i_admin_test_suite_id INTEGER,
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
    )
    SELECT
        i_admin_test_suite_id,
        (a->>'assertion_name')::VARCHAR(255),
        (a->>'status')::VARCHAR(50),
        (a->>'page_url')::VARCHAR(2048),
        a->>'expected_value',
        a->>'actual_value',
        a->>'error_message',
        a->'detail',
        i_created_by,
        i_created_by
    FROM jsonb_array_elements(i_assertions) AS a;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN QUERY SELECT v_count;
END;
$$;
