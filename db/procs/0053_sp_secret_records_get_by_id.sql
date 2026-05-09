BEGIN
-- Stored Procedure 0053: Get secret record by ID
CREATE OR REPLACE FUNCTION sp_secret_records_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_category VARCHAR,
    o_owner_scope VARCHAR,
    o_name VARCHAR,
    o_description VARCHAR,
    o_encrypted_payload BYTEA,
    o_nonce BYTEA,
    o_aad BYTEA,
    o_wrapped_dek BYTEA,
    o_kdf_version INTEGER,
    o_is_session_only BOOLEAN,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sr.id AS o_id,
        sr.category AS o_category,
        sr.owner_scope AS o_owner_scope,
        sr.name AS o_name,
        sr.description AS o_description,
        sr.encrypted_payload AS o_encrypted_payload,
        sr.nonce AS o_nonce,
        sr.aad AS o_aad,
        sr.wrapped_dek AS o_wrapped_dek,
        sr.kdf_version AS o_kdf_version,
        sr.is_session_only AS o_is_session_only,
        sr.is_active AS o_is_active,
        sr.created_date AS o_created_date,
        sr.updated_date AS o_updated_date
    FROM secret_records sr
    WHERE sr.id = i_id AND sr.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
END
