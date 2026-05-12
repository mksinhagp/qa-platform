BEGIN
-- Stored Procedure 0178: Update payment transaction
CREATE OR REPLACE FUNCTION sp_payment_transactions_update(
    i_id INTEGER,
    i_provider_transaction_id VARCHAR DEFAULT NULL,
    i_provider_response_code VARCHAR DEFAULT NULL,
    i_provider_response_reason VARCHAR DEFAULT NULL,
    i_provider_response_text TEXT DEFAULT NULL,
    i_status VARCHAR DEFAULT NULL,
    i_ui_confirmation TEXT DEFAULT NULL,
    i_email_receipt_verified BOOLEAN DEFAULT NULL,
    i_email_receipt_details TEXT DEFAULT NULL,
    i_admin_reconciled BOOLEAN DEFAULT NULL,
    i_admin_reconciliation_details TEXT DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_redacted_card_number VARCHAR DEFAULT NULL,
    i_redacted_cvv VARCHAR DEFAULT NULL,
    i_test_data_generated BOOLEAN DEFAULT NULL,
    i_test_data_cleanup_status VARCHAR DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_status VARCHAR,
    o_provider_transaction_id VARCHAR,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    UPDATE payment_transactions
    SET
        provider_transaction_id = COALESCE(i_provider_transaction_id, provider_transaction_id),
        provider_response_code = COALESCE(i_provider_response_code, provider_response_code),
        provider_response_reason = COALESCE(i_provider_response_reason, provider_response_reason),
        provider_response_text = COALESCE(i_provider_response_text, provider_response_text),
        status = COALESCE(i_status, status),
        ui_confirmation = COALESCE(i_ui_confirmation, ui_confirmation),
        email_receipt_verified = COALESCE(i_email_receipt_verified, email_receipt_verified),
        email_receipt_details = COALESCE(i_email_receipt_details, email_receipt_details),
        admin_reconciled = COALESCE(i_admin_reconciled, admin_reconciled),
        admin_reconciliation_details = COALESCE(i_admin_reconciliation_details, admin_reconciliation_details),
        error_message = COALESCE(i_error_message, error_message),
        redacted_card_number = COALESCE(i_redacted_card_number, redacted_card_number),
        redacted_cvv = COALESCE(i_redacted_cvv, redacted_cvv),
        test_data_generated = COALESCE(i_test_data_generated, test_data_generated),
        test_data_cleanup_status = COALESCE(i_test_data_cleanup_status, test_data_cleanup_status),
        updated_by = i_updated_by,
        updated_date = CURRENT_TIMESTAMP
    WHERE id = i_id
    RETURNING
        id AS o_id,
        status AS o_status,
        provider_transaction_id AS o_provider_transaction_id,
        updated_date AS o_updated_date;
END;
$$ LANGUAGE plpgsql;
END
