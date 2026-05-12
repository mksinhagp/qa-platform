BEGIN
-- Stored Procedure 0188: Insert cleanup job
CREATE OR REPLACE FUNCTION sp_cleanup_jobs_insert(
    i_job_type VARCHAR,
    i_job_name VARCHAR,
    i_triggered_by VARCHAR,
    i_triggered_by_operator_id INTEGER DEFAULT NULL,
    i_filters JSONB DEFAULT NULL,
    i_dry_run BOOLEAN DEFAULT FALSE,
    i_approval_id INTEGER DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_job_name VARCHAR,
    o_status VARCHAR,
    o_dry_run BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO cleanup_jobs (
        job_type, job_name, triggered_by, triggered_by_operator_id,
        filters, dry_run, approval_id,
        status, created_by, updated_by
    )
    VALUES (
        i_job_type, i_job_name, i_triggered_by, i_triggered_by_operator_id,
        i_filters, i_dry_run, i_approval_id,
        'pending', i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        job_name AS o_job_name,
        status AS o_status,
        dry_run AS o_dry_run,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
