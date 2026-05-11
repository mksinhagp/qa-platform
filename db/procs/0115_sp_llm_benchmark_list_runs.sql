-- Stored Procedure: sp_llm_benchmark_list_runs
-- Purpose: Return a summary of all benchmark runs (distinct run_at timestamps,
--          with model count and average quality score per run).
--          Used by the benchmark history UI.
-- Parameters: (none)
-- Returns: one row per benchmark run, ordered newest first

CREATE OR REPLACE FUNCTION sp_llm_benchmark_list_runs()
RETURNS TABLE (
    o_run_at            TIMESTAMPTZ,
    o_model_count       BIGINT,
    o_avg_quality_score NUMERIC(5,4),
    o_min_latency_ms    INTEGER,
    o_max_latency_ms    INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.Run_At,
        COUNT(DISTINCT b.Model_Id)::BIGINT                                  AS model_count,
        ROUND(AVG(b.Quality_Score) FILTER (WHERE b.Available = TRUE), 4)   AS avg_quality_score,
        MIN(b.Latency_Ms) FILTER (WHERE b.Available = TRUE)                AS min_latency_ms,
        MAX(b.Latency_Ms) FILTER (WHERE b.Available = TRUE)                AS max_latency_ms
    FROM llm_benchmark_results b
    GROUP BY b.Run_At
    ORDER BY b.Run_At DESC;
END;
$$;
