BEGIN
-- Stored procedure: List all network profiles with optional filters
-- Returns: TABLE with all network profile columns

CREATE OR REPLACE FUNCTION sp_network_profiles_list(
    i_is_system BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_name VARCHAR(100),
    o_download_kbps INTEGER,
    o_upload_kbps INTEGER,
    o_latency_ms INTEGER,
    o_packet_loss_percent DECIMAL(5,2),
    o_description TEXT,
    o_is_system BOOLEAN,
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
        np.id,
        np.name,
        np.download_kbps,
        np.upload_kbps,
        np.latency_ms,
        np.packet_loss_percent,
        np.description,
        np.is_system,
        np.created_date,
        np.updated_date,
        np.created_by,
        np.updated_by
    FROM network_profiles np
    WHERE
        (i_is_system IS NULL OR np.is_system = i_is_system)
    ORDER BY np.name;
END;
$$;
END;
