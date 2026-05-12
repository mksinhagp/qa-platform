-- Stored Procedure: sp_site_capabilities_update
-- Purpose: Update a site capability's enabled status and config
-- Parameters:
--   i_id:          site_capabilities.id
--   i_is_enabled:  new enabled status
--   i_config_json: optional new config (NULL = leave unchanged)
--   i_notes:       optional notes (NULL = leave unchanged)
--   i_updated_by:  operator login or 'system'
-- Returns: o_id, o_capability_key, o_is_enabled

CREATE OR REPLACE FUNCTION sp_site_capabilities_update(
    i_id          INTEGER,
    i_is_enabled  BOOLEAN DEFAULT TRUE,
    i_config_json JSONB DEFAULT NULL,
    i_notes       TEXT DEFAULT NULL,
    i_updated_by  VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id             INTEGER,
    o_capability_key VARCHAR(100),
    o_is_enabled     BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE site_capabilities
    SET
        is_enabled   = i_is_enabled,
        config_json  = COALESCE(i_config_json, config_json),
        notes        = COALESCE(i_notes, notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by   = i_updated_by
    WHERE id = i_id;

    RETURN QUERY
    SELECT sc.id, sc.capability_key, sc.is_enabled
    FROM site_capabilities sc
    WHERE sc.id = i_id;
END;
$$;
