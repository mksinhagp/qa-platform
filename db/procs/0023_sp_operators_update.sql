BEGIN
-- Stored Procedure 0023: Update existing operator
CREATE OR REPLACE FUNCTION sp_operators_update(
    i_id INTEGER,
    i_password_hash VARCHAR DEFAULT NULL,
    i_full_name VARCHAR DEFAULT NULL,
    i_email VARCHAR DEFAULT NULL,
    i_active BOOLEAN DEFAULT NULL,
    i_updated_by VARCHAR
)
RETURNS TABLE (
    o_id INTEGER,
    o_login VARCHAR,
    o_full_name VARCHAR,
    o_email VARCHAR,
    o_active BOOLEAN,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    UPDATE operators
    SET
        password_hash = COALESCE(i_password_hash, password_hash),
        full_name = COALESCE(i_full_name, full_name),
        email = COALESCE(i_email, email),
        active = COALESCE(i_active, active),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING
        id AS o_id,
        login AS o_login,
        full_name AS o_full_name,
        email AS o_email,
        active AS o_active,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
