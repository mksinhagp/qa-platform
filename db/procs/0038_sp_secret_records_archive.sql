BEGIN
-- Stored Procedure 0038: Archive secret record (soft delete)
CREATE OR REPLACE FUNCTION sp_secret_records_archive(
    i_id INTEGER,
    i_updated_by VARCHAR
)
RETURNS TABLE (
    o_success BOOLEAN
) AS $$
BEGIN
    UPDATE secret_records
    SET is_active = FALSE, updated_date = CURRENT_TIMESTAMP, updated_by = i_updated_by
    WHERE id = i_id;
    
    RETURN QUERY SELECT FOUND AS o_success;
END;
$$ LANGUAGE plpgsql;
END
