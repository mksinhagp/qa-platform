-- Stored Procedure: sp_admin_test_suites_update
-- Purpose: Update admin test suite status and counters after suite execution completes
-- Parameters:
--   i_id: admin_test_suites.id
--   i_status: 'passed', 'failed', 'error', 'skipped'
--   i_total_assertions: total assertion count
--   i_passed_assertions: passed count
--   i_failed_assertions: failed count
--   i_skipped_assertions: skipped count
--   i_duration_ms: total suite duration in milliseconds
--   i_error_message: optional error message if suite errored
--   i_updated_by: operator login or 'system'
-- Returns: o_id, o_status

CREATE OR REPLACE FUNCTION sp_admin_test_suites_update(
    i_id INTEGER,
    i_status VARCHAR(50),
    i_total_assertions INTEGER DEFAULT 0,
    i_passed_assertions INTEGER DEFAULT 0,
    i_failed_assertions INTEGER DEFAULT 0,
    i_skipped_assertions INTEGER DEFAULT 0,
    i_duration_ms INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE admin_test_suites SET
        status = i_status,
        total_assertions = i_total_assertions,
        passed_assertions = i_passed_assertions,
        failed_assertions = i_failed_assertions,
        skipped_assertions = i_skipped_assertions,
        duration_ms = i_duration_ms,
        error_message = i_error_message,
        completed_at = CURRENT_TIMESTAMP,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id;

    RETURN QUERY SELECT i_id, i_status;
END;
$$;
