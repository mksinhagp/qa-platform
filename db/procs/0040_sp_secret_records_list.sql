BEGIN
-- Stored Procedure 0040: List secret records
CREATE OR REPLACE FUNCTION sp_secret_records_list(
    i_owner_scope VARCHAR DEFAULT NULL,
    i_category VARCHAR DEFAULT NULL,
    i_is_session_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_category VARCHAR,
    o_owner_scope VARCHAR,
    o_name VARCHAR,
    o_description TEXT,
    o_is_session_only BOOLEAN,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        category AS o_category,
        owner_scope AS o_owner_scope,
        name AS o_name,
        description AS o_description,
        is_session_only AS o_is_session_only,
        is_active AS o_is_active,
        created_date AS o_created_date
    FROM secret_records
    WHERE
        (i_owner_scope IS NULL OR owner_scope = i_owner_scope)
        AND (i_category IS NULL OR category = i_category)
        AND (i_is_session_only IS NULL OR is_session_only = i_is_session_only)
    ORDER BY owner_scope, category, name;
END;
$$ LANGUAGE plpgsql;
END
