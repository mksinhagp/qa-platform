-- Stored Procedure: sp_test_accounts_update_status
-- Purpose: Update account status (registered, verified, active, suspended, cleaned_up)
CREATE OR REPLACE FUNCTION sp_test_accounts_update_status(
    i_id INTEGER,
    i_account_status VARCHAR(50),
    i_email_verified BOOLEAN DEFAULT NULL,
    i_verification_method VARCHAR(50) DEFAULT NULL,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_account_status VARCHAR(50),
    o_email_verified BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE test_accounts
    SET
        account_status = i_account_status,
        email_verified = COALESCE(i_email_verified, email_verified),
        verification_method = COALESCE(i_verification_method, verification_method),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id;

    RETURN QUERY
    SELECT ta.id, ta.account_status, ta.email_verified
    FROM test_accounts ta
    WHERE ta.id = i_id;
END;
$$;
