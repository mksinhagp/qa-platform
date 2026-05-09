BEGIN
-- Stored Procedure 0050: List all operators
CREATE OR REPLACE FUNCTION sp_operators_list(
    i_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_login VARCHAR,
    o_full_name VARCHAR,
    o_email VARCHAR,
    o_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        op.id AS o_id,
        op.login AS o_login,
        op.full_name AS o_full_name,
        op.email AS o_email,
        op.active AS o_active,
        op.created_date AS o_created_date,
        op.updated_date AS o_updated_date
    FROM operators op
    WHERE (i_active IS NULL OR op.active = i_active)
    ORDER BY op.login;
END;
$$ LANGUAGE plpgsql;
END
