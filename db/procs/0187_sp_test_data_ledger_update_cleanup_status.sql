BEGIN
-- Stored Procedure 0187: Update test data ledger cleanup status
CREATE OR REPLACE FUNCTION sp_test_data_ledger_update_cleanup_status(
    i_ids INTEGER[],
    i_cleanup_status VARCHAR,
    i_cleanup_error_message TEXT DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_cleanup_status VARCHAR,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    UPDATE test_data_ledger
    SET
        cleanup_status = i_cleanup_status,
        cleanup_error_message = i_cleanup_error_message,
        cleanup_requested_at = CASE WHEN i_cleanup_status = 'cleanup_requested' THEN CURRENT_TIMESTAMP ELSE cleanup_requested_at END,
        cleanup_completed_at = CASE WHEN i_cleanup_status = 'cleanup_completed' THEN CURRENT_TIMESTAMP ELSE cleanup_completed_at END,
        updated_by = i_updated_by,
        updated_date = CURRENT_TIMESTAMP
    WHERE id = ANY(i_ids)
    RETURNING
        id AS o_id,
        cleanup_status AS o_cleanup_status,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
