BEGIN
-- Stored Procedure 0202: Upsert payment transaction (idempotent via idempotency_key)
-- On conflict (same idempotency_key), update the existing row with the latest values.
-- This prevents duplicate rows when the runner retries a callback that succeeded on
-- the server but whose HTTP response was lost.
CREATE OR REPLACE FUNCTION sp_payment_transactions_upsert(
    i_idempotency_key VARCHAR,
    i_run_execution_id INTEGER,
    i_site_id INTEGER,
    i_site_environment_id INTEGER,
    i_persona_id INTEGER DEFAULT NULL,
    i_payment_provider_id INTEGER DEFAULT NULL,
    i_payment_profile_id INTEGER DEFAULT NULL,
    i_payment_scenario_id INTEGER DEFAULT NULL,
    i_transaction_type VARCHAR,
    i_amount DECIMAL,
    i_currency VARCHAR DEFAULT 'USD',
    i_provider_transaction_id VARCHAR DEFAULT NULL,
    i_provider_response_code VARCHAR DEFAULT NULL,
    i_provider_response_reason VARCHAR DEFAULT NULL,
    i_provider_response_text TEXT DEFAULT NULL,
    i_status VARCHAR DEFAULT 'pending',
    i_ui_confirmation TEXT DEFAULT NULL,
    i_email_receipt_verified BOOLEAN DEFAULT FALSE,
    i_email_receipt_details TEXT DEFAULT NULL,
    i_admin_reconciled BOOLEAN DEFAULT FALSE,
    i_admin_reconciliation_details TEXT DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_redacted_card_number VARCHAR DEFAULT NULL,
    i_redacted_cvv VARCHAR DEFAULT NULL,
    i_test_data_generated BOOLEAN DEFAULT FALSE,
    i_test_data_cleanup_status VARCHAR DEFAULT 'pending',
    i_approval_id INTEGER DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_run_execution_id INTEGER,
    o_site_id INTEGER,
    o_transaction_type VARCHAR,
    o_amount DECIMAL,
    o_status VARCHAR,
    o_provider_transaction_id VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO payment_transactions (
        idempotency_key,
        run_execution_id, site_id, site_environment_id, persona_id,
        payment_provider_id, payment_profile_id, payment_scenario_id,
        transaction_type, amount, currency,
        provider_transaction_id, provider_response_code, provider_response_reason, provider_response_text,
        status, ui_confirmation, email_receipt_verified, email_receipt_details,
        admin_reconciled, admin_reconciliation_details,
        error_message, redacted_card_number, redacted_cvv,
        test_data_generated, test_data_cleanup_status, approval_id,
        created_by, updated_by
    )
    VALUES (
        i_idempotency_key,
        i_run_execution_id, i_site_id, i_site_environment_id, i_persona_id,
        i_payment_provider_id, i_payment_profile_id, i_payment_scenario_id,
        i_transaction_type, i_amount, i_currency,
        i_provider_transaction_id, i_provider_response_code, i_provider_response_reason, i_provider_response_text,
        i_status, i_ui_confirmation, i_email_receipt_verified, i_email_receipt_details,
        i_admin_reconciled, i_admin_reconciliation_details,
        i_error_message, i_redacted_card_number, i_redacted_cvv,
        i_test_data_generated, i_test_data_cleanup_status, i_approval_id,
        i_created_by, i_created_by
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
    DO UPDATE SET
        status = EXCLUDED.status,
        provider_transaction_id = EXCLUDED.provider_transaction_id,
        provider_response_code = EXCLUDED.provider_response_code,
        provider_response_reason = EXCLUDED.provider_response_reason,
        provider_response_text = EXCLUDED.provider_response_text,
        ui_confirmation = EXCLUDED.ui_confirmation,
        email_receipt_verified = EXCLUDED.email_receipt_verified,
        email_receipt_details = EXCLUDED.email_receipt_details,
        admin_reconciled = EXCLUDED.admin_reconciled,
        admin_reconciliation_details = EXCLUDED.admin_reconciliation_details,
        error_message = EXCLUDED.error_message,
        updated_by = EXCLUDED.updated_by,
        updated_date = CURRENT_TIMESTAMP
    RETURNING
        id AS o_id,
        run_execution_id AS o_run_execution_id,
        site_id AS o_site_id,
        transaction_type AS o_transaction_type,
        amount AS o_amount,
        status AS o_status,
        provider_transaction_id AS o_provider_transaction_id,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
