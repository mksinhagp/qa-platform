-- ============================================================
-- Stored Procedure: 0118_sp_report_accessibility_summary
-- Phase 9: Reporting and Narrative Layer
--
-- Purpose: Aggregate accessibility results across all executions
-- Returns: Axe-core severity counts, keyboard-nav pass rate, contrast pass rate
-- Note: Accessibility checks are stored in run_steps details JSONB
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
DECLARE
  v_total_checks INTEGER := 0;
  v_passed_checks INTEGER := 0;
  v_failed_checks INTEGER := 0;
  v_critical_issues INTEGER := 0;
  v_serious_issues INTEGER := 0;
  v_moderate_issues INTEGER := 0;
  v_minor_issues INTEGER := 0;
  v_keyboard_nav_total INTEGER := 0;
  v_keyboard_nav_passed INTEGER := 0;
  v_contrast_total INTEGER := 0;
  v_contrast_passed INTEGER := 0;
  v_reflow_total INTEGER := 0;
  v_reflow_passed INTEGER := 0;
BEGIN
  -- Extract accessibility results from run_steps details JSONB
  -- This assumes accessibility checks are stored with structure:
  -- { "accessibility": { "axe_core": [...], "keyboard_nav": {...}, "contrast": {...}, "reflow": {...} } }
  
  SELECT
    COUNT(*) INTO v_total_checks
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility' IS NOT NULL;
  
  SELECT
    COUNT(*) INTO v_passed_checks
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->>'status' = 'passed';
  
  SELECT
    COUNT(*) INTO v_failed_checks
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->>'status' = 'failed';
  
  -- Count axe-core severity issues
  SELECT
    COALESCE(SUM((rs.details->'accessibility'->'axe_core'->'violations')::jsonb->>'critical')::INTEGER, 0) INTO v_critical_issues
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'axe_core' IS NOT NULL;
  
  SELECT
    COALESCE(SUM((rs.details->'accessibility'->'axe_core'->'violations')::jsonb->>'serious')::INTEGER, 0) INTO v_serious_issues
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'axe_core' IS NOT NULL;
  
  SELECT
    COALESCE(SUM((rs.details->'accessibility'->'axe_core'->'violations')::jsonb->>'moderate')::INTEGER, 0) INTO v_moderate_issues
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'axe_core' IS NOT NULL;
  
  SELECT
    COALESCE(SUM((rs.details->'accessibility'->'axe_core'->'violations')::jsonb->>'minor')::INTEGER, 0) INTO v_minor_issues
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'axe_core' IS NOT NULL;
  
  -- Keyboard navigation pass rate
  SELECT
    COUNT(*) INTO v_keyboard_nav_total
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'keyboard_nav' IS NOT NULL;
  
  SELECT
    COUNT(*) INTO v_keyboard_nav_passed
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'keyboard_nav'->>'passed' = 'true';
  
  -- Contrast pass rate
  SELECT
    COUNT(*) INTO v_contrast_total
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'contrast' IS NOT NULL;
  
  SELECT
    COUNT(*) INTO v_contrast_passed
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'contrast'->>'passed' = 'true';
  
  -- Reflow pass rate
  SELECT
    COUNT(*) INTO v_reflow_total
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'reflow' IS NOT NULL;
  
  SELECT
    COUNT(*) INTO v_reflow_passed
  FROM run_steps rs
  JOIN run_executions re ON rs.run_execution_id = re.id
  WHERE re.run_id = i_run_id
    AND rs.details->'accessibility'->'reflow'->>'passed' = 'true';
  
  RETURN QUERY SELECT
    v_total_checks,
    v_passed_checks,
    v_failed_checks,
    v_critical_issues,
    v_serious_issues,
    v_moderate_issues,
    v_minor_issues,
    CASE WHEN v_keyboard_nav_total > 0 
         THEN (v_keyboard_nav_passed::DECIMAL / v_keyboard_nav_total::DECIMAL) * 100 
         ELSE 100 END,
    CASE WHEN v_contrast_total > 0 
         THEN (v_contrast_passed::DECIMAL / v_contrast_total::DECIMAL) * 100 
         ELSE 100 END,
    CASE WHEN v_reflow_total > 0 
         THEN (v_reflow_passed::DECIMAL / v_reflow_total::DECIMAL) * 100 
         ELSE 100 END;
END;
$$;
