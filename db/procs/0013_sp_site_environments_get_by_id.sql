BEGIN
-- Stored procedure: Get a site environment by id
-- Returns: TABLE with all environment columns

CREATE OR REPLACE FUNCTION sp_site_environments_get_by_id(
    i_id INTEGER
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
    WHERE se.id = i_id;
END;
$$;
END;
