BEGIN
-- Stored Procedure 0022: Insert new operator
CREATE OR REPLACE FUNCTION sp_operators_insert(
    i_login VARCHAR,
    i_password_hash VARCHAR,
    i_full_name VARCHAR DEFAULT NULL,
    i_email VARCHAR DEFAULT NULL,
    i_active BOOLEAN DEFAULT TRUE,
    i_created_by VARCHAR DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_login VARCHAR,
    o_full_name VARCHAR,
    o_email VARCHAR,
    o_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    INSERT INTO operators (login, password_hash, full_name, email, active, created_by, updated_by)
    VALUES (i_login, i_password_hash, i_full_name, i_email, i_active, i_created_by, i_created_by)
    RETURNING
        id AS o_id,
        login AS o_login,
        full_name AS o_full_name,
        email AS o_email,
        active AS o_active,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
