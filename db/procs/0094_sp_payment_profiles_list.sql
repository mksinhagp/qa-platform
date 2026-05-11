-- Stored Procedure: sp_payment_profiles_list
-- Purpose: List all payment profiles (for checkout flow profile selection)
-- Parameters:
--   i_is_active: optional filter by active status (null = all)
-- Returns: payment profile rows (no secret payload — metadata only)

CREATE OR REPLACE FUNCTION sp_payment_profiles_list(
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR(255),
    o_payment_type VARCHAR(50),
    o_last_4 VARCHAR(4),
    o_card_brand VARCHAR(50),
    o_expiry_month INTEGER,
    o_expiry_year INTEGER,
    o_secret_id INTEGER,
    o_description TEXT,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE,
    o_created_by VARCHAR(255),
    o_updated_by VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
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
        pp.updated_date AS o_updated_date,
        pp.created_by AS o_created_by,
        pp.updated_by AS o_updated_by
    FROM payment_profiles pp
    WHERE (i_is_active IS NULL OR pp.is_active = i_is_active)
    ORDER BY pp.name ASC;
END;
$$;
