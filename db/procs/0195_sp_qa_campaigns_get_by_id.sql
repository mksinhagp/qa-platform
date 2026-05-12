BEGIN
-- Stored Procedure 0195: Get QA campaign by id
CREATE OR REPLACE FUNCTION sp_qa_campaigns_get_by_id(
    i_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_campaign_type VARCHAR,
    o_description TEXT,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_persona_ids INTEGER[],
    o_device_profile_ids INTEGER[],
    o_network_profile_ids INTEGER[],
    o_browser_types VARCHAR(50)[],
    o_payment_scenario_ids INTEGER[],
    o_email_provider_ids INTEGER[],
    o_flow_types VARCHAR(50)[],
    o_concurrency_cap INTEGER,
    o_retry_on_failure BOOLEAN,
    o_max_retries INTEGER,
    o_requires_approval BOOLEAN,
    o_approval_policy_id INTEGER,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS o_id,
        name AS o_name,
        campaign_type AS o_campaign_type,
        description AS o_description,
        site_id AS o_site_id,
        site_environment_id AS o_site_environment_id,
        persona_ids AS o_persona_ids,
        device_profile_ids AS o_device_profile_ids,
        network_profile_ids AS o_network_profile_ids,
        browser_types AS o_browser_types,
        payment_scenario_ids AS o_payment_scenario_ids,
        email_provider_ids AS o_email_provider_ids,
        flow_types AS o_flow_types,
        concurrency_cap AS o_concurrency_cap,
        retry_on_failure AS o_retry_on_failure,
        max_retries AS o_max_retries,
        requires_approval AS o_requires_approval,
        approval_policy_id AS o_approval_policy_id,
        is_active AS o_is_active,
        created_date AS o_created_date,
        updated_date AS o_updated_date
    FROM qa_campaigns
    WHERE id = i_id;
END;
$$ LANGUAGE plpgsql;
END
