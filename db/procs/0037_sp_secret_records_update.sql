BEGIN
-- Stored Procedure 0037: Update secret record
CREATE OR REPLACE FUNCTION sp_secret_records_update(
    i_id INTEGER,
    i_encrypted_payload BYTEA,
    i_nonce BYTEA,
    i_aad TEXT DEFAULT NULL,
    i_wrapped_dek BYTEA,
    i_description TEXT DEFAULT NULL,
    i_updated_by VARCHAR
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    UPDATE secret_records
    SET
        encrypted_payload = i_encrypted_payload,
        nonce = i_nonce,
        aad = COALESCE(i_aad, aad),
        wrapped_dek = i_wrapped_dek,
        description = COALESCE(i_description, description),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
    RETURNING
        id AS o_id,
        name AS o_name,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
