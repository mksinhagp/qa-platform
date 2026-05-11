-- ============================================================
-- Stored Procedure: 0122_sp_report_run_summary
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Get high-level run summary for narrative report header
-- Returns: Overall run statistics with site and environment context
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_run_summary(
  i_run_id INTEGER
)
RETURNS TABLE (
  run_id INTEGER,
  run_name VARCHAR(255),
  run_description TEXT,
  run_status VARCHAR(50),
  site_id INTEGER,
  site_name VARCHAR(255),
  site_url VARCHAR(500),
  environment_id INTEGER,
  environment_name VARCHAR(100),
  environment_url VARCHAR(500),
  started_by VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds DECIMAL(10,2),
  total_executions INTEGER,
  successful_executions INTEGER,
  failed_executions INTEGER,
  skipped_executions INTEGER,
  total_personas_tested INTEGER,
  total_flows_tested INTEGER,
  avg_friction_score DECIMAL(5,2),
  is_pinned BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS run_id,
    r.name AS run_name,
    r.description AS run_description,
    r.status AS run_status,
    r.site_id,
    s.name AS site_name,
    s.base_url AS site_url,
    r.site_environment_id AS environment_id,
    se.name AS environment_name,
    se.base_url AS environment_url,
    r.started_by,
    r.started_at,
    r.completed_at,
    CASE 
      WHEN r.completed_at IS NOT NULL AND r.started_at IS NOT NULL 
      THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at))
      ELSE NULL 
    END AS duration_seconds,
    r.total_executions,
    r.successful_executions,
    r.failed_executions,
    r.skipped_executions,
    COUNT(DISTINCT re.persona_id) AS total_personas_tested,
    COUNT(DISTINCT re.flow_name) AS total_flows_tested,
    COALESCE(AVG(re.friction_score), 0) AS avg_friction_score,
    r.is_pinned
  FROM runs r
  LEFT JOIN sites s ON r.site_id = s.id
  LEFT JOIN site_environments se ON r.site_environment_id = se.id
  LEFT JOIN run_executions re ON r.id = re.run_id
  WHERE r.id = i_run_id
  GROUP BY r.id, r.name, r.description, r.status, r.site_id, s.name, s.base_url,
           r.site_environment_id, se.name, se.base_url, r.started_by, r.started_at,
           r.completed_at, r.total_executions, r.successful_executions,
           r.failed_executions, r.skipped_executions, r.is_pinned;
END;
$$;
