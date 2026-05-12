-- Stored Procedure: sp_test_accounts_list
-- Purpose: List test accounts for a site, optionally filtered
CREATE OR REPLACE FUNCTION sp_test_accounts_list(
    i_site_id INTEGER,
    i_cleanup_status VARCHAR(50) DEFAULT NULL,
    i_account_status VARCHAR(50) DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_site_id INTEGER,
    o_run_execution_id INTEGER,
    o_persona_id VARCHAR(100),
    o_email VARCHAR(255),
    o_username VARCHAR(255),
    o_first_name VARCHAR(255),
    o_last_name VARCHAR(255),
    o_account_status VARCHAR(50),
    o_login_strategy VARCHAR(50),
    o_email_verified BOOLEAN,
    o_cleanup_status VARCHAR(50),
    o_cleanup_approved_by VARCHAR(255),
    o_cleaned_up_at TIMESTAMP WITH TIME ZONE,
    o_notes TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ta.id, ta.site_id, ta.run_execution_id, ta.persona_id,
        ta.email, ta.username, ta.first_name, ta.last_name,
        ta.account_status, ta.login_strategy, ta.email_verified,
        ta.cleanup_status, ta.cleanup_approved_by, ta.cleaned_up_at,
        ta.notes, ta.created_date, ta.updated_date
    FROM test_accounts ta
    WHERE ta.site_id = i_site_id
      AND (i_cleanup_status IS NULL OR ta.cleanup_status = i_cleanup_status)
      AND (i_account_status IS NULL OR ta.account_status = i_account_status)
    ORDER BY ta.created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$;
