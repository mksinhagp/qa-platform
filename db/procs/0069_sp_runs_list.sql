BEGIN
-- Stored procedure: List runs with optional status filter
-- Returns: TABLE with run summary columns

CREATE OR REPLACE FUNCTION sp_runs_list(
    i_site_id INTEGER DEFAULT NULL,
    i_status VARCHAR(50) DEFAULT NULL,
    i_limit INTEGER DEFAULT 50,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    o_id INTEGER,
    o_name VARCHAR(255),
    o_description TEXT,
    o_site_id INTEGER,
    o_site_name VARCHAR(255),
    o_site_environment_id INTEGER,
    o_site_env_name VARCHAR(100),
    o_status VARCHAR(50),
    o_started_by VARCHAR(255),
    o_started_at TIMESTAMP WITH TIME ZONE,
    o_completed_at TIMESTAMP WITH TIME ZONE,
    o_total_executions INTEGER,
    o_successful_executions INTEGER,
    o_failed_executions INTEGER,
    o_skipped_executions INTEGER,
    o_notes TEXT,
    o_is_pinned BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.name,
        r.description,
        r.site_id,
        s.name AS site_name,
        r.site_environment_id,
        se.name AS site_env_name,
        r.status,
        r.started_by,
        r.started_at,
        r.completed_at,
        r.total_executions,
        r.successful_executions,
        r.failed_executions,
        r.skipped_executions,
        r.notes,
        r.is_pinned,
        r.created_date,
        r.updated_date
    FROM runs r
    JOIN sites s ON s.id = r.site_id
    JOIN site_environments se ON se.id = r.site_environment_id
    WHERE
        (i_site_id IS NULL OR r.site_id = i_site_id)
        AND (i_status IS NULL OR r.status = i_status)
    ORDER BY r.is_pinned DESC, r.created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$;
END;
