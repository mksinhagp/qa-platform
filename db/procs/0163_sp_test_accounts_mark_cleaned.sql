-- Stored Procedure: sp_test_accounts_mark_cleaned
-- Purpose: Mark a test account as cleaned up after actual cleanup execution
CREATE OR REPLACE FUNCTION sp_test_accounts_mark_cleaned(
    i_id INTEGER,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_cleanup_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE test_accounts
    SET
        cleanup_status = 'cleaned_up',
        cleaned_up_at = CURRENT_TIMESTAMP,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id
      AND cleanup_status IN ('approved', 'active');

    RETURN QUERY
    SELECT ta.id, ta.cleanup_status
    FROM test_accounts ta
    WHERE ta.id = i_id;
END;
$$;
