BEGIN
-- Stored Procedure 0045: List payment profiles
CREATE OR REPLACE FUNCTION sp_payment_profiles_list(
    i_payment_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_payment_type VARCHAR,
    o_last_4 VARCHAR,
    o_card_brand VARCHAR,
    o_description TEXT,
    o_is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        payment_type AS o_payment_type,
        last_4 AS o_last_4,
        card_brand AS o_card_brand,
        description AS o_description,
        is_active AS o_is_active
    FROM payment_profiles
    WHERE (i_payment_type IS NULL OR payment_type = i_payment_type)
    ORDER BY name;
END;
$$ LANGUAGE plpgsql;
END
