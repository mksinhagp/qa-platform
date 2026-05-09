BEGIN
-- Stored Procedure 0041: Insert secret access log
CREATE OR REPLACE FUNCTION sp_secret_access_logs_insert(
    i_secret_id INTEGER,
    i_operator_id INTEGER,
    i_operator_session_id INTEGER DEFAULT NULL,
    i_access_type VARCHAR,
    i_access_reason TEXT DEFAULT NULL,
    i_run_execution_id INTEGER DEFAULT NULL,
    i_ip_address INET DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO secret_access_logs (
        secret_id, operator_id, operator_session_id,
        access_type, access_reason, run_execution_id,
        ip_address, created_by
    )
    VALUES (
        i_secret_id, i_operator_id, i_operator_session_id,
        i_access_type, i_access_reason, i_run_execution_id,
        i_ip_address, i_created_by
    )
    RETURNING
        id AS o_id,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
