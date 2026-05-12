BEGIN
-- Stored Procedure 0173: Get payment scenario by id
CREATE OR REPLACE FUNCTION sp_payment_scenarios_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_scenario_type VARCHAR,
    o_expected_result VARCHAR,
    o_description TEXT,
    o_test_card_number VARCHAR,
    o_test_cvv VARCHAR,
    o_test_expiry_month INTEGER,
    o_test_expiry_year INTEGER,
    o_test_amount DECIMAL,
    o_avs_zip_code VARCHAR,
    o_avs_address VARCHAR,
    o_expected_response_code VARCHAR,
    o_expected_response_reason VARCHAR,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        scenario_type AS o_scenario_type,
        expected_result AS o_expected_result,
        description AS o_description,
        test_card_number AS o_test_card_number,
        test_cvv AS o_test_cvv,
        test_expiry_month AS o_test_expiry_month,
        test_expiry_year AS o_test_expiry_year,
        test_amount AS o_test_amount,
        avs_zip_code AS o_avs_zip_code,
        avs_address AS o_avs_address,
        expected_response_code AS o_expected_response_code,
        expected_response_reason AS o_expected_response_reason,
        is_active AS o_is_active,
        created_date AS o_created_date,
        updated_date AS o_updated_date
    FROM payment_scenarios
    WHERE id = i_id;
END;
$$ LANGUAGE plpgsql;
END
