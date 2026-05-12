BEGIN
-- Stored Procedure 0179: Insert payment provider binding
CREATE OR REPLACE FUNCTION sp_payment_provider_bindings_insert(
    i_site_id INTEGER,
    i_site_environment_id INTEGER,
    i_payment_provider_id INTEGER,
    i_is_default BOOLEAN DEFAULT FALSE,
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_payment_provider_id INTEGER,
    o_is_default BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO payment_provider_bindings (
        site_id, site_environment_id, payment_provider_id,
        is_default, description,
        created_by, updated_by
    )
    VALUES (
        i_site_id, i_site_environment_id, i_payment_provider_id,
        i_is_default, i_description,
        i_created_by, i_created_by
    )
    ON CONFLICT (site_environment_id, payment_provider_id)
    DO UPDATE SET
        is_default = COALESCE(EXCLUDED.is_default, payment_provider_bindings.is_default),
        description = COALESCE(EXCLUDED.description, payment_provider_bindings.description),
        updated_by = i_created_by,
        updated_date = CURRENT_TIMESTAMP
    RETURNING
        id AS o_id,
        site_id AS o_site_id,
        site_environment_id AS o_site_environment_id,
        payment_provider_id AS o_payment_provider_id,
        is_default AS o_is_default,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
