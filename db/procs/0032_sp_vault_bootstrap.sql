BEGIN
-- Stored Procedure 0032: Bootstrap vault
CREATE OR REPLACE FUNCTION sp_vault_bootstrap(
    i_salt BYTEA,
    i_nonce BYTEA,
    i_kdf_memory INTEGER,
    i_kdf_iterations INTEGER,
    i_kdf_parallelism INTEGER,
    i_wrapped_rvk BYTEA,
    i_aad TEXT,
    i_bootstrap_operator_id INTEGER
)
RETURNS TABLE (
    o_success BOOLEAN
) AS $$
BEGIN
    -- Check if already bootstrapped
    IF EXISTS (SELECT 1 FROM vault_state WHERE wrapped_rvk IS NOT NULL) THEN
        RETURN QUERY SELECT FALSE AS o_success;
    ELSE
        INSERT INTO vault_state (
            kdf_salt, nonce, kdf_memory, kdf_iterations, kdf_parallelism,
            wrapped_rvk, aad, is_bootstrapped, bootstrap_date, bootstrap_operator_id,
            created_by, updated_by
        )
        VALUES (
            i_salt, i_nonce, i_kdf_memory, i_kdf_iterations, i_kdf_parallelism,
            i_wrapped_rvk, i_aad, TRUE, CURRENT_TIMESTAMP, i_bootstrap_operator_id,
            i_bootstrap_operator_id::VARCHAR, i_bootstrap_operator_id::VARCHAR
        );

        RETURN QUERY SELECT TRUE AS o_success;
    END IF;
END;
$$ LANGUAGE plpgsql;
END
