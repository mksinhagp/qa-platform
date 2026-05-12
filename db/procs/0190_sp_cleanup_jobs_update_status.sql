BEGIN
-- Stored Procedure 0190: Update cleanup job status
CREATE OR REPLACE FUNCTION sp_cleanup_jobs_update_status(
    i_id INTEGER,
    i_status VARCHAR,
    i_total_records_reviewed INTEGER DEFAULT NULL,
    i_total_records_eligible INTEGER DEFAULT NULL,
    i_total_records_deleted INTEGER DEFAULT NULL,
    i_total_records_failed INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_status VARCHAR,
    o_total_records_deleted INTEGER,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    UPDATE cleanup_jobs
    SET
        status = i_status,
        total_records_reviewed = COALESCE(i_total_records_reviewed, total_records_reviewed),
        total_records_eligible = COALESCE(i_total_records_eligible, total_records_eligible),
        total_records_deleted = COALESCE(i_total_records_deleted, total_records_deleted),
        total_records_failed = COALESCE(i_total_records_failed, total_records_failed),
        error_message = COALESCE(i_error_message, error_message),
        started_at = CASE WHEN i_status = 'running' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
        completed_at = CASE WHEN i_status IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_by = i_updated_by,
        updated_date = CURRENT_TIMESTAMP
    WHERE id = i_id
    RETURNING
        id AS o_id,
        status AS o_status,
        total_records_deleted AS o_total_records_deleted,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
