BEGIN
-- Stored Procedure 0199: Insert campaign execution
CREATE OR REPLACE FUNCTION sp_campaign_executions_insert(
    i_campaign_id INTEGER,
    i_run_id INTEGER DEFAULT NULL,
    i_execution_type VARCHAR,
    i_triggered_by VARCHAR,
    i_triggered_by_operator_id INTEGER DEFAULT NULL,
    i_approval_id INTEGER DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_campaign_id INTEGER,
    o_execution_type VARCHAR,
    o_status VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO campaign_executions (
        campaign_id, run_id, execution_type, triggered_by,
        triggered_by_operator_id, approval_id,
        status, created_by, updated_by
    )
    VALUES (
        i_campaign_id, i_run_id, i_execution_type, i_triggered_by,
        i_triggered_by_operator_id, i_approval_id,
        'pending', i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        campaign_id AS o_campaign_id,
        execution_type AS o_execution_type,
        status AS o_status,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
