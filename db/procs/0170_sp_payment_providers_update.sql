BEGIN
-- Stored Procedure 0170: Update payment provider
CREATE OR REPLACE FUNCTION sp_payment_providers_update(
    i_id INTEGER,
    i_name VARCHAR DEFAULT NULL,
    i_is_sandbox BOOLEAN DEFAULT NULL,
    i_api_login_id_secret_id INTEGER DEFAULT NULL,
    i_api_transaction_key_secret_id INTEGER DEFAULT NULL,
    i_api_key_secret_id INTEGER DEFAULT NULL,
    i_api_secret_secret_id INTEGER DEFAULT NULL,
    i_merchant_id VARCHAR DEFAULT NULL,
    i_environment_url VARCHAR DEFAULT NULL,
    i_description TEXT DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
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
    UPDATE payment_providers
    SET
        name = COALESCE(i_name, name),
        is_sandbox = COALESCE(i_is_sandbox, is_sandbox),
        api_login_id_secret_id = COALESCE(i_api_login_id_secret_id, api_login_id_secret_id),
        api_transaction_key_secret_id = COALESCE(i_api_transaction_key_secret_id, api_transaction_key_secret_id),
        api_key_secret_id = COALESCE(i_api_key_secret_id, api_key_secret_id),
        api_secret_secret_id = COALESCE(i_api_secret_secret_id, api_secret_secret_id),
        merchant_id = COALESCE(i_merchant_id, merchant_id),
        environment_url = COALESCE(i_environment_url, environment_url),
        description = COALESCE(i_description, description),
        is_active = COALESCE(i_is_active, is_active),
        updated_by = i_updated_by,
        updated_date = CURRENT_TIMESTAMP
    WHERE id = i_id
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
