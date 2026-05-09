BEGIN
-- Stored Procedure 0039: Get secret record for use (with metadata only, no plaintext)
CREATE OR REPLACE FUNCTION sp_secret_records_get_for_use(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_category VARCHAR,
    o_owner_scope VARCHAR,
    o_name VARCHAR,
    o_description TEXT,
    o_encrypted_payload BYTEA,
    o_nonce BYTEA,
    o_aad TEXT,
    o_wrapped_dek BYTEA,
    o_kdf_version VARCHAR,
    o_is_session_only BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        category AS o_category,
        owner_scope AS o_owner_scope,
        name AS o_name,
        description AS o_description,
        encrypted_payload AS o_encrypted_payload,
        nonce AS o_nonce,
        aad AS o_aad,
        wrapped_dek AS o_wrapped_dek,
        kdf_version AS o_kdf_version,
        is_session_only AS o_is_session_only
    FROM secret_records
    WHERE id = i_id AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;
END
