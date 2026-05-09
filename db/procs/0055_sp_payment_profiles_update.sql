BEGIN
-- Stored Procedure 0055: Update payment profile
CREATE OR REPLACE FUNCTION sp_payment_profiles_update(
    i_id INTEGER,
    i_name VARCHAR DEFAULT NULL,
    i_last_4 VARCHAR DEFAULT NULL,
    i_card_brand VARCHAR DEFAULT NULL,
    i_expiry_month INTEGER DEFAULT NULL,
    i_expiry_year INTEGER DEFAULT NULL,
    i_description TEXT DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_payment_type VARCHAR,
    o_last_4 VARCHAR,
    o_is_active BOOLEAN,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    UPDATE payment_profiles
    SET
        name = COALESCE(i_name, name),
        last_4 = COALESCE(i_last_4, last_4),
        card_brand = COALESCE(i_card_brand, card_brand),
        expiry_month = COALESCE(i_expiry_month, expiry_month),
        expiry_year = COALESCE(i_expiry_year, expiry_year),
        description = COALESCE(i_description, description),
        is_active = COALESCE(i_is_active, is_active),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING
        id AS o_id,
        name AS o_name,
        payment_type AS o_payment_type,
        last_4 AS o_last_4,
        is_active AS o_is_active,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
