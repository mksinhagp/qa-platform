BEGIN
-- Stored procedure: Recalculate and update run execution counters
-- Called after each execution status change
-- Returns: TABLE with updated run id and counters
--
-- Terminal execution statuses and their counter buckets:
--   passed            → successful_executions
--   friction_flagged  → successful_executions (completed without hard failure)
--   failed, aborted   → failed_executions
--   skipped_by_approval → skipped_executions

CREATE OR REPLACE FUNCTION sp_runs_update_counters(
    i_run_id INTEGER,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER,
    o_total_executions INTEGER,
    o_successful_executions INTEGER,
    o_failed_executions INTEGER,
    o_skipped_executions INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total INTEGER;
    v_successful INTEGER;
    v_failed INTEGER;
    v_skipped INTEGER;
BEGIN
    SELECT
        COUNT(*),
        -- friction_flagged counts as successful: the run completed, it just had notable friction
        COUNT(*) FILTER (WHERE status IN ('passed', 'friction_flagged')),
        COUNT(*) FILTER (WHERE status IN ('failed', 'aborted')),
        COUNT(*) FILTER (WHERE status = 'skipped_by_approval')
    INTO v_total, v_successful, v_failed, v_skipped
    FROM run_executions
    WHERE run_id = i_run_id;

    RETURN QUERY
    UPDATE runs
    SET
        total_executions = v_total,
        successful_executions = v_successful,
        failed_executions = v_failed,
        skipped_executions = v_skipped,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_run_id
    RETURNING id, total_executions, successful_executions, failed_executions, skipped_executions;
END;
$$;
END;
