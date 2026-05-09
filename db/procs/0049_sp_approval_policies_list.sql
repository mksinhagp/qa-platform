BEGIN
-- Stored Procedure 0049: List approval policies
CREATE OR REPLACE FUNCTION sp_approval_policies_list(
    i_is_system BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_action_category VARCHAR,
    o_default_strength VARCHAR,
    o_description TEXT,
    o_is_system BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        action_category AS o_action_category,
        default_strength AS o_default_strength,
        description AS o_description,
        is_system AS o_is_system
    FROM approval_policies
    WHERE (i_is_system IS NULL OR is_system = i_is_system)
    ORDER BY action_category;
END;
$$ LANGUAGE plpgsql;
END
