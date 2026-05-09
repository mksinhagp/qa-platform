BEGIN
-- Stored procedure: List site environments with optional filters
-- Returns: TABLE with all environment columns

CREATE OR REPLACE FUNCTION sp_site_environments_list(
    i_site_id INTEGER DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_site_id INTEGER,
    o_name VARCHAR(100),
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
        se.id,
        se.site_id,
        se.name,
        se.base_url,
        se.description,
        se.is_active,
        se.created_date,
        se.updated_date,
        se.created_by,
        se.updated_by
    FROM site_environments se
    WHERE
        (i_site_id IS NULL OR se.site_id = i_site_id)
        AND (i_is_active IS NULL OR se.is_active = i_is_active)
    ORDER BY se.site_id, se.name;
END;
$$;
END;
