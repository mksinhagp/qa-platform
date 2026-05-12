BEGIN
-- Stored Procedure 0171: Insert payment scenario
CREATE OR REPLACE FUNCTION sp_payment_scenarios_insert(
    i_name VARCHAR,
    i_scenario_type VARCHAR,
    i_expected_result VARCHAR,
    i_description TEXT DEFAULT NULL,
    i_test_card_number VARCHAR DEFAULT NULL,
    i_test_cvv VARCHAR DEFAULT NULL,
    i_test_expiry_month INTEGER DEFAULT NULL,
    i_test_expiry_year INTEGER DEFAULT NULL,
    i_test_amount DECIMAL DEFAULT 1.00,
    i_avs_zip_code VARCHAR DEFAULT NULL,
    i_avs_address VARCHAR DEFAULT NULL,
    i_expected_response_code VARCHAR DEFAULT NULL,
    i_expected_response_reason VARCHAR DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
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
    INSERT INTO payment_scenarios (
        name, scenario_type, expected_result, description,
        test_card_number, test_cvv, test_expiry_month, test_expiry_year,
        test_amount, avs_zip_code, avs_address,
        expected_response_code, expected_response_reason,
        created_by, updated_by
    )
    VALUES (
        i_name, i_scenario_type, i_expected_result, i_description,
        i_test_card_number, i_test_cvv, i_test_expiry_month, i_test_expiry_year,
        i_test_amount, i_avs_zip_code, i_avs_address,
        i_expected_response_code, i_expected_response_reason,
        i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        name AS o_name,
        scenario_type AS o_scenario_type,
        expected_result AS o_expected_result,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
