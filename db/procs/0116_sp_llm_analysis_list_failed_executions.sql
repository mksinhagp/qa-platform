-- Stored Procedure: sp_llm_analysis_list_failed_executions
-- Purpose: Return execution IDs within a given parent run that have
--          failed/error steps and do NOT yet have a 'failure_summarization' LLM analysis record.
--          The runner post-step uses this to decide whether to invoke the LLM.
-- Parameters:
--   i_run_id : runs.id (parent matrix run)
-- Returns: o_execution_id rows

CREATE OR REPLACE FUNCTION sp_llm_analysis_list_failed_executions(
    i_run_id INTEGER
)
RETURNS TABLE (
    o_execution_id INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT re.Id AS o_execution_id
    FROM run_executions re
    -- Has at least one failed step
    INNER JOIN run_steps rs
        ON rs.Run_Execution_Id = re.Id
        AND rs.Status IN ('failed', 'error')
    -- Does NOT yet have a failure_summarization analysis
    WHERE re.Run_Id = i_run_id
      AND NOT EXISTS (
          SELECT 1
          FROM llm_analysis_results lar
          WHERE lar.Run_Execution_Id = re.Id
            AND lar.Task_Type = 'failure_summarization'
      )
    ORDER BY re.Id ASC;
END;
$$;
