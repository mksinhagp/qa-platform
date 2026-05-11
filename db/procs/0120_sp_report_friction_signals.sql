-- ============================================================
-- Stored Procedure: 0120_sp_report_friction_signals
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Aggregate friction telemetry for narrative reporting
-- Returns: Friction signal counts and scores per execution and signal type
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
  SELECT
    fs.run_execution_id AS execution_id,
    re.persona_id,
    re.flow_name,
    fs.signal_type,
    COUNT(*) AS signal_count,
    MIN(fs.occurred_at) AS first_occurrence,
    MAX(fs.occurred_at) AS last_occurrence,
    -- Get example step (first occurrence)
    (SELECT step_name FROM friction_signals fs2 
     WHERE fs2.run_execution_id = fs.run_execution_id 
       AND fs2.signal_type = fs.signal_type 
     ORDER BY occurred_at ASC LIMIT 1) AS example_step,
    -- Get example metadata (first occurrence)
    (SELECT metadata FROM friction_signals fs3 
     WHERE fs3.run_execution_id = fs.run_execution_id 
       AND fs3.signal_type = fs.signal_type 
     ORDER BY occurred_at ASC LIMIT 1) AS example_metadata
  FROM friction_signals fs
  JOIN run_executions re ON fs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
  GROUP BY fs.run_execution_id, re.persona_id, re.flow_name, fs.signal_type
  ORDER BY 
    re.persona_id,
    re.flow_name,
    fs.signal_type;
END;
$$;
