BEGIN
-- Stored procedure: List sites with environment count (enriched list for the sites index page)
-- Returns: site row plus o_env_count for display

CREATE OR REPLACE FUNCTION sp_sites_list_with_counts(
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
    o_id INTEGER,
    o_name VARCHAR(255),
    o_base_url VARCHAR(2048),
    o_description TEXT,
    o_is_active BOOLEAN,
    o_env_count BIGINT,
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
        COUNT(se.id) AS env_count,
        s.created_date,
        s.updated_date,
        s.created_by,
        s.updated_by
    FROM sites s
    LEFT JOIN site_environments se ON se.site_id = s.id AND se.is_active = TRUE
    WHERE (i_is_active IS NULL OR s.is_active = i_is_active)
    GROUP BY s.id, s.name, s.base_url, s.description, s.is_active,
             s.created_date, s.updated_date, s.created_by, s.updated_by
    ORDER BY s.name;
END;
$$;
END;
