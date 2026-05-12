-- Stored Procedure: sp_site_flow_mappings_list
-- Purpose: List all flow mappings for a site, optionally restricted to active only
-- Parameters:
--   i_site_id:     sites.id
--   i_active_only: if TRUE, return only rows where is_active = TRUE
-- Returns: o_id, o_flow_key, o_flow_name, o_implementation, o_config_json,
--          o_is_active, o_sort_order, o_notes, o_created_date, o_updated_date

CREATE OR REPLACE FUNCTION sp_site_flow_mappings_list(
    i_site_id     INTEGER,
    i_active_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    o_id             INTEGER,
    o_flow_key       VARCHAR(100),
    o_flow_name      VARCHAR(255),
    o_implementation VARCHAR(50),
    o_config_json    JSONB,
    o_is_active      BOOLEAN,
    o_sort_order     INTEGER,
    o_notes          TEXT,
    o_created_date   TIMESTAMP WITH TIME ZONE,
    o_updated_date   TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sfm.id,
        sfm.flow_key,
        sfm.flow_name,
        sfm.implementation,
        sfm.config_json,
        sfm.is_active,
        sfm.sort_order,
        sfm.notes,
        sfm.created_date,
        sfm.updated_date
    FROM site_flow_mappings sfm
    WHERE sfm.site_id = i_site_id
      AND (NOT i_active_only OR sfm.is_active = TRUE)
    ORDER BY sfm.sort_order, sfm.flow_key;
END;
$$;
