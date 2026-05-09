BEGIN
-- Stored Procedure 0029: Get capabilities for operator
CREATE OR REPLACE FUNCTION sp_capabilities_for_operator(
    i_operator_id INTEGER
)
RETURNS TABLE (
    o_capability_id INTEGER,
    o_capability_name VARCHAR,
    o_capability_category VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.id AS o_capability_id,
        c.name AS o_capability_name,
        c.category AS o_capability_category
    FROM capabilities c
    JOIN role_capabilities rc ON c.id = rc.capability_id
    JOIN roles r ON rc.role_id = r.id
    JOIN operator_role_assignments ora ON r.id = ora.role_id
    WHERE ora.operator_id = i_operator_id
    ORDER BY c.category, c.name;
END;
$$ LANGUAGE plpgsql;
END
