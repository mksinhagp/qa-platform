-- Stored Procedure: sp_site_rules_versions_insert
-- Purpose: Insert a new site rules version with auto-incremented version number.
--          If i_is_active = TRUE, all other active versions for the site are
--          deactivated before the new row is inserted.
-- Parameters:
--   i_site_id:    sites.id
--   i_rules_json: full rules document as JSONB
--   i_is_active:  whether to activate this version immediately
--   i_notes:      optional release notes
--   i_created_by: operator login or 'system'
-- Returns: o_id, o_version, o_is_active

CREATE OR REPLACE FUNCTION sp_site_rules_versions_insert(
    i_site_id    INTEGER,
    i_rules_json JSONB,
    i_is_active  BOOLEAN DEFAULT FALSE,
    i_notes      TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id        INTEGER,
    o_version   INTEGER,
    o_is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id      INTEGER;
    v_version INTEGER;
BEGIN
    -- Derive next sequential version number for this site
    SELECT COALESCE(MAX(version), 0) + 1
      INTO v_version
      FROM site_rules_versions
     WHERE site_id = i_site_id;

    -- Deactivate all current active versions before activating the new one
    IF i_is_active THEN
        UPDATE site_rules_versions
           SET is_active    = FALSE,
               updated_date = CURRENT_TIMESTAMP,
               updated_by   = i_created_by
         WHERE site_id  = i_site_id
           AND is_active = TRUE;
    END IF;

    INSERT INTO site_rules_versions (
        site_id, version, rules_json, is_active, published_at,
        notes, created_by, updated_by
    ) VALUES (
        i_site_id,
        v_version,
        i_rules_json,
        i_is_active,
        CASE WHEN i_is_active THEN CURRENT_TIMESTAMP ELSE NULL END,
        i_notes,
        i_created_by,
        i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, v_version, i_is_active;
END;
$$;
