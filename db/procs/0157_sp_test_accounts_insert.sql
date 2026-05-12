-- Stored Procedure: sp_test_accounts_insert
-- Purpose: Insert a new test account record
CREATE OR REPLACE FUNCTION sp_test_accounts_insert(
    i_site_id INTEGER,
    i_run_execution_id INTEGER DEFAULT NULL,
    i_persona_id VARCHAR(100) DEFAULT 'default',
    i_email VARCHAR(255) DEFAULT '',
    i_username VARCHAR(255) DEFAULT NULL,
    i_first_name VARCHAR(255) DEFAULT NULL,
    i_last_name VARCHAR(255) DEFAULT NULL,
    i_phone VARCHAR(50) DEFAULT NULL,
    i_password_hash VARCHAR(255) DEFAULT NULL,
    i_login_strategy VARCHAR(50) DEFAULT 'email_password',
    i_metadata JSONB DEFAULT NULL,
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_email VARCHAR(255),
    o_account_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO test_accounts (
        site_id, run_execution_id, persona_id, email, username,
        first_name, last_name, phone, password_hash, login_strategy,
        account_status, metadata, notes, created_by, updated_by
    ) VALUES (
        i_site_id, i_run_execution_id, i_persona_id, i_email, i_username,
        i_first_name, i_last_name, i_phone, i_password_hash, i_login_strategy,
        'pending_registration', i_metadata, i_notes, i_created_by, i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_email, 'pending_registration'::VARCHAR(50);
END;
$$;
