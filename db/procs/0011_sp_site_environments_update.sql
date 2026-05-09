BEGIN
-- Stored procedure: Update an existing site environment
-- Returns: TABLE with the updated environment id and all columns

CREATE OR REPLACE FUNCTION sp_site_environments_update(
    i_id INTEGER,
    i_name VARCHAR(100),
    i_base_url VARCHAR(2048),
    i_description TEXT DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT TRUE,
    i_updated_by VARCHAR(255) DEFAULT NULL
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
    UPDATE site_environments
    SET
        name = i_name,
        base_url = i_base_url,
        description = i_description,
        is_active = i_is_active,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING
        id,
        site_id,
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
        o_site_id,
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
