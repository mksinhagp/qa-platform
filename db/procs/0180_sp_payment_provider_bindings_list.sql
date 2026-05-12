BEGIN
-- Stored Procedure 0180: List payment provider bindings
CREATE OR REPLACE FUNCTION sp_payment_provider_bindings_list(
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL,
    i_payment_provider_id INTEGER DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_payment_provider_id INTEGER,
    o_payment_provider_name VARCHAR,
    o_payment_provider_type VARCHAR,
    o_is_default BOOLEAN,
    o_description TEXT,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ppb.id AS o_id,
        ppb.site_id AS o_site_id,
        ppb.site_environment_id AS o_site_environment_id,
        ppb.payment_provider_id AS o_payment_provider_id,
        pp.name AS o_payment_provider_name,
        pp.provider_type AS o_payment_provider_type,
        ppb.is_default AS o_is_default,
        ppb.description AS o_description,
        ppb.is_active AS o_is_active,
        ppb.created_date AS o_created_date
    FROM payment_provider_bindings ppb
    JOIN payment_providers pp ON ppb.payment_provider_id = pp.id
    WHERE
        (i_site_id IS NULL OR ppb.site_id = i_site_id)
        AND (i_site_environment_id IS NULL OR ppb.site_environment_id = i_site_environment_id)
        AND (i_payment_provider_id IS NULL OR ppb.payment_provider_id = i_payment_provider_id)
        AND (i_is_active IS NULL OR ppb.is_active = i_is_active)
    ORDER BY ppb.site_id, ppb.site_environment_id, ppb.is_default DESC;
END;
$$ LANGUAGE plpgsql;
END
