BEGIN
-- Stored Procedure 0048: Insert approval policy
CREATE OR REPLACE FUNCTION sp_approval_policies_insert(
    i_action_category VARCHAR,
    i_default_strength VARCHAR,
    i_description TEXT DEFAULT NULL,
    i_is_system BOOLEAN DEFAULT TRUE,
    i_created_by VARCHAR DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_action_category VARCHAR,
    o_default_strength VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    INSERT INTO approval_policies (
        action_category, default_strength, description,
        is_system, created_by, updated_by
    )
    VALUES (
        i_action_category, i_default_strength, i_description,
        i_is_system, i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        action_category AS o_action_category,
        default_strength AS o_default_strength,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
