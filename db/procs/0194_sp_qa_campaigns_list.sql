BEGIN
-- Stored Procedure 0194: List QA campaigns
CREATE OR REPLACE FUNCTION sp_qa_campaigns_list(
    i_campaign_type VARCHAR DEFAULT NULL,
    i_site_id INTEGER DEFAULT NULL,
    i_is_active BOOLEAN DEFAULT NULL,
    i_limit INTEGER DEFAULT 100,
    i_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    o_id INTEGER,
    o_name VARCHAR,
    o_campaign_type VARCHAR,
    o_description TEXT,
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_concurrency_cap INTEGER,
    o_requires_approval BOOLEAN,
    o_is_active BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE
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
        concurrency_cap AS o_concurrency_cap,
        requires_approval AS o_requires_approval,
        is_active AS o_is_active,
        created_date AS o_created_date
    FROM qa_campaigns
    WHERE
        (i_campaign_type IS NULL OR campaign_type = i_campaign_type)
        AND (i_site_id IS NULL OR site_id = i_site_id)
        AND (i_is_active IS NULL OR is_active = i_is_active)
    ORDER BY created_date DESC
    LIMIT i_limit OFFSET i_offset;
END;
$$ LANGUAGE plpgsql;
END
