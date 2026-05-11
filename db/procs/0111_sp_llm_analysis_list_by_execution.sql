-- Stored Procedure: sp_llm_analysis_list_by_execution
-- Purpose: Fetch all LLM analysis records for a given run execution.
-- Parameters:
--   i_run_execution_id : run_executions.id
-- Returns: all columns mapped to o_ output aliases

CREATE OR REPLACE FUNCTION sp_llm_analysis_list_by_execution(
    i_run_execution_id INTEGER
)
RETURNS TABLE (
    o_id                INTEGER,
    o_run_execution_id  INTEGER,
    o_task_type         VARCHAR(50),
    o_model_used        VARCHAR(100),
    o_status            VARCHAR(20),
    o_result_json       JSONB,
    o_error_message     TEXT,
    o_prompt_tokens     INTEGER,
    o_completion_tokens INTEGER,
    o_duration_ms       INTEGER,
    o_created_date      TIMESTAMPTZ,
    o_updated_date      TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.Id,
        r.Run_Execution_Id,
        r.Task_Type,
        r.Model_Used,
        r.Status,
        r.Result_Json,
        r.Error_Message,
        r.Prompt_Tokens,
        r.Completion_Tokens,
        r.Duration_Ms,
        r.Created_Date,
        r.Updated_Date
    FROM llm_analysis_results r
    WHERE r.Run_Execution_Id = i_run_execution_id
    ORDER BY r.Created_Date ASC;
END;
$$;
