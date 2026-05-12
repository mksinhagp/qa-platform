BEGIN
-- ============================================================
-- Stored Procedure: 0127_sp_artifact_retention_config_list
-- Phase 11.1: Retention enforcement audits and cleanup
--
-- Purpose: List all artifact retention configuration rows.
--   Used by the dashboard to populate the Retention Config table
--   and allow inline editing of retention_days per artifact type.
--
-- Returns: One row per artifact_retention_config entry, ordered by
--   artifact_type ascending.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_artifact_retention_config_list()
RETURNS TABLE(
    o_id             INTEGER,
    o_artifact_type  VARCHAR(50),
    o_retention_days INTEGER,
    o_is_active      BOOLEAN,
    o_notes          TEXT,
    o_updated_date   TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        arc.id             AS o_id,
        arc.artifact_type  AS o_artifact_type,
        arc.retention_days AS o_retention_days,
        arc.is_active      AS o_is_active,
        arc.notes          AS o_notes,
        arc.updated_date   AS o_updated_date
    FROM artifact_retention_config arc
    ORDER BY arc.artifact_type;
END;
$$;

END;
