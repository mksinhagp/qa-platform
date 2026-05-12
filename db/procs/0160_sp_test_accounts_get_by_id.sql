-- Stored Procedure: sp_test_accounts_get_by_id
-- Purpose: Get a single test account by ID
CREATE OR REPLACE FUNCTION sp_test_accounts_get_by_id(
    i_id INTEGER
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
    o_phone VARCHAR(50),
    o_account_status VARCHAR(50),
    o_login_strategy VARCHAR(50),
    o_email_verified BOOLEAN,
    o_verification_method VARCHAR(50),
    o_cleanup_status VARCHAR(50),
    o_cleanup_approved_by VARCHAR(255),
    o_cleanup_approved_at TIMESTAMP WITH TIME ZONE,
    o_cleaned_up_at TIMESTAMP WITH TIME ZONE,
    o_metadata JSONB,
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
        ta.email, ta.username, ta.first_name, ta.last_name, ta.phone,
        ta.account_status, ta.login_strategy, ta.email_verified,
        ta.verification_method, ta.cleanup_status, ta.cleanup_approved_by,
        ta.cleanup_approved_at, ta.cleaned_up_at, ta.metadata,
        ta.notes, ta.created_date, ta.updated_date
    FROM test_accounts ta
    WHERE ta.id = i_id;
END;
$$;
