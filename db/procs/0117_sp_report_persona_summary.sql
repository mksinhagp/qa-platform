-- ============================================================
-- Stored Procedure: 0117_sp_report_persona_summary
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Aggregate per-persona summary data for narrative reporting
-- Returns: Completion status, duration, friction score, and top issues per persona
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_persona_summary(
  i_run_id INTEGER
)
RETURNS TABLE (
  persona_id VARCHAR(100),
  persona_display_name VARCHAR(255),
  total_executions INTEGER,
  passed_executions INTEGER,
  failed_executions INTEGER,
  skipped_executions INTEGER,
  avg_friction_score DECIMAL(5,2),
  avg_duration_seconds DECIMAL(10,2),
  top_issue_1 TEXT,
  top_issue_2 TEXT,
  top_issue_3 TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS persona_id,
    p.display_name AS persona_display_name,
    COUNT(re.id) AS total_executions,
    COUNT(CASE WHEN re.status IN ('passed', 'completed') THEN 1 END) AS passed_executions,
    COUNT(CASE WHEN re.status = 'failed' THEN 1 END) AS failed_executions,
    COUNT(CASE WHEN re.status IN ('skipped_by_approval', 'aborted') THEN 1 END) AS skipped_executions,
    COALESCE(AVG(re.friction_score), 0) AS avg_friction_score,
    COALESCE(AVG(
      CASE 
        WHEN re.completed_at IS NOT NULL AND re.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (re.completed_at - re.started_at))
        ELSE NULL 
      END
    ), 0) AS avg_duration_seconds,
    -- Top 3 issues (most common error messages across executions for this persona)
    (
      SELECT re1.error_message
      FROM run_executions re1
      WHERE re1.run_id = i_run_id 
        AND re1.persona_id = re.persona_id
        AND re1.error_message IS NOT NULL
      GROUP BY re1.error_message
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_issue_1,
    (
      SELECT re2.error_message
      FROM run_executions re2
      WHERE re2.run_id = i_run_id 
        AND re2.persona_id = re.persona_id
        AND re2.error_message IS NOT NULL
        AND re2.error_message != (
          SELECT re1.error_message
          FROM run_executions re1
          WHERE re1.run_id = i_run_id 
            AND re1.persona_id = re.persona_id
            AND re1.error_message IS NOT NULL
          GROUP BY re1.error_message
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
      GROUP BY re2.error_message
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_issue_2,
    (
      SELECT re3.error_message
      FROM run_executions re3
      WHERE re3.run_id = i_run_id 
        AND re3.persona_id = re.persona_id
        AND re3.error_message IS NOT NULL
        AND re3.error_message NOT IN (
          SELECT re1.error_message
          FROM run_executions re1
          WHERE re1.run_id = i_run_id 
            AND re1.persona_id = re.persona_id
            AND re1.error_message IS NOT NULL
          GROUP BY re1.error_message
          ORDER BY COUNT(*) DESC
          LIMIT 2
        )
      GROUP BY re3.error_message
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_issue_3
  FROM run_executions re
  JOIN personas p ON re.persona_id = p.id
  WHERE re.run_id = i_run_id
  GROUP BY p.id, p.display_name
  ORDER BY p.display_name;
END;
$$;
