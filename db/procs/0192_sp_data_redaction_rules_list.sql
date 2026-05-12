BEGIN
-- Stored Procedure 0192: List data redaction rules
CREATE OR REPLACE FUNCTION sp_data_redaction_rules_list(
    i_field_type VARCHAR DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_field_name VARCHAR,
    o_field_type VARCHAR,
    o_redaction_pattern VARCHAR,
    o_replacement_pattern VARCHAR,
    o_applies_to_tables TEXT[],
    o_priority INTEGER,
    o_is_active BOOLEAN,
    o_description TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        field_name AS o_field_name,
        field_type AS o_field_type,
        redaction_pattern AS o_redaction_pattern,
        replacement_pattern AS o_replacement_pattern,
        applies_to_tables AS o_applies_to_tables,
        priority AS o_priority,
        is_active AS o_is_active,
        description AS o_description,
        created_date AS o_created_date
    FROM data_redaction_rules
    WHERE
        (i_field_type IS NULL OR field_type = i_field_type)
        AND (i_is_active IS NULL OR is_active = i_is_active)
    ORDER BY priority DESC, field_name;
END;
$$ LANGUAGE plpgsql;
END
