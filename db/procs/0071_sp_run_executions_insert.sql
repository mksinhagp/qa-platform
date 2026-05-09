BEGIN
-- Stored procedure: Insert a child run execution record
-- Returns: TABLE with new execution id

CREATE OR REPLACE FUNCTION sp_run_executions_insert(
    i_run_id INTEGER,
    i_persona_id VARCHAR(100),
    i_device_profile_id INTEGER,
    i_network_profile_id INTEGER,
    i_browser VARCHAR(50),
    i_flow_name VARCHAR(100),
    i_artifact_path VARCHAR(512) DEFAULT NULL,
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
    INSERT INTO run_executions (run_id, persona_id, device_profile_id, network_profile_id, browser, flow_name, status, artifact_path, created_by, updated_by)
    VALUES (i_run_id, i_persona_id, i_device_profile_id, i_network_profile_id, i_browser, i_flow_name, 'queued', i_artifact_path, i_created_by, i_created_by)
    RETURNING id, status;
END;
$$;
END;
