BEGIN
-- Stored Procedure 0031: Get vault state
CREATE OR REPLACE FUNCTION sp_vault_state_get()
RETURNS TABLE (
    o_is_bootstrapped BOOLEAN,
    o_bootstrap_date TIMESTAMP WITH TIME ZONE,
    o_bootstrap_operator_id INTEGER,
    o_kdf_memory INTEGER,
    o_kdf_iterations INTEGER,
    o_kdf_parallelism INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (wrapped_rvk IS NOT NULL) AS o_is_bootstrapped,
        created_date AS o_bootstrap_date,
        created_by::INTEGER AS o_bootstrap_operator_id,
        kdf_memory AS o_kdf_memory,
        kdf_iterations AS o_kdf_iterations,
        kdf_parallelism AS o_kdf_parallelism
    FROM vault_state
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
END
