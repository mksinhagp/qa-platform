BEGIN
-- Stored Procedure 0174: Update payment scenario
CREATE OR REPLACE FUNCTION sp_payment_scenarios_update(
    i_id INTEGER,
    i_name VARCHAR DEFAULT NULL,
    i_scenario_type VARCHAR DEFAULT NULL,
    i_expected_result VARCHAR DEFAULT NULL,
    i_description TEXT DEFAULT NULL,
    i_test_card_number VARCHAR DEFAULT NULL,
    i_test_cvv VARCHAR DEFAULT NULL,
    i_test_expiry_month INTEGER DEFAULT NULL,
    i_test_expiry_year INTEGER DEFAULT NULL,
    i_test_amount DECIMAL DEFAULT NULL,
    i_avs_zip_code VARCHAR DEFAULT NULL,
    i_avs_address VARCHAR DEFAULT NULL,
    i_expected_response_code VARCHAR DEFAULT NULL,
    i_expected_response_reason VARCHAR DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_updated_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_scenario_type VARCHAR,
    o_expected_result VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    UPDATE payment_scenarios
    SET
        name = COALESCE(i_name, name),
        scenario_type = COALESCE(i_scenario_type, scenario_type),
        expected_result = COALESCE(i_expected_result, expected_result),
        description = COALESCE(i_description, description),
        test_card_number = COALESCE(i_test_card_number, test_card_number),
        test_cvv = COALESCE(i_test_cvv, test_cvv),
        test_expiry_month = COALESCE(i_test_expiry_month, test_expiry_month),
        test_expiry_year = COALESCE(i_test_expiry_year, test_expiry_year),
        test_amount = COALESCE(i_test_amount, test_amount),
        avs_zip_code = COALESCE(i_avs_zip_code, avs_zip_code),
        avs_address = COALESCE(i_avs_address, avs_address),
        expected_response_code = COALESCE(i_expected_response_code, expected_response_code),
        expected_response_reason = COALESCE(i_expected_response_reason, expected_response_reason),
        is_active = COALESCE(i_is_active, is_active),
        updated_by = i_updated_by,
        updated_date = CURRENT_TIMESTAMP
    WHERE id = i_id
    RETURNING
        id AS o_id,
        name AS o_name,
        scenario_type AS o_scenario_type,
        expected_result AS o_expected_result,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
