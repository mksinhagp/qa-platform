BEGIN
-- Stored procedure: Get a single run by id with enriched site/env names
-- Returns: TABLE with all run columns

CREATE OR REPLACE FUNCTION sp_runs_get_by_id(
    i_id INTEGER
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
    o_config JSONB,
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
    o_updated_date TIMESTAMP WITH TIME ZONE,
    o_created_by VARCHAR(255),
    o_updated_by VARCHAR(255)
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
        r.config,
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
        r.updated_date,
        r.created_by,
        r.updated_by
    FROM runs r
    JOIN sites s ON s.id = r.site_id
    JOIN site_environments se ON se.id = r.site_environment_id
    WHERE r.id = i_id;
END;
$$;
END;
