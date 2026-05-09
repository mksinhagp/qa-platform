BEGIN
-- Stored procedure: List all sites with optional filters
-- Returns: TABLE with all site columns

CREATE OR REPLACE FUNCTION sp_sites_list(
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_name VARCHAR(255),
    o_base_url VARCHAR(2048),
    o_description TEXT,
    o_is_active BOOLEAN,
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
        s.id,
        s.name,
        s.base_url,
        s.description,
        s.is_active,
        s.created_date,
        s.updated_date,
        s.created_by,
        s.updated_by
    FROM sites s
    WHERE
        (i_is_active IS NULL OR s.is_active = i_is_active)
    ORDER BY s.name;
END;
$$;
END;
