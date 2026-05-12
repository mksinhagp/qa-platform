BEGIN
-- Stored Procedure 0177: Get payment transaction by id
CREATE OR REPLACE FUNCTION sp_payment_transactions_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_persona_id INTEGER,
    o_payment_provider_id INTEGER,
    o_payment_profile_id INTEGER,
    o_payment_scenario_id INTEGER,
    o_transaction_type VARCHAR,
    o_amount DECIMAL,
    o_currency VARCHAR,
    o_provider_transaction_id VARCHAR,
    o_provider_response_code VARCHAR,
    o_provider_response_reason VARCHAR,
    o_provider_response_text TEXT,
    o_status VARCHAR,
    o_ui_confirmation TEXT,
    o_email_receipt_verified BOOLEAN,
    o_email_receipt_details TEXT,
    o_admin_reconciled BOOLEAN,
    o_admin_reconciliation_details TEXT,
    o_error_message TEXT,
    o_redacted_card_number VARCHAR,
    o_redacted_cvv VARCHAR,
    o_test_data_generated BOOLEAN,
    o_test_data_cleanup_status VARCHAR,
    o_approval_id INTEGER,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
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
        payment_profile_id AS o_payment_profile_id,
        payment_scenario_id AS o_payment_scenario_id,
        transaction_type AS o_transaction_type,
        amount AS o_amount,
        currency AS o_currency,
        provider_transaction_id AS o_provider_transaction_id,
        provider_response_code AS o_provider_response_code,
        provider_response_reason AS o_provider_response_reason,
        provider_response_text AS o_provider_response_text,
        status AS o_status,
        ui_confirmation AS o_ui_confirmation,
        email_receipt_verified AS o_email_receipt_verified,
        email_receipt_details AS o_email_receipt_details,
        admin_reconciled AS o_admin_reconciled,
        admin_reconciliation_details AS o_admin_reconciliation_details,
        error_message AS o_error_message,
        redacted_card_number AS o_redacted_card_number,
        redacted_cvv AS o_redacted_cvv,
        test_data_generated AS o_test_data_generated,
        test_data_cleanup_status AS o_test_data_cleanup_status,
        approval_id AS o_approval_id,
        created_date AS o_created_date,
        updated_date AS o_updated_date
    FROM payment_transactions
    WHERE id = i_id;
END;
$$ LANGUAGE plpgsql;
END
