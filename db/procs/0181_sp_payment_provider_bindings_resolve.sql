BEGIN
-- Stored Procedure 0181: Resolve payment provider binding for site/environment
-- Returns the default binding or the most specific match
CREATE OR REPLACE FUNCTION sp_payment_provider_bindings_resolve(
    i_site_id INTEGER,
    i_site_environment_id INTEGER
)
RETURNS TABLE (
    o_payment_provider_id INTEGER,
    o_payment_provider_name VARCHAR,
    o_payment_provider_type VARCHAR,
    o_is_sandbox BOOLEAN,
    o_merchant_id VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ppb.payment_provider_id AS o_payment_provider_id,
        pp.name AS o_payment_provider_name,
        pp.provider_type AS o_payment_provider_type,
        pp.is_sandbox AS o_is_sandbox,
        pp.merchant_id AS o_merchant_id
    FROM payment_provider_bindings ppb
    JOIN payment_providers pp ON ppb.payment_provider_id = pp.id
    WHERE
        ppb.site_id = i_site_id
        AND ppb.site_environment_id = i_site_environment_id
        AND ppb.is_active = TRUE
        AND pp.is_active = TRUE
    ORDER BY
        ppb.is_default DESC,
        ppb.created_date ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
END
