BEGIN
-- Stored Procedure 0030: Set role assignments for operator
CREATE OR REPLACE FUNCTION sp_role_assignments_set(
    i_operator_id INTEGER,
    i_role_ids INTEGER[],
    i_assigned_by VARCHAR
)
RETURNS TABLE (
    o_success BOOLEAN
) AS $$
BEGIN
    -- Remove existing assignments
    DELETE FROM operator_role_assignments
    WHERE operator_id = i_operator_id;
    
    -- Insert new assignments
    INSERT INTO operator_role_assignments (operator_id, role_id, assigned_by, created_by, updated_by)
    SELECT i_operator_id, unnest(i_role_ids), i_assigned_by, i_assigned_by, i_assigned_by;
    
    RETURN QUERY SELECT TRUE AS o_success;
END;
$$ LANGUAGE plpgsql;
END
