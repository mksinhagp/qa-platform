-- Stored Procedure: sp_site_flow_mappings_update
-- Purpose: Update a site flow mapping by id (partial update; NULL = leave unchanged)
-- Parameters:
--   i_id:             site_flow_mappings.id
--   i_flow_name:      new display name (NULL = leave unchanged)
--   i_implementation: new implementation type (NULL = leave unchanged)
--   i_config_json:    new config JSONB (NULL = leave unchanged)
--   i_is_active:      active flag (NULL = leave unchanged)
--   i_sort_order:     display order (NULL = leave unchanged)
--   i_notes:          notes (NULL = leave unchanged)
--   i_updated_by:     operator login or 'system'
-- Returns: o_id, o_flow_key, o_flow_name

CREATE OR REPLACE FUNCTION sp_site_flow_mappings_update(
    i_id             INTEGER,
    i_flow_name      VARCHAR(255) DEFAULT NULL,
    i_implementation VARCHAR(50) DEFAULT NULL,
    i_config_json    JSONB DEFAULT NULL,
    i_is_active      BOOLEAN DEFAULT NULL,
    i_sort_order     INTEGER DEFAULT NULL,
    i_notes          TEXT DEFAULT NULL,
    i_updated_by     VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id        INTEGER,
    o_flow_key  VARCHAR(100),
    o_flow_name VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE site_flow_mappings
    SET
        flow_name      = COALESCE(i_flow_name, flow_name),
        implementation = COALESCE(i_implementation, implementation),
        config_json    = COALESCE(i_config_json, config_json),
        is_active      = COALESCE(i_is_active, is_active),
        sort_order     = COALESCE(i_sort_order, sort_order),
        notes          = COALESCE(i_notes, notes),
        updated_date   = CURRENT_TIMESTAMP,
        updated_by     = i_updated_by
    WHERE id = i_id;

    RETURN QUERY
    SELECT sfm.id, sfm.flow_key, sfm.flow_name
    FROM site_flow_mappings sfm
    WHERE sfm.id = i_id;
END;
$$;
