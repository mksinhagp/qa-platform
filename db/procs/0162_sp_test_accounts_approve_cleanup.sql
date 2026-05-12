-- Stored Procedure: sp_test_accounts_approve_cleanup
-- Purpose: Approve cleanup of a test account
CREATE OR REPLACE FUNCTION sp_test_accounts_approve_cleanup(
    i_id INTEGER,
    i_approved_by VARCHAR(255)
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
        cleanup_status = 'approved',
        cleanup_approved_by = i_approved_by,
        cleanup_approved_at = CURRENT_TIMESTAMP,
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_approved_by
    WHERE id = i_id
      AND cleanup_status = 'pending_approval';

    RETURN QUERY
    SELECT ta.id, ta.cleanup_status
    FROM test_accounts ta
    WHERE ta.id = i_id;
END;
$$;
