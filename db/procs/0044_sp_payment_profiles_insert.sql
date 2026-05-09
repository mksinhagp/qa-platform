BEGIN
-- Stored Procedure 0044: Insert payment profile
CREATE OR REPLACE FUNCTION sp_payment_profiles_insert(
    i_name VARCHAR,
    i_payment_type VARCHAR,
    i_last_4 VARCHAR DEFAULT NULL,
    i_card_brand VARCHAR DEFAULT NULL,
    i_expiry_month INTEGER DEFAULT NULL,
    i_expiry_year INTEGER DEFAULT NULL,
    i_secret_id INTEGER,
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_payment_type VARCHAR,
    o_last_4 VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    INSERT INTO payment_profiles (
        name, payment_type, last_4, card_brand,
        expiry_month, expiry_year, secret_id,
        description, created_by, updated_by
    )
    VALUES (
        i_name, i_payment_type, i_last_4, i_card_brand,
        i_expiry_month, i_expiry_year, i_secret_id,
        i_description, i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        name AS o_name,
        payment_type AS o_payment_type,
        last_4 AS o_last_4,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
