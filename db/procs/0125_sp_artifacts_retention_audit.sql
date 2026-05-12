BEGIN
-- ============================================================
-- Stored Procedure: 0125_sp_artifacts_retention_audit
-- Phase 11.1: Retention enforcement audits and cleanup
--
-- Purpose: Return a per-artifact-type audit summary for the dashboard.
--   Shows total count, expired count, total disk usage, oldest record
--   date, and the configured retention window (in days).
--
-- Returns: One summary row per artifact type found in the artifacts table.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_artifacts_retention_audit()
RETURNS TABLE(
    o_artifact_type   VARCHAR(50),
    o_total_count     BIGINT,
    o_expired_count   BIGINT,
    o_total_size_bytes BIGINT,
    o_oldest_artifact TIMESTAMP WITH TIME ZONE,
    o_retention_days  INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.artifact_type                                        AS o_artifact_type,
        COUNT(*)                                               AS o_total_count,

        -- Expired = explicit date passed OR config-driven expiry passed
        COUNT(*) FILTER (WHERE
            (a.retention_date IS NOT NULL AND a.retention_date < NOW())
            OR
            (a.retention_date IS NULL
             AND arc.id IS NOT NULL
             AND arc.is_active = TRUE
             AND (a.created_date + (arc.retention_days || ' days')::INTERVAL) < NOW())
        )                                                      AS o_expired_count,

        COALESCE(SUM(a.file_size_bytes), 0)                    AS o_total_size_bytes,
        MIN(a.created_date)                                    AS o_oldest_artifact,

        -- Retention days from config; NULL if no config row exists
        MAX(arc.retention_days)                                AS o_retention_days

    FROM artifacts a
    LEFT JOIN artifact_retention_config arc
           ON arc.artifact_type = a.artifact_type
    GROUP BY a.artifact_type
    ORDER BY a.artifact_type;
END;
$$;

END;
