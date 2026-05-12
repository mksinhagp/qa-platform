-- ============================================================
-- Stored Procedure: 0120_sp_report_friction_signals
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Aggregate friction telemetry for narrative reporting
-- Returns: Friction signal counts and scores per execution and signal type
--
-- Fix (Phase 7-9 code review): Original proc used two correlated subqueries
-- per output row (example_step, example_metadata) — each re-scanned
-- friction_signals with ORDER BY … LIMIT 1, producing N+1 round-trips where
-- N is the number of (execution, signal_type) groups.
-- Replaced with a DISTINCT ON CTE (first_signals) that pre-selects the
-- earliest row per group in a single pass; the outer query joins it once.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_friction_signals(
  i_run_id INTEGER
)
RETURNS TABLE (
  execution_id INTEGER,
  persona_id VARCHAR(100),
  flow_name VARCHAR(100),
  signal_type VARCHAR(100),
  signal_count INTEGER,
  first_occurrence TIMESTAMP WITH TIME ZONE,
  last_occurrence TIMESTAMP WITH TIME ZONE,
  example_step VARCHAR(255),
  example_metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Pre-select the earliest friction_signal row per (execution, signal_type)
  -- using DISTINCT ON so the aggregation join is O(1) per group instead of
  -- triggering a correlated subquery per row.
  WITH first_signals AS (
    SELECT DISTINCT ON (fs.run_execution_id, fs.signal_type)
      fs.run_execution_id,
      fs.signal_type,
      fs.step_name  AS example_step,
      fs.metadata   AS example_metadata
    FROM friction_signals fs
    JOIN run_executions re ON fs.run_execution_id = re.id
    WHERE re.run_id = i_run_id
    ORDER BY fs.run_execution_id, fs.signal_type, fs.occurred_at ASC
  )
  SELECT
    fs.run_execution_id                   AS execution_id,
    re.persona_id,
    re.flow_name,
    fs.signal_type,
    COUNT(*)::INTEGER                     AS signal_count,
    MIN(fs.occurred_at)                   AS first_occurrence,
    MAX(fs.occurred_at)                   AS last_occurrence,
    fst.example_step,
    fst.example_metadata
  FROM friction_signals fs
  JOIN run_executions re ON fs.run_execution_id = re.id
  JOIN first_signals  fst
    ON  fst.run_execution_id = fs.run_execution_id
    AND fst.signal_type      = fs.signal_type
  WHERE re.run_id = i_run_id
  GROUP BY
    fs.run_execution_id,
    re.persona_id,
    re.flow_name,
    fs.signal_type,
    fst.example_step,
    fst.example_metadata
  ORDER BY
    re.persona_id,
    re.flow_name,
    fs.signal_type;
END;
$$;
