BEGIN
-- Stored Procedure 0167: Insert payment provider
CREATE OR REPLACE FUNCTION sp_payment_providers_insert(
    i_name VARCHAR,
    i_provider_type VARCHAR,
    i_is_sandbox BOOLEAN DEFAULT TRUE,
    i_api_login_id_secret_id INTEGER DEFAULT NULL,
    i_api_transaction_key_secret_id INTEGER DEFAULT NULL,
    i_api_key_secret_id INTEGER DEFAULT NULL,
    i_api_secret_secret_id INTEGER DEFAULT NULL,
    i_merchant_id VARCHAR DEFAULT NULL,
    i_environment_url VARCHAR DEFAULT NULL,
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_provider_type VARCHAR,
    o_is_sandbox BOOLEAN,
    o_merchant_id VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO payment_providers (
        name, provider_type, is_sandbox,
        api_login_id_secret_id, api_transaction_key_secret_id,
        api_key_secret_id, api_secret_secret_id,
        merchant_id, environment_url, description,
        created_by, updated_by
    )
    VALUES (
        i_name, i_provider_type, i_is_sandbox,
        i_api_login_id_secret_id, i_api_transaction_key_secret_id,
        i_api_key_secret_id, i_api_secret_secret_id,
        i_merchant_id, i_environment_url, i_description,
        i_created_by, i_created_by
    )
    ON CONFLICT (name, provider_type, is_sandbox)
    DO UPDATE SET
        api_login_id_secret_id = COALESCE(EXCLUDED.api_login_id_secret_id, payment_providers.api_login_id_secret_id),
        api_transaction_key_secret_id = COALESCE(EXCLUDED.api_transaction_key_secret_id, payment_providers.api_transaction_key_secret_id),
        api_key_secret_id = COALESCE(EXCLUDED.api_key_secret_id, payment_providers.api_key_secret_id),
        api_secret_secret_id = COALESCE(EXCLUDED.api_secret_secret_id, payment_providers.api_secret_secret_id),
        merchant_id = COALESCE(EXCLUDED.merchant_id, payment_providers.merchant_id),
        environment_url = COALESCE(EXCLUDED.environment_url, payment_providers.environment_url),
        description = COALESCE(EXCLUDED.description, payment_providers.description),
        updated_by = i_created_by,
        updated_date = CURRENT_TIMESTAMP
    RETURNING
        id AS o_id,
        name AS o_name,
        provider_type AS o_provider_type,
        is_sandbox AS o_is_sandbox,
        merchant_id AS o_merchant_id,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
