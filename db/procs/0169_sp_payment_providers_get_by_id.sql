BEGIN
-- Stored Procedure 0169: Get payment provider by id
CREATE OR REPLACE FUNCTION sp_payment_providers_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_provider_type VARCHAR,
    o_is_sandbox BOOLEAN,
    o_merchant_id VARCHAR,
    o_environment_url VARCHAR,
    o_description TEXT,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        provider_type AS o_provider_type,
        is_sandbox AS o_is_sandbox,
        merchant_id AS o_merchant_id,
        environment_url AS o_environment_url,
        description AS o_description,
        is_active AS o_is_active,
        created_date AS o_created_date,
        updated_date AS o_updated_date
    FROM payment_providers
    WHERE id = i_id;
END;
$$ LANGUAGE plpgsql;
END
