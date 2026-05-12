BEGIN
-- Stored Procedure 0191: Insert data redaction rule
CREATE OR REPLACE FUNCTION sp_data_redaction_rules_insert(
    i_field_name VARCHAR,
    i_field_type VARCHAR,
    i_redaction_pattern VARCHAR,
    i_replacement_pattern VARCHAR DEFAULT '***',
    i_applies_to_tables TEXT[],
    i_priority INTEGER DEFAULT 100,
    i_description TEXT DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_field_name VARCHAR,
    o_field_type VARCHAR,
    o_priority INTEGER,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO data_redaction_rules (
        field_name, field_type, redaction_pattern, replacement_pattern,
        applies_to_tables, priority, description,
        created_by, updated_by
    )
    VALUES (
        i_field_name, i_field_type, i_redaction_pattern, i_replacement_pattern,
        i_applies_to_tables, i_priority, i_description,
        i_created_by, i_created_by
    )
    ON CONFLICT (field_name, field_type)
    DO UPDATE SET
        redaction_pattern = COALESCE(EXCLUDED.redaction_pattern, data_redaction_rules.redaction_pattern),
        replacement_pattern = COALESCE(EXCLUDED.replacement_pattern, data_redaction_rules.replacement_pattern),
        applies_to_tables = COALESCE(EXCLUDED.applies_to_tables, data_redaction_rules.applies_to_tables),
        priority = COALESCE(EXCLUDED.priority, data_redaction_rules.priority),
        description = COALESCE(EXCLUDED.description, data_redaction_rules.description),
        updated_by = i_created_by,
        updated_date = CURRENT_TIMESTAMP
    RETURNING
        id AS o_id,
        field_name AS o_field_name,
        field_type AS o_field_type,
        priority AS o_priority,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
