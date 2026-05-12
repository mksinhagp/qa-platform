BEGIN
-- Stored Procedure 0176: List payment transactions
CREATE OR REPLACE FUNCTION sp_payment_transactions_list(
    i_run_execution_id INTEGER DEFAULT NULL,
    i_site_id INTEGER DEFAULT NULL,
    i_payment_provider_id INTEGER DEFAULT NULL,
    i_status VARCHAR DEFAULT NULL,
    i_transaction_type VARCHAR DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_persona_id INTEGER,
    o_payment_provider_id INTEGER,
    o_payment_scenario_id INTEGER,
    o_transaction_type VARCHAR,
    o_amount DECIMAL,
    o_currency VARCHAR,
    o_provider_transaction_id VARCHAR,
    o_status VARCHAR,
    o_email_receipt_verified BOOLEAN,
    o_admin_reconciled BOOLEAN,
    o_test_data_cleanup_status VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        run_execution_id AS o_run_execution_id,
        site_id AS o_site_id,
        site_environment_id AS o_site_environment_id,
        persona_id AS o_persona_id,
        payment_provider_id AS o_payment_provider_id,
        payment_scenario_id AS o_payment_scenario_id,
        transaction_type AS o_transaction_type,
        amount AS o_amount,
        currency AS o_currency,
        provider_transaction_id AS o_provider_transaction_id,
        status AS o_status,
        email_receipt_verified AS o_email_receipt_verified,
        admin_reconciled AS o_admin_reconciled,
        test_data_cleanup_status AS o_test_data_cleanup_status,
        created_date AS o_created_date
    FROM payment_transactions
    WHERE
        (i_run_execution_id IS NULL OR run_execution_id = i_run_execution_id)
        AND (i_site_id IS NULL OR site_id = i_site_id)
        AND (i_payment_provider_id IS NULL OR payment_provider_id = i_payment_provider_id)
        AND (i_status IS NULL OR status = i_status)
        AND (i_transaction_type IS NULL OR transaction_type = i_transaction_type)
    ORDER BY created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
