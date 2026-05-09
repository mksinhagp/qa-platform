BEGIN
-- Stored procedure: Get a site by id
-- Returns: TABLE with all site columns

CREATE OR REPLACE FUNCTION sp_sites_get_by_id(
    i_id INTEGER
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
    WHERE s.id = i_id;
END;
$$;
END;
