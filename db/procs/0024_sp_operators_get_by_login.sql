BEGIN
-- Stored Procedure 0024: Get operator by login
CREATE OR REPLACE FUNCTION sp_operators_get_by_login(
    i_login VARCHAR
)
RETURNS TABLE (
    o_id INTEGER,
    o_login VARCHAR,
    o_password_hash VARCHAR,
    o_full_name VARCHAR,
    o_email VARCHAR,
    o_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        login AS o_login,
        password_hash AS o_password_hash,
        full_name AS o_full_name,
        email AS o_email,
        active AS o_active,
        created_date AS o_created_date,
        updated_date AS o_updated_date
    FROM operators
    WHERE login = i_login;
END;
$$ LANGUAGE plpgsql;
END
