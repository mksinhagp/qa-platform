BEGIN
-- ============================================================
-- Stored Procedure: 0126_sp_artifacts_insert
-- Phase 11.1: Retention enforcement audits and cleanup
--
-- Purpose: Insert a new artifact record, auto-computing retention_date
--   from artifact_retention_config if a matching active config row exists.
--   If no config exists for the artifact_type, retention_date is left NULL.
--
-- Parameters:
--   i_run_execution_id  INTEGER       Foreign key to run_executions
--   i_artifact_type     VARCHAR(50)   e.g. 'trace', 'video', 'screenshot'
--   i_file_path         VARCHAR(512)  Absolute path on disk
--   i_file_size_bytes   BIGINT        Optional file size
--   i_mime_type         VARCHAR(100)  Optional MIME type
--   i_description       TEXT          Optional description
--   i_created_by        VARCHAR(255)  Audit creator (default 'system')
--
-- Returns: o_id, o_file_path, o_retention_date, o_created_date
-- ============================================================

CREATE OR REPLACE FUNCTION sp_artifacts_insert(
    i_run_execution_id  INTEGER,
    i_artifact_type     VARCHAR(50),
    i_file_path         VARCHAR(512),
    i_file_size_bytes   BIGINT DEFAULT NULL,
    i_mime_type         VARCHAR(100) DEFAULT NULL,
    i_description       TEXT DEFAULT NULL,
    i_created_by        VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE(
    o_id             INTEGER,
    o_file_path      VARCHAR(512),
    o_retention_date TIMESTAMP WITH TIME ZONE,
    o_created_date   TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_retention_days INTEGER;
    v_retention_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Look up configured retention window for this artifact type
    SELECT arc.retention_days
      INTO v_retention_days
      FROM artifact_retention_config arc
     WHERE arc.artifact_type = i_artifact_type
       AND arc.is_active = TRUE
     LIMIT 1;

    -- Compute retention_date if a config row was found
    IF v_retention_days IS NOT NULL THEN
        v_retention_date := CURRENT_TIMESTAMP + (v_retention_days || ' days')::INTERVAL;
    ELSE
        v_retention_date := NULL;
    END IF;

    RETURN QUERY
    INSERT INTO artifacts (
        run_execution_id,
        artifact_type,
        file_path,
        file_size_bytes,
        mime_type,
        description,
        retention_date,
        created_by,
        updated_by
    )
    VALUES (
        i_run_execution_id,
        i_artifact_type,
        i_file_path,
        i_file_size_bytes,
        i_mime_type,
        i_description,
        v_retention_date,
        i_created_by,
        i_created_by
    )
    RETURNING id, file_path, retention_date, created_date;
END;
$$;

END;
