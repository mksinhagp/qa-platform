BEGIN
-- Stored Procedure 0186: List test data ledger entries
CREATE OR REPLACE FUNCTION sp_test_data_ledger_list(
    i_run_execution_id INTEGER DEFAULT NULL,
    i_data_type VARCHAR DEFAULT NULL,
    i_data_category VARCHAR DEFAULT NULL,
    i_cleanup_status VARCHAR DEFAULT NULL,
    i_is_cleanup_eligible BOOLEAN DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_data_type VARCHAR,
    o_data_category VARCHAR,
    o_identifier VARCHAR,
    o_identifier_type VARCHAR,
    o_cleanup_status VARCHAR,
    o_expires_at TIMESTAMP WITH TIME ZONE,
    o_is_cleanup_eligible BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        run_execution_id AS o_run_execution_id,
        data_type AS o_data_type,
        data_category AS o_data_category,
        identifier AS o_identifier,
        identifier_type AS o_identifier_type,
        cleanup_status AS o_cleanup_status,
        expires_at AS o_expires_at,
        is_cleanup_eligible AS o_is_cleanup_eligible,
        created_date AS o_created_date
    FROM test_data_ledger
    WHERE
        (i_run_execution_id IS NULL OR run_execution_id = i_run_execution_id)
        AND (i_data_type IS NULL OR data_type = i_data_type)
        AND (i_data_category IS NULL OR data_category = i_data_category)
        AND (i_cleanup_status IS NULL OR cleanup_status = i_cleanup_status)
        AND (i_is_cleanup_eligible IS NULL OR is_cleanup_eligible = i_is_cleanup_eligible)
    ORDER BY created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
