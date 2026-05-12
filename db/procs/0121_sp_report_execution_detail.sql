-- ============================================================
-- Stored Procedure: 0121_sp_report_execution_detail
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Get detailed execution data for technical drill-down
-- Returns: Full execution details with steps and artifacts as separate rows
--
-- Fix (Phase 7-9 code review): The original proc joined run_steps AND artifacts
-- both on run_execution_id, producing an N×M Cartesian product (N steps × M
-- artifacts per execution).  The fix uses UNION ALL to emit step rows and artifact
-- rows independently so the caller always receives exactly N + M rows, never N×M.
--   • Step rows  : artifact_* columns are NULL.
--   • Artifact rows: step_* columns are NULL, step_order = NULL (sorted last).
-- The UI already filters each group separately (.filter(d => d.step_id !== null)
-- and .filter(d => d.artifact_file_path)) so no client changes are required.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_execution_detail(
  i_execution_id INTEGER
)
RETURNS TABLE (
  execution_id INTEGER,
  run_id INTEGER,
  persona_id VARCHAR(100),
  persona_display_name VARCHAR(255),
  device_profile_id INTEGER,
  device_profile_name VARCHAR(255),
  network_profile_id INTEGER,
  network_profile_name VARCHAR(255),
  browser VARCHAR(50),
  flow_name VARCHAR(100),
  status VARCHAR(50),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds DECIMAL(10,2),
  friction_score DECIMAL(5,2),
  error_message TEXT,
  artifact_path VARCHAR(512),
  step_id INTEGER,
  step_name VARCHAR(255),
  step_order INTEGER,
  step_type VARCHAR(50),
  step_status VARCHAR(50),
  step_started_at TIMESTAMP WITH TIME ZONE,
  step_completed_at TIMESTAMP WITH TIME ZONE,
  step_error_message TEXT,
  step_details JSONB,
  artifact_type VARCHAR(50),
  artifact_file_path VARCHAR(512),
  artifact_file_size_bytes BIGINT,
  artifact_mime_type VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- ── Part 1: one row per step (artifact columns NULL) ──────────────────────
  SELECT
    re.id                                                                     AS execution_id,
    re.run_id,
    re.persona_id,
    p.display_name                                                            AS persona_display_name,
    re.device_profile_id,
    dp.name                                                                   AS device_profile_name,
    re.network_profile_id,
    np.name                                                                   AS network_profile_name,
    re.browser,
    re.flow_name,
    re.status,
    re.started_at,
    re.completed_at,
    CASE
      WHEN re.completed_at IS NOT NULL AND re.started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (re.completed_at - re.started_at))
      ELSE NULL
    END                                                                       AS duration_seconds,
    re.friction_score,
    re.error_message,
    re.artifact_path,
    rs.id                                                                     AS step_id,
    rs.step_name,
    rs.step_order,
    rs.step_type,
    rs.status                                                                 AS step_status,
    rs.started_at                                                             AS step_started_at,
    rs.completed_at                                                           AS step_completed_at,
    rs.error_message                                                          AS step_error_message,
    rs.details                                                                AS step_details,
    NULL::VARCHAR(50)                                                         AS artifact_type,
    NULL::VARCHAR(512)                                                        AS artifact_file_path,
    NULL::BIGINT                                                              AS artifact_file_size_bytes,
    NULL::VARCHAR(100)                                                        AS artifact_mime_type
  FROM run_executions re
  LEFT JOIN personas p           ON re.persona_id         = p.id
  LEFT JOIN device_profiles dp   ON re.device_profile_id  = dp.id
  LEFT JOIN network_profiles np  ON re.network_profile_id = np.id
  LEFT JOIN run_steps rs         ON re.id                 = rs.run_execution_id
  WHERE re.id = i_execution_id

  UNION ALL

  -- ── Part 2: one row per artifact (step columns NULL) ──────────────────────
  SELECT
    re.id                                                                     AS execution_id,
    re.run_id,
    re.persona_id,
    p.display_name                                                            AS persona_display_name,
    re.device_profile_id,
    dp.name                                                                   AS device_profile_name,
    re.network_profile_id,
    np.name                                                                   AS network_profile_name,
    re.browser,
    re.flow_name,
    re.status,
    re.started_at,
    re.completed_at,
    CASE
      WHEN re.completed_at IS NOT NULL AND re.started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (re.completed_at - re.started_at))
      ELSE NULL
    END                                                                       AS duration_seconds,
    re.friction_score,
    re.error_message,
    re.artifact_path,
    NULL::INTEGER                                                             AS step_id,
    NULL::VARCHAR(255)                                                        AS step_name,
    NULL::INTEGER                                                             AS step_order,
    NULL::VARCHAR(50)                                                         AS step_type,
    NULL::VARCHAR(50)                                                         AS step_status,
    NULL::TIMESTAMP WITH TIME ZONE                                            AS step_started_at,
    NULL::TIMESTAMP WITH TIME ZONE                                            AS step_completed_at,
    NULL::TEXT                                                                AS step_error_message,
    NULL::JSONB                                                               AS step_details,
    a.artifact_type,
    a.file_path                                                               AS artifact_file_path,
    a.file_size_bytes                                                         AS artifact_file_size_bytes,
    a.mime_type                                                               AS artifact_mime_type
  FROM run_executions re
  LEFT JOIN personas p           ON re.persona_id         = p.id
  LEFT JOIN device_profiles dp   ON re.device_profile_id  = dp.id
  LEFT JOIN network_profiles np  ON re.network_profile_id = np.id
  INNER JOIN artifacts a         ON re.id                 = a.run_execution_id
  WHERE re.id = i_execution_id

  ORDER BY step_order NULLS LAST;
END;
$$;
