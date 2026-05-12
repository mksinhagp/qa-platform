-- Stored Procedure: sp_site_capabilities_list
-- Purpose: List all capabilities for a site
-- Parameters:
--   i_site_id: sites.id
-- Returns: o_id, o_capability_key, o_is_enabled, o_config_json, o_notes,
--          o_created_date, o_updated_date

CREATE OR REPLACE FUNCTION sp_site_capabilities_list(
    i_site_id INTEGER
)
RETURNS TABLE (
    o_id             INTEGER,
    o_capability_key VARCHAR(100),
    o_is_enabled     BOOLEAN,
    o_config_json    JSONB,
    o_notes          TEXT,
    o_created_date   TIMESTAMP WITH TIME ZONE,
    o_updated_date   TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.capability_key,
        sc.is_enabled,
        sc.config_json,
        sc.notes,
        sc.created_date,
        sc.updated_date
    FROM site_capabilities sc
    WHERE sc.site_id = i_site_id
    ORDER BY sc.capability_key;
END;
$$;
