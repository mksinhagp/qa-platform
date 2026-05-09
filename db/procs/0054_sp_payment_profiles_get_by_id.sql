BEGIN
-- Stored Procedure 0054: Get payment profile by ID
CREATE OR REPLACE FUNCTION sp_payment_profiles_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_payment_type VARCHAR,
    o_last_4 VARCHAR,
    o_card_brand VARCHAR,
    o_expiry_month INTEGER,
    o_expiry_year INTEGER,
    o_secret_id INTEGER,
    o_description TEXT,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.id AS o_id,
        pp.name AS o_name,
        pp.payment_type AS o_payment_type,
        pp.last_4 AS o_last_4,
        pp.card_brand AS o_card_brand,
        pp.expiry_month AS o_expiry_month,
        pp.expiry_year AS o_expiry_year,
        pp.secret_id AS o_secret_id,
        pp.description AS o_description,
        pp.is_active AS o_is_active,
        pp.created_date AS o_created_date,
        pp.updated_date AS o_updated_date
    FROM payment_profiles pp
    WHERE pp.id = i_id;
END;
$$ LANGUAGE plpgsql;
END
