BEGIN
-- ============================================================
-- Stored Procedure: 0128_sp_artifact_retention_config_update
-- Phase 11.1: Retention enforcement audits and cleanup
--
-- Purpose: Update the retention_days (and optional notes) for a given
--   artifact type. Called from the dashboard inline editor and via
--   API when an operator adjusts retention policy.
--
-- Parameters:
--   i_artifact_type  VARCHAR(50)   Must match an existing config row
--   i_retention_days INTEGER       New retention window in days (>= 1)
--   i_notes          TEXT          Optional notes / reason for change
--   i_updated_by     VARCHAR(255)  Audit updater (default 'system')
--
-- Returns: o_id, o_artifact_type, o_retention_days, o_updated_date
--   Returns no rows if artifact_type is not found.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_artifact_retention_config_update(
    i_artifact_type  VARCHAR(50),
    i_retention_days INTEGER,
    i_notes          TEXT DEFAULT NULL,
    i_updated_by     VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id             INTEGER,
    o_artifact_type  VARCHAR(50),
    o_retention_days INTEGER,
    o_updated_date   TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE artifact_retention_config
       SET retention_days = i_retention_days,
           -- NULL means "leave notes unchanged"; empty string '' means "clear notes to NULL"
           notes          = CASE
                                WHEN i_notes IS NULL     THEN notes   -- unchanged
                                WHEN i_notes = ''        THEN NULL    -- explicit clear
                                ELSE i_notes                          -- new value
                            END,
           updated_date   = CURRENT_TIMESTAMP,
           updated_by     = i_updated_by
     WHERE artifact_type  = i_artifact_type
    RETURNING id, artifact_type, retention_days, updated_date;
END;
$$;

END;
