-- Stored Procedure: sp_site_capabilities_insert
-- Purpose: Insert or update a site capability (upsert on site_id + capability_key)
-- Parameters:
--   i_site_id:        sites.id
--   i_capability_key: capability identifier
--   i_is_enabled:     whether the capability is active
--   i_config_json:    optional JSONB configuration
--   i_notes:          optional notes
--   i_created_by:     operator login or 'system'
-- Returns: o_id, o_capability_key, o_is_enabled

CREATE OR REPLACE FUNCTION sp_site_capabilities_insert(
    i_site_id        INTEGER,
    i_capability_key VARCHAR(100),
    i_is_enabled     BOOLEAN DEFAULT TRUE,
    i_config_json    JSONB DEFAULT NULL,
    i_notes          TEXT DEFAULT NULL,
    i_created_by     VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id             INTEGER,
    o_capability_key VARCHAR(100),
    o_is_enabled     BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id      INTEGER;
    v_enabled BOOLEAN;
BEGIN
    INSERT INTO site_capabilities (
        site_id, capability_key, is_enabled, config_json, notes,
        created_by, updated_by
    ) VALUES (
        i_site_id, i_capability_key, i_is_enabled, i_config_json, i_notes,
        i_created_by, i_created_by
    )
    ON CONFLICT (site_id, capability_key)
    DO UPDATE SET
        is_enabled   = EXCLUDED.is_enabled,
        config_json  = COALESCE(EXCLUDED.config_json, site_capabilities.config_json),
        notes        = COALESCE(EXCLUDED.notes, site_capabilities.notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by   = i_created_by
    RETURNING id, is_enabled INTO v_id, v_enabled;

    RETURN QUERY SELECT v_id, i_capability_key, v_enabled;
END;
$$;
