BEGIN
-- Stored procedure: Get a device profile by id
-- Returns: TABLE with all device profile columns

CREATE OR REPLACE FUNCTION sp_device_profiles_get_by_id(
    i_id INTEGER
)
RETURNS TABLE(
    o_id INTEGER,
    o_name VARCHAR(100),
    o_device_type VARCHAR(50),
    o_viewport_width INTEGER,
    o_viewport_height INTEGER,
    o_device_pixel_ratio DECIMAL(3,2),
    o_user_agent TEXT,
    o_is_touch BOOLEAN,
    o_screen_orientation VARCHAR(20),
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
        dp.id,
        dp.name,
        dp.device_type,
        dp.viewport_width,
        dp.viewport_height,
        dp.device_pixel_ratio,
        dp.user_agent,
        dp.is_touch,
        dp.screen_orientation,
        dp.description,
        dp.is_system,
        dp.created_date,
        dp.updated_date,
        dp.created_by,
        dp.updated_by
    FROM device_profiles dp
    WHERE dp.id = i_id;
END;
$$;
END;
