-- Stored Procedure: sp_email_template_assertions_list
-- Purpose: List all assertion rules for a site, optionally filtered by email_type
CREATE OR REPLACE FUNCTION sp_email_template_assertions_list(
    i_site_id INTEGER,
    i_email_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_type VARCHAR(50),
    o_assertion_name VARCHAR(255),
    o_assertion_type VARCHAR(50),
    o_expected_value TEXT,
    o_is_regex BOOLEAN,
    o_is_required BOOLEAN,
    o_sort_order INTEGER,
    o_notes TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        eta.id, eta.email_type, eta.assertion_name, eta.assertion_type,
        eta.expected_value, eta.is_regex, eta.is_required, eta.sort_order,
        eta.notes, eta.created_date
    FROM email_template_assertions eta
    WHERE eta.site_id = i_site_id
      AND (i_email_type IS NULL OR eta.email_type = i_email_type)
    ORDER BY eta.email_type, eta.sort_order, eta.assertion_name;
END;
$$;
