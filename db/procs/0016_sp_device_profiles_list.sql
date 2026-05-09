BEGIN
-- Stored procedure: List all device profiles with optional filters
-- Returns: TABLE with all device profile columns

CREATE OR REPLACE FUNCTION sp_device_profiles_list(
    i_is_system BOOLEAN DEFAULT NULL,
    i_device_type VARCHAR(50) DEFAULT NULL
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
    WHERE
        (i_is_system IS NULL OR dp.is_system = i_is_system)
        AND (i_device_type IS NULL OR dp.device_type = i_device_type)
    ORDER BY dp.name;
END;
$$;
END;
