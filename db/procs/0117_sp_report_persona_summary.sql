-- ============================================================
-- Stored Procedure: 0117_sp_report_persona_summary
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Aggregate per-persona summary data for narrative reporting
-- Returns: Completion status, duration, friction score, and top issues per persona
--
-- Performance note: top-3 issues are resolved with a single CTE + window function
-- to avoid the N+1 correlated-subquery pattern (3 subqueries × each persona row).
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_persona_summary(
  i_run_id INTEGER
)
RETURNS TABLE (
  persona_id          VARCHAR(100),
  persona_display_name VARCHAR(255),
  total_executions    INTEGER,
  passed_executions   INTEGER,
  failed_executions   INTEGER,
  skipped_executions  INTEGER,
  avg_friction_score  DECIMAL(5,2),
  avg_duration_seconds DECIMAL(10,2),
  top_issue_1         TEXT,
  top_issue_2         TEXT,
  top_issue_3         TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Rank error messages per persona by frequency using a window function.
  -- This replaces three separate correlated subqueries (one per top-N rank).
  ranked_issues AS (
    SELECT
      re.persona_id                          AS pid,
      re.error_message,
      ROW_NUMBER() OVER (
        PARTITION BY re.persona_id
        ORDER BY COUNT(*) DESC, MIN(re.created_date) ASC
      )                                      AS issue_rank
    FROM run_executions re
    WHERE re.run_id = i_run_id
      AND re.error_message IS NOT NULL
    GROUP BY re.persona_id, re.error_message
  ),
  -- Pivot ranks 1-3 into columns per persona with a single scan.
  top_issues AS (
    SELECT
      pid,
      MAX(CASE WHEN issue_rank = 1 THEN error_message END) AS issue_1,
      MAX(CASE WHEN issue_rank = 2 THEN error_message END) AS issue_2,
      MAX(CASE WHEN issue_rank = 3 THEN error_message END) AS issue_3
    FROM ranked_issues
    WHERE issue_rank <= 3
    GROUP BY pid
  )
  SELECT
    p.id                                               AS persona_id,
    p.display_name                                     AS persona_display_name,
    COUNT(re.id)::INTEGER                              AS total_executions,
    COUNT(CASE WHEN re.status IN ('passed', 'completed') THEN 1 END)::INTEGER AS passed_executions,
    COUNT(CASE WHEN re.status = 'failed' THEN 1 END)::INTEGER AS failed_executions,
    COUNT(CASE WHEN re.status IN ('skipped_by_approval', 'aborted') THEN 1 END)::INTEGER AS skipped_executions,
    COALESCE(AVG(re.friction_score), 0)::DECIMAL(5,2)  AS avg_friction_score,
    COALESCE(
      AVG(
        CASE
          WHEN re.completed_at IS NOT NULL AND re.started_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (re.completed_at - re.started_at))
          ELSE NULL
        END
      ), 0
    )::DECIMAL(10,2)                                   AS avg_duration_seconds,
    ti.issue_1                                         AS top_issue_1,
    ti.issue_2                                         AS top_issue_2,
    ti.issue_3                                         AS top_issue_3
  FROM run_executions re
  JOIN personas p          ON re.persona_id = p.id
  LEFT JOIN top_issues ti  ON re.persona_id = ti.pid
  WHERE re.run_id = i_run_id
  GROUP BY p.id, p.display_name, ti.issue_1, ti.issue_2, ti.issue_3
  ORDER BY p.display_name;
END;
$$;
