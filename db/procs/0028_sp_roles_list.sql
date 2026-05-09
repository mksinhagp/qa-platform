BEGIN
-- Stored Procedure 0028: List roles
CREATE OR REPLACE FUNCTION sp_roles_list(
    i_is_system BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_description TEXT,
    o_is_system BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        description AS o_description,
        is_system AS o_is_system
    FROM roles
    WHERE (i_is_system IS NULL OR is_system = i_is_system)
    ORDER BY name;
END;
$$ LANGUAGE plpgsql;
END
