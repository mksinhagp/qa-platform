BEGIN
-- Stored Procedure 0172: List payment scenarios
CREATE OR REPLACE FUNCTION sp_payment_scenarios_list(
    i_scenario_type VARCHAR DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_scenario_type VARCHAR,
    o_expected_result VARCHAR,
    o_description TEXT,
    o_test_amount DECIMAL,
    o_expected_response_code VARCHAR,
    o_expected_response_reason VARCHAR,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        scenario_type AS o_scenario_type,
        expected_result AS o_expected_result,
        description AS o_description,
        test_amount AS o_test_amount,
        expected_response_code AS o_expected_response_code,
        expected_response_reason AS o_expected_response_reason,
        is_active AS o_is_active,
        created_date AS o_created_date
    FROM payment_scenarios
    WHERE
        (i_scenario_type IS NULL OR scenario_type = i_scenario_type)
        AND (i_is_active IS NULL OR is_active = i_is_active)
    ORDER BY scenario_type, name;
END;
$$ LANGUAGE plpgsql;
END
