-- ============================================================
-- Stored Procedure: 0118_sp_report_accessibility_summary
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Aggregate accessibility results across all executions
-- Returns: Axe-core severity counts, keyboard-nav pass rate, contrast pass rate
-- Note: Accessibility checks are stored in run_steps details JSONB
--
-- Fix (Phase 7-9 code review): Original proc ran 10 separate SELECT INTO
-- statements, each performing a full join of run_steps + run_executions for
-- the same i_run_id.  Replaced with a single CTE pass using conditional
-- aggregation so the table is scanned exactly once.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_accessibility_summary(
  i_run_id INTEGER
)
RETURNS TABLE (
  total_checks INTEGER,
  passed_checks INTEGER,
  failed_checks INTEGER,
  critical_issues INTEGER,
  serious_issues INTEGER,
  moderate_issues INTEGER,
  minor_issues INTEGER,
  keyboard_nav_pass_rate DECIMAL(5,2),
  contrast_pass_rate DECIMAL(5,2),
  reflow_pass_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Single scan: aggregate all ten metrics in one pass over
  -- the join of run_steps and run_executions.
  WITH acc AS (
    SELECT
      rs.details -> 'accessibility' AS a
    FROM run_steps rs
    JOIN run_executions re ON rs.run_execution_id = re.id
    WHERE re.run_id = i_run_id
      AND rs.details -> 'accessibility' IS NOT NULL
  )
  SELECT
    -- total / passed / failed checks
    COUNT(*)::INTEGER                                                           AS total_checks,
    COUNT(*) FILTER (WHERE a->>'status' = 'passed')::INTEGER                   AS passed_checks,
    COUNT(*) FILTER (WHERE a->>'status' = 'failed')::INTEGER                   AS failed_checks,

    -- axe-core severity counts
    COALESCE(SUM(
      CASE WHEN a->'axe_core' IS NOT NULL
           THEN (a->'axe_core'->'violations'->>'critical')::INTEGER
           ELSE 0 END
    ), 0)::INTEGER                                                              AS critical_issues,
    COALESCE(SUM(
      CASE WHEN a->'axe_core' IS NOT NULL
           THEN (a->'axe_core'->'violations'->>'serious')::INTEGER
           ELSE 0 END
    ), 0)::INTEGER                                                              AS serious_issues,
    COALESCE(SUM(
      CASE WHEN a->'axe_core' IS NOT NULL
           THEN (a->'axe_core'->'violations'->>'moderate')::INTEGER
           ELSE 0 END
    ), 0)::INTEGER                                                              AS moderate_issues,
    COALESCE(SUM(
      CASE WHEN a->'axe_core' IS NOT NULL
           THEN (a->'axe_core'->'violations'->>'minor')::INTEGER
           ELSE 0 END
    ), 0)::INTEGER                                                              AS minor_issues,

    -- keyboard navigation pass rate
    CASE
      WHEN COUNT(*) FILTER (WHERE a->'keyboard_nav' IS NOT NULL) > 0
      THEN (
        COUNT(*) FILTER (WHERE a->'keyboard_nav' IS NOT NULL AND a->'keyboard_nav'->>'passed' = 'true')::DECIMAL
        / COUNT(*) FILTER (WHERE a->'keyboard_nav' IS NOT NULL)::DECIMAL
      ) * 100
      ELSE 100
    END                                                                         AS keyboard_nav_pass_rate,

    -- contrast pass rate
    CASE
      WHEN COUNT(*) FILTER (WHERE a->'contrast' IS NOT NULL) > 0
      THEN (
        COUNT(*) FILTER (WHERE a->'contrast' IS NOT NULL AND a->'contrast'->>'passed' = 'true')::DECIMAL
        / COUNT(*) FILTER (WHERE a->'contrast' IS NOT NULL)::DECIMAL
      ) * 100
      ELSE 100
    END                                                                         AS contrast_pass_rate,

    -- reflow pass rate
    CASE
      WHEN COUNT(*) FILTER (WHERE a->'reflow' IS NOT NULL) > 0
      THEN (
        COUNT(*) FILTER (WHERE a->'reflow' IS NOT NULL AND a->'reflow'->>'passed' = 'true')::DECIMAL
        / COUNT(*) FILTER (WHERE a->'reflow' IS NOT NULL)::DECIMAL
      ) * 100
      ELSE 100
    END                                                                         AS reflow_pass_rate

  FROM acc;
END;
$$;
