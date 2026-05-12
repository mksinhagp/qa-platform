BEGIN
-- ============================================================
-- Stored Procedure: 0123_sp_artifacts_list_expired
-- Phase 11.1: Retention enforcement audits and cleanup
--
-- Purpose: List artifact records whose retention window has elapsed.
--   An artifact is considered expired when:
--     (a) retention_date IS NOT NULL AND retention_date < NOW(), OR
--     (b) retention_date IS NULL AND the artifact_retention_config for its type
--         is active and (created_date + retention_days) < NOW()
--
-- Parameters:
--   i_limit  INTEGER  Maximum rows to return (default 500, safety cap)
--
-- Returns: One row per expired artifact with fields needed by the cleanup job.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_artifacts_list_expired(
    i_limit INTEGER DEFAULT 500
)
RETURNS TABLE(
    o_id                INTEGER,
    o_run_execution_id  INTEGER,
    o_artifact_type     VARCHAR(50),
    o_file_path         VARCHAR(512),
    o_file_size_bytes   BIGINT,
    o_retention_date    TIMESTAMP WITH TIME ZONE,
    o_created_date      TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id                  AS o_id,
        a.run_execution_id    AS o_run_execution_id,
        a.artifact_type       AS o_artifact_type,
        a.file_path           AS o_file_path,
        a.file_size_bytes     AS o_file_size_bytes,
        a.retention_date      AS o_retention_date,
        a.created_date        AS o_created_date
    FROM artifacts a
    -- Left-join so we can fall back to config-based expiry when retention_date is NULL
    LEFT JOIN artifact_retention_config arc
           ON arc.artifact_type = a.artifact_type
          AND arc.is_active = TRUE
    WHERE
        -- Case (a): explicit retention_date already passed
        (a.retention_date IS NOT NULL AND a.retention_date < NOW())
        OR
        -- Case (b): no explicit date but config-driven expiry has passed
        (a.retention_date IS NULL
         AND arc.id IS NOT NULL
         AND (a.created_date + (arc.retention_days || ' days')::INTERVAL) < NOW())
    ORDER BY a.created_date ASC
    LIMIT i_limit;
END;
$$;

END;
