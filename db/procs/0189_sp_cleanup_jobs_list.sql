BEGIN
-- Stored Procedure 0189: List cleanup jobs
CREATE OR REPLACE FUNCTION sp_cleanup_jobs_list(
    i_job_type VARCHAR DEFAULT NULL,
    i_status VARCHAR DEFAULT NULL,
    i_triggered_by VARCHAR DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_job_type VARCHAR,
    o_job_name VARCHAR,
    o_triggered_by VARCHAR,
    o_status VARCHAR,
    o_dry_run BOOLEAN,
    o_total_records_reviewed INTEGER,
    o_total_records_eligible INTEGER,
    o_total_records_deleted INTEGER,
    o_started_at TIMESTAMP WITH TIME ZONE,
    o_completed_at TIMESTAMP WITH TIME ZONE,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        job_type AS o_job_type,
        job_name AS o_job_name,
        triggered_by AS o_triggered_by,
        status AS o_status,
        dry_run AS o_dry_run,
        total_records_reviewed AS o_total_records_reviewed,
        total_records_eligible AS o_total_records_eligible,
        total_records_deleted AS o_total_records_deleted,
        started_at AS o_started_at,
        completed_at AS o_completed_at,
        created_date AS o_created_date
    FROM cleanup_jobs
    WHERE
        (i_job_type IS NULL OR job_type = i_job_type)
        AND (i_status IS NULL OR status = i_status)
        AND (i_triggered_by IS NULL OR triggered_by = i_triggered_by)
    ORDER BY created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
