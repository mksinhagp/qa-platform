-- Stored Procedure: sp_site_rules_versions_list
-- Purpose: List all rules versions for a site, newest first
-- Parameters:
--   i_site_id: sites.id
-- Returns: o_id, o_version, o_is_active, o_published_at, o_notes, o_created_date

CREATE OR REPLACE FUNCTION sp_site_rules_versions_list(
    i_site_id INTEGER
)
RETURNS TABLE (
    o_id          INTEGER,
    o_version     INTEGER,
    o_is_active   BOOLEAN,
    o_published_at TIMESTAMP WITH TIME ZONE,
    o_notes       TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        srv.id,
        srv.version,
        srv.is_active,
        srv.published_at,
        srv.notes,
        srv.created_date
    FROM site_rules_versions srv
    WHERE srv.site_id = i_site_id
    ORDER BY srv.version DESC;
END;
$$;
