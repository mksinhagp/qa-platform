BEGIN
-- Stored Procedure 0168: List payment providers
CREATE OR REPLACE FUNCTION sp_payment_providers_list(
    i_provider_type VARCHAR DEFAULT NULL,
    i_is_sandbox BOOLEAN DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL
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
    o_created_date TIMESTAMP WITH TIME ZONE
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
        created_date AS o_created_date
    FROM payment_providers
    WHERE
        (i_provider_type IS NULL OR provider_type = i_provider_type)
        AND (i_is_sandbox IS NULL OR is_sandbox = i_is_sandbox)
        AND (i_is_active IS NULL OR is_active = i_is_active)
    ORDER BY provider_type, name;
END;
$$ LANGUAGE plpgsql;
END
