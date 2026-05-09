BEGIN
-- Stored Procedure 0036: Insert secret record
CREATE OR REPLACE FUNCTION sp_secret_records_insert(
    i_category VARCHAR,
    i_owner_scope VARCHAR,
    i_name VARCHAR,
    i_description TEXT DEFAULT NULL,
    i_encrypted_payload BYTEA,
    i_nonce BYTEA,
    i_aad TEXT DEFAULT NULL,
    i_wrapped_dek BYTEA,
    i_kdf_version VARCHAR DEFAULT 'v1',
    i_is_session_only BOOLEAN DEFAULT FALSE,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_owner_scope VARCHAR,
    o_is_session_only BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    INSERT INTO secret_records (
        category, owner_scope, name, description,
        encrypted_payload, nonce, aad, wrapped_dek,
        kdf_version, is_session_only, created_by, updated_by
    )
    VALUES (
        i_category, i_owner_scope, i_name, i_description,
        i_encrypted_payload, i_nonce, i_aad, i_wrapped_dek,
        i_kdf_version, i_is_session_only, i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        name AS o_name,
        owner_scope AS o_owner_scope,
        is_session_only AS o_is_session_only,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
