-- Stored Procedure: sp_site_flow_mappings_insert
-- Purpose: Insert or update a site flow mapping (upsert on site_id + flow_key)
-- Parameters:
--   i_site_id:        sites.id
--   i_flow_key:       canonical flow key (register, login, checkout, etc.)
--   i_flow_name:      human-readable display name
--   i_implementation: 'template' | 'custom' | 'config_driven'
--   i_config_json:    optional JSONB implementation config
--   i_is_active:      whether the flow mapping is active
--   i_sort_order:     display/execution order
--   i_notes:          optional notes
--   i_created_by:     operator login or 'system'
-- Returns: o_id, o_flow_key, o_flow_name

CREATE OR REPLACE FUNCTION sp_site_flow_mappings_insert(
    i_site_id        INTEGER,
    i_flow_key       VARCHAR(100),
    i_flow_name      VARCHAR(255),
    i_implementation VARCHAR(50) DEFAULT 'template',
    i_config_json    JSONB DEFAULT NULL,
    i_is_active      BOOLEAN DEFAULT TRUE,
    i_sort_order     INTEGER DEFAULT 0,
    i_notes          TEXT DEFAULT NULL,
    i_created_by     VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id        INTEGER,
    o_flow_key  VARCHAR(100),
    o_flow_name VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO site_flow_mappings (
        site_id, flow_key, flow_name, implementation, config_json,
        is_active, sort_order, notes, created_by, updated_by
    ) VALUES (
        i_site_id, i_flow_key, i_flow_name, i_implementation, i_config_json,
        i_is_active, i_sort_order, i_notes, i_created_by, i_created_by
    )
    ON CONFLICT (site_id, flow_key)
    DO UPDATE SET
        flow_name      = EXCLUDED.flow_name,
        implementation = EXCLUDED.implementation,
        config_json    = COALESCE(EXCLUDED.config_json, site_flow_mappings.config_json),
        is_active      = EXCLUDED.is_active,
        sort_order     = EXCLUDED.sort_order,
        notes          = COALESCE(EXCLUDED.notes, site_flow_mappings.notes),
        updated_date   = CURRENT_TIMESTAMP,
        updated_by     = i_created_by
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_flow_key, i_flow_name;
END;
$$;
