-- Stored Procedure: sp_llm_analysis_upsert
-- Purpose: Insert or update an LLM analysis result for a run execution.
--          Uses ON CONFLICT to handle the unique (Run_Execution_Id, Task_Type) constraint,
--          so the runner can call this once to create the pending record and again to complete it.
-- Parameters:
--   i_run_execution_id : run_executions.id
--   i_task_type        : 'selector_healing' | 'failure_summarization'
--   i_model_used       : model identifier string, e.g. 'qwen2.5:7b'
--   i_status           : 'pending' | 'completed' | 'error' | 'skipped'
--   i_result_json      : serialized FailureSummary / SelectorHealingResult (JSONB, nullable)
--   i_error_message    : error detail when status='error' (nullable)
--   i_prompt_tokens    : token count (nullable)
--   i_completion_tokens: token count (nullable)
--   i_duration_ms      : wall-clock duration in milliseconds (nullable)
--   i_updated_by       : operator login or 'system'
-- Returns: o_id (llm_analysis_results.Id)

CREATE OR REPLACE FUNCTION sp_llm_analysis_upsert(
    i_run_execution_id  INTEGER,
    i_task_type         VARCHAR(50),
    i_model_used        VARCHAR(100),
    i_status            VARCHAR(20),
    i_result_json       JSONB         DEFAULT NULL,
    i_error_message     TEXT          DEFAULT NULL,
    i_prompt_tokens     INTEGER       DEFAULT NULL,
    i_completion_tokens INTEGER       DEFAULT NULL,
    i_duration_ms       INTEGER       DEFAULT NULL,
    i_updated_by        VARCHAR(100)  DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO llm_analysis_results (
        Run_Execution_Id,
        Task_Type,
        Model_Used,
        Status,
        Result_Json,
        Error_Message,
        Prompt_Tokens,
        Completion_Tokens,
        Duration_Ms,
        Created_By,
        Updated_By
    ) VALUES (
        i_run_execution_id,
        i_task_type,
        i_model_used,
        i_status,
        i_result_json,
        i_error_message,
        i_prompt_tokens,
        i_completion_tokens,
        i_duration_ms,
        i_updated_by,
        i_updated_by
    )
    ON CONFLICT (Run_Execution_Id, Task_Type)
    DO UPDATE SET
        Model_Used          = EXCLUDED.Model_Used,
        Status              = EXCLUDED.Status,
        Result_Json         = COALESCE(EXCLUDED.Result_Json, llm_analysis_results.Result_Json),
        Error_Message       = EXCLUDED.Error_Message,
        Prompt_Tokens       = COALESCE(EXCLUDED.Prompt_Tokens, llm_analysis_results.Prompt_Tokens),
        Completion_Tokens   = COALESCE(EXCLUDED.Completion_Tokens, llm_analysis_results.Completion_Tokens),
        Duration_Ms         = COALESCE(EXCLUDED.Duration_Ms, llm_analysis_results.Duration_Ms),
        Updated_Date        = NOW(),
        Updated_By          = EXCLUDED.Updated_By
    RETURNING Id INTO v_id;

    RETURN QUERY SELECT v_id;
END;
$$;
