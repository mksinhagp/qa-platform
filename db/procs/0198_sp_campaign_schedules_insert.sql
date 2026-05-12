BEGIN
-- Stored Procedure 0198: Insert campaign schedule
CREATE OR REPLACE FUNCTION sp_campaign_schedules_insert(
    i_campaign_id INTEGER,
    i_schedule_type VARCHAR,
    i_schedule_config JSONB DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_campaign_id INTEGER,
    o_schedule_type VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO campaign_schedules (
        campaign_id, schedule_type, schedule_config,
        created_by, updated_by
    )
    VALUES (
        i_campaign_id, i_schedule_type, i_schedule_config,
        i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        campaign_id AS o_campaign_id,
        schedule_type AS o_schedule_type,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
