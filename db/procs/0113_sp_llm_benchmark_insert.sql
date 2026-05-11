-- Stored Procedure: sp_llm_benchmark_insert
-- Purpose: Insert a single model benchmark probe result.
--          All probes from one benchmark run share the same i_run_at timestamp.
-- Parameters:
--   i_run_at             : benchmark session timestamp
--   i_model_id           : model identifier, e.g. 'qwen2.5:7b'
--   i_task_type          : 'selector_healing' | 'failure_summarization'
--   i_available          : whether the model was available in Ollama
--   i_latency_ms         : wall-clock latency (nullable if unavailable)
--   i_prompt_tokens      : nullable
--   i_completion_tokens  : nullable
--   i_response_parseable : whether response parsed correctly
--   i_quality_score      : 0..1 quality score (nullable)
--   i_error_message      : error detail (nullable)
--   i_created_by         : 'system'
-- Returns: o_id

CREATE OR REPLACE FUNCTION sp_llm_benchmark_insert(
    i_run_at              TIMESTAMPTZ,
    i_model_id            VARCHAR(100),
    i_task_type           VARCHAR(50),
    i_available           BOOLEAN,
    i_latency_ms          INTEGER       DEFAULT NULL,
    i_prompt_tokens       INTEGER       DEFAULT NULL,
    i_completion_tokens   INTEGER       DEFAULT NULL,
    i_response_parseable  BOOLEAN       DEFAULT NULL,
    i_quality_score       NUMERIC(5,4)  DEFAULT NULL,
    i_error_message       TEXT          DEFAULT NULL,
    i_created_by          VARCHAR(100)  DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO llm_benchmark_results (
        Run_At,
        Model_Id,
        Task_Type,
        Available,
        Latency_Ms,
        Prompt_Tokens,
        Completion_Tokens,
        Response_Parseable,
        Quality_Score,
        Error_Message,
        Created_By,
        Updated_By
    ) VALUES (
        i_run_at,
        i_model_id,
        i_task_type,
        i_available,
        i_latency_ms,
        i_prompt_tokens,
        i_completion_tokens,
        i_response_parseable,
        i_quality_score,
        i_error_message,
        i_created_by,
        i_created_by
    )
    RETURNING Id INTO v_id;

    RETURN QUERY SELECT v_id;
END;
$$;
