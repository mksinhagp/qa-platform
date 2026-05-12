-- Stored Procedure: sp_email_template_assertions_insert
-- Purpose: Insert or update an email template assertion rule for a site/email_type
CREATE OR REPLACE FUNCTION sp_email_template_assertions_insert(
    i_site_id INTEGER,
    i_email_type VARCHAR(50),
    i_assertion_name VARCHAR(255),
    i_assertion_type VARCHAR(50),
    i_expected_value TEXT DEFAULT NULL,
    i_is_regex BOOLEAN DEFAULT FALSE,
    i_is_required BOOLEAN DEFAULT TRUE,
    i_sort_order INTEGER DEFAULT 0,
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_type VARCHAR(50),
    o_assertion_name VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_template_assertions (
        site_id, email_type, assertion_name, assertion_type,
        expected_value, is_regex, is_required, sort_order,
        notes, created_by, updated_by
    ) VALUES (
        i_site_id, i_email_type, i_assertion_name, i_assertion_type,
        i_expected_value, i_is_regex, i_is_required, i_sort_order,
        i_notes, i_created_by, i_created_by
    )
    ON CONFLICT (site_id, email_type, assertion_name)
    DO UPDATE SET
        assertion_type = EXCLUDED.assertion_type,
        expected_value = EXCLUDED.expected_value,
        is_regex = EXCLUDED.is_regex,
        is_required = EXCLUDED.is_required,
        sort_order = EXCLUDED.sort_order,
        notes = COALESCE(EXCLUDED.notes, email_template_assertions.notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_created_by
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_email_type, i_assertion_name;
END;
$$;
