BEGIN
-- Stored Procedure 0193: Insert QA campaign
CREATE OR REPLACE FUNCTION sp_qa_campaigns_insert(
    i_name VARCHAR,
    i_campaign_type VARCHAR,
    i_description TEXT DEFAULT NULL,
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL,
    i_persona_ids INTEGER[] DEFAULT NULL,
    i_device_profile_ids INTEGER[] DEFAULT NULL,
    i_network_profile_ids INTEGER[] DEFAULT NULL,
    i_browser_types VARCHAR(50)[] DEFAULT NULL,
    i_payment_scenario_ids INTEGER[] DEFAULT NULL,
    i_email_provider_ids INTEGER[] DEFAULT NULL,
    i_flow_types VARCHAR(50)[] DEFAULT NULL,
    i_concurrency_cap INTEGER DEFAULT 5,
    i_retry_on_failure BOOLEAN DEFAULT FALSE,
    i_max_retries INTEGER DEFAULT 1,
    i_requires_approval BOOLEAN DEFAULT FALSE,
    i_approval_policy_id INTEGER DEFAULT NULL,
    i_created_by VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_campaign_type VARCHAR,
    o_created_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO qa_campaigns (
        name, campaign_type, description,
        site_id, site_environment_id,
        persona_ids, device_profile_ids, network_profile_ids,
        browser_types, payment_scenario_ids, email_provider_ids, flow_types,
        concurrency_cap, retry_on_failure, max_retries,
        requires_approval, approval_policy_id,
        created_by, updated_by
    )
    VALUES (
        i_name, i_campaign_type, i_description,
        i_site_id, i_site_environment_id,
        i_persona_ids, i_device_profile_ids, i_network_profile_ids,
        i_browser_types, i_payment_scenario_ids, i_email_provider_ids, i_flow_types,
        i_concurrency_cap, i_retry_on_failure, i_max_retries,
        i_requires_approval, i_approval_policy_id,
        i_created_by, i_created_by
    )
    RETURNING
        id AS o_id,
        name AS o_name,
        campaign_type AS o_campaign_type,
        created_date AS o_created_date;
END;
$$ LANGUAGE plpgsql;
END
