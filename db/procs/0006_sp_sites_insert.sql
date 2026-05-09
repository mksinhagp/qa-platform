BEGIN
-- Stored procedure: Insert a new site
-- Returns: TABLE with the inserted site id and all columns

CREATE OR REPLACE FUNCTION sp_sites_insert(
    i_name VARCHAR(255),
    i_base_url VARCHAR(2048),
    i_description TEXT DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT TRUE,
    i_created_by VARCHAR(255) DEFAULT 'system'
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
    INSERT INTO sites (
        name,
        base_url,
        description,
        is_active,
        created_by,
        updated_by
    ) VALUES (
        i_name,
        i_base_url,
        i_description,
        i_is_active,
        i_created_by,
        i_created_by
    )
    RETURNING
        id,
        name,
        base_url,
        description,
        is_active,
        created_date,
        updated_date,
        created_by,
        updated_by
    INTO
        o_id,
        o_name,
        o_base_url,
        o_description,
        o_is_active,
        o_created_date,
        o_updated_date,
        o_created_by,
        o_updated_by;

    RETURN NEXT;
END;
$$;
END;
