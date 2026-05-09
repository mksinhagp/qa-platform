BEGIN
-- Stored Procedure 0080: Get vault crypto material for unlock
-- Returns salt, nonce, wrapped_rvk, and aad needed by unlockVault()
CREATE OR REPLACE FUNCTION sp_vault_state_get_crypto()
RETURNS TABLE (
    o_salt BYTEA,
    o_nonce BYTEA,
    o_wrapped_rvk BYTEA,
    o_aad TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vs.salt        AS o_salt,
        vs.nonce       AS o_nonce,
        vs.wrapped_rvk AS o_wrapped_rvk,
        vs.aad         AS o_aad
    FROM vault_state vs
    WHERE vs.wrapped_rvk IS NOT NULL
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
END
