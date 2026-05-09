BEGIN
-- Stored procedure: Create a new matrix run record
-- Returns: TABLE with new run id and status

CREATE OR REPLACE FUNCTION sp_runs_insert(
    i_site_id INTEGER,
    i_site_environment_id INTEGER,
    i_name VARCHAR(255),
    i_description TEXT DEFAULT NULL,
    i_config JSONB DEFAULT '{}',
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO runs (site_id, site_environment_id, name, description, status, config, started_by, notes, created_by, updated_by)
    VALUES (i_site_id, i_site_environment_id, i_name, i_description, 'draft', i_config, i_created_by, i_notes, i_created_by, i_created_by)
    RETURNING id, status;
END;
$$;
END;
