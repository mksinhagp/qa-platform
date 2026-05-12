BEGIN
-- Stored Procedure 0197: List campaign scenarios
CREATE OR REPLACE FUNCTION sp_campaign_scenarios_list(
    i_campaign_id INTEGER,
    i_is_active BOOLEAN DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_campaign_id INTEGER,
    o_persona_id INTEGER,
    o_device_profile_id INTEGER,
    o_network_profile_id INTEGER,
    o_browser_type VARCHAR(50),
    o_payment_scenario_id INTEGER,
    o_email_provider_id INTEGER,
    o_flow_type VARCHAR(50),
    o_scenario_hash VARCHAR(255),
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        campaign_id AS o_campaign_id,
        persona_id AS o_persona_id,
        device_profile_id AS o_device_profile_id,
        network_profile_id AS o_network_profile_id,
        browser_type AS o_browser_type,
        payment_scenario_id AS o_payment_scenario_id,
        email_provider_id AS o_email_provider_id,
        flow_type AS o_flow_type,
        scenario_hash AS o_scenario_hash,
        is_active AS o_is_active,
        created_date AS o_created_date
    FROM campaign_scenarios
    WHERE
        campaign_id = i_campaign_id
        AND (i_is_active IS NULL OR is_active = i_is_active)
    ORDER BY created_date ASC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
