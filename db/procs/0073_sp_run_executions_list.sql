BEGIN
-- Stored procedure: List executions for a run with persona/device/network names
-- Returns: TABLE with enriched execution rows
--
-- LEFT JOINs are used for persona, device, and network so that executions are
-- never silently dropped if a referenced record is missing or was not seeded.
-- Missing references produce NULL display names which are coalesced to fallback
-- values containing the raw ID for easy debugging.

CREATE OR REPLACE FUNCTION sp_run_executions_list(
    i_run_id INTEGER
)
RETURNS TABLE(
    o_id INTEGER,
    o_run_id INTEGER,
    o_persona_id VARCHAR(100),
    o_persona_display_name VARCHAR(255),
    o_device_profile_id INTEGER,
    o_device_profile_name VARCHAR(100),
    o_network_profile_id INTEGER,
    o_network_profile_name VARCHAR(100),
    o_browser VARCHAR(50),
    o_flow_name VARCHAR(100),
    o_status VARCHAR(50),
    o_started_at TIMESTAMP WITH TIME ZONE,
    o_completed_at TIMESTAMP WITH TIME ZONE,
    o_friction_score DECIMAL(5,2),
    o_error_message TEXT,
    o_artifact_path VARCHAR(512),
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        re.id,
        re.run_id,
        re.persona_id,
        COALESCE(p.display_name, '[persona ' || re.persona_id || ']')::VARCHAR(255) AS persona_display_name,
        re.device_profile_id,
        COALESCE(dp.name, '[device ' || re.device_profile_id::TEXT || ']')::VARCHAR(100) AS device_profile_name,
        re.network_profile_id,
        COALESCE(np.name, '[network ' || re.network_profile_id::TEXT || ']')::VARCHAR(100) AS network_profile_name,
        re.browser,
        re.flow_name,
        re.status,
        re.started_at,
        re.completed_at,
        re.friction_score,
        re.error_message,
        re.artifact_path,
        re.created_date,
        re.updated_date
    FROM run_executions re
    LEFT JOIN personas p ON p.id = re.persona_id
    LEFT JOIN device_profiles dp ON dp.id = re.device_profile_id
    LEFT JOIN network_profiles np ON np.id = re.network_profile_id
    WHERE re.run_id = i_run_id
    ORDER BY re.created_date ASC;
END;
$$;
END;
