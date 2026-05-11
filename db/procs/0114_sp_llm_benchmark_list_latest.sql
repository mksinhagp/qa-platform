-- Stored Procedure: sp_llm_benchmark_list_latest
-- Purpose: Fetch all probe results from the most recent benchmark run.
--          "Most recent" is determined by the max Run_At timestamp.
-- Parameters: (none)
-- Returns: all probe rows from the latest benchmark run, ordered by model_id + task_type

CREATE OR REPLACE FUNCTION sp_llm_benchmark_list_latest()
RETURNS TABLE (
    o_id                 INTEGER,
    o_run_at             TIMESTAMPTZ,
    o_model_id           VARCHAR(100),
    o_task_type          VARCHAR(50),
    o_available          BOOLEAN,
    o_latency_ms         INTEGER,
    o_prompt_tokens      INTEGER,
    o_completion_tokens  INTEGER,
    o_response_parseable BOOLEAN,
    o_quality_score      NUMERIC(5,4),
    o_error_message      TEXT,
    o_created_date       TIMESTAMPTZ,
    o_updated_date       TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_latest_run_at TIMESTAMPTZ;
BEGIN
    SELECT MAX(Run_At) INTO v_latest_run_at FROM llm_benchmark_results;

    IF v_latest_run_at IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        b.Id,
        b.Run_At,
        b.Model_Id,
        b.Task_Type,
        b.Available,
        b.Latency_Ms,
        b.Prompt_Tokens,
        b.Completion_Tokens,
        b.Response_Parseable,
        b.Quality_Score,
        b.Error_Message,
        b.Created_Date,
        b.Updated_Date
    FROM llm_benchmark_results b
    WHERE b.Run_At = v_latest_run_at
    ORDER BY b.Model_Id ASC, b.Task_Type ASC;
END;
$$;
