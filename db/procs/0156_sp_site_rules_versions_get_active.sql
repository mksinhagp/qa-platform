-- Stored Procedure: sp_site_rules_versions_get_active
-- Purpose: Get the currently active rules version for a site, including the full rules_json.
--          Returns zero rows if no active version exists.
-- Parameters:
--   i_site_id: sites.id
-- Returns: o_id, o_version, o_rules_json, o_published_at, o_notes

CREATE OR REPLACE FUNCTION sp_site_rules_versions_get_active(
    i_site_id INTEGER
)
RETURNS TABLE (
    o_id           INTEGER,
    o_version      INTEGER,
    o_rules_json   JSONB,
    o_published_at TIMESTAMP WITH TIME ZONE,
    o_notes        TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        srv.id,
        srv.version,
        srv.rules_json,
        srv.published_at,
        srv.notes
    FROM site_rules_versions srv
    WHERE srv.site_id  = i_site_id
      AND srv.is_active = TRUE
    LIMIT 1;
END;
$$;
