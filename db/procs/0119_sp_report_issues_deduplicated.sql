-- ============================================================
-- Stored Procedure: 0119_sp_report_issues_deduplicated
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Deduplicate and rank issues across all executions
-- Returns: Severity-ranked issue list with occurrence counts and affected personas
-- Deduplication logic: Group by normalized error message and step name
-- ============================================================

CREATE OR REPLACE FUNCTION sp_report_issues_deduplicated(
  i_run_id INTEGER
)
RETURNS TABLE (
  issue_id VARCHAR(100),
  severity VARCHAR(20),
  category VARCHAR(50),
  summary TEXT,
  first_occurrence_step VARCHAR(255),
  occurrence_count INTEGER,
  affected_personas VARCHAR(500),
  affected_executions INTEGER,
  example_error_message TEXT,
  first_occurrence_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH deduped_issues AS (
    -- Normalize error messages for deduplication
    -- Remove timestamps, IDs, and variable values to group similar errors
    SELECT
      re.id AS execution_id,
      re.persona_id,
      rs.step_name,
      rs.step_type,
      rs.error_message,
      -- Create normalized key for deduplication
      LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              COALESCE(rs.error_message, ''),
              '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?', '',  -- Remove timestamps
              'g'
            ),
            '\b\d+\b', 'N',  -- Replace numbers with N
            'g'
          ),
          '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', 'UUID',  -- Replace UUIDs
          'g'
        )
      ) AS normalized_error,
      -- Determine severity based on step type and error content
      CASE
        WHEN rs.step_type = 'assertion' THEN 'high'
        WHEN rs.step_type = 'action' AND rs.error_message ILIKE '%timeout%' THEN 'medium'
        WHEN rs.step_type = 'action' THEN 'high'
        WHEN rs.step_type = 'navigation' THEN 'critical'
        WHEN rs.error_message ILIKE '%accessibility%' THEN 'high'
        WHEN rs.error_message ILIKE '%security%' THEN 'critical'
        ELSE 'medium'
      END AS severity,
      -- Determine category
      CASE
        WHEN rs.step_type = 'navigation' THEN 'navigation'
        WHEN rs.step_type = 'assertion' THEN 'assertion'
        WHEN rs.step_type = 'action' THEN 'action'
        WHEN rs.error_message ILIKE '%timeout%' THEN 'timeout'
        WHEN rs.error_message ILIKE '%accessibility%' THEN 'accessibility'
        WHEN rs.error_message ILIKE '%network%' THEN 'network'
        WHEN rs.error_message ILIKE '%selector%' THEN 'selector'
        ELSE 'other'
      END AS category,
      rs.started_at
    FROM run_steps rs
    JOIN run_executions re ON rs.run_execution_id = re.id
    WHERE re.run_id = i_run_id
      AND rs.status = 'failed'
      AND rs.error_message IS NOT NULL
  ),
  grouped_issues AS (
    SELECT
      -- Generate issue ID from normalized error + step
      SUBSTRING(MD5(normalized_error || step_name), 1, 12) AS issue_id,
      severity,
      category,
      -- Create summary (first 100 chars of normalized error)
      SUBSTRING(normalized_error, 1, 100) AS summary,
      step_name AS first_occurrence_step,
      COUNT(DISTINCT execution_id) AS occurrence_count,
      -- Aggregate affected personas
      STRING_AGG(DISTINCT persona_id, ', ') AS affected_personas,
      COUNT(DISTINCT execution_id) AS affected_executions,
      -- Get first occurrence example
      (SELECT error_message FROM deduped_issues di2 
       WHERE di2.normalized_error = di1.normalized_error 
         AND di2.step_name = di1.step_name 
       ORDER BY started_at ASC LIMIT 1) AS example_error_message,
      MIN(started_at) AS first_occurrence_time
    FROM deduped_issues di1
    GROUP BY normalized_error, step_name, severity, category
  )
  SELECT
    issue_id,
    severity,
    category,
    summary,
    first_occurrence_step,
    occurrence_count,
    affected_personas,
    affected_executions,
    example_error_message,
    first_occurrence_time
  FROM grouped_issues
  ORDER BY
    CASE severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    occurrence_count DESC,
    first_occurrence_time ASC;
END;
$$;
