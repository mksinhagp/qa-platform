-- ============================================================
-- Migration 0018: LLM Analysis Tables
-- Phase 8: Ollama integration — selector healing + failure summarization + benchmarking
--
-- New tables:
--   llm_analysis_results  — per-execution LLM analysis records (one row per task_type per execution)
--   llm_benchmark_results — model benchmark probe records
-- ============================================================

BEGIN;

-- ─── llm_analysis_results ─────────────────────────────────────────────────────
-- Stores the result of each LLM analysis task for a run execution.
-- result_json stores the serialized FailureSummary or SelectorHealingResult.
-- status tracks the lifecycle: pending → completed | error | skipped.

CREATE TABLE IF NOT EXISTS llm_analysis_results (
    Id                  SERIAL          PRIMARY KEY,
    Run_Execution_Id    INTEGER         NOT NULL REFERENCES run_executions(Id) ON DELETE CASCADE,
    Task_Type           VARCHAR(50)     NOT NULL CHECK (Task_Type IN ('selector_healing', 'failure_summarization')),
    Model_Used          VARCHAR(100)    NOT NULL,
    Status              VARCHAR(20)     NOT NULL DEFAULT 'pending'
                            CHECK (Status IN ('pending', 'completed', 'error', 'skipped')),
    -- JSON result blob: FailureSummary or SelectorHealingResult serialized
    Result_Json         JSONB           NULL,
    Error_Message       TEXT            NULL,
    Prompt_Tokens       INTEGER         NULL,
    Completion_Tokens   INTEGER         NULL,
    Duration_Ms         INTEGER         NULL,
    -- Audit columns (global rules)
    Created_Date        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    Updated_Date        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    Created_By          VARCHAR(100)    NOT NULL DEFAULT 'system',
    Updated_By          VARCHAR(100)    NOT NULL DEFAULT 'system'
);

-- One analysis result per (execution, task_type) pair
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_analysis_results_exec_task
    ON llm_analysis_results (Run_Execution_Id, Task_Type);

CREATE INDEX IF NOT EXISTS idx_llm_analysis_results_execution
    ON llm_analysis_results (Run_Execution_Id);

CREATE INDEX IF NOT EXISTS idx_llm_analysis_results_status
    ON llm_analysis_results (Status);

-- ─── llm_benchmark_results ────────────────────────────────────────────────────
-- Stores individual probe results from a model benchmark run.
-- Each row is one (model, task_type) probe within a single benchmark session.

CREATE TABLE IF NOT EXISTS llm_benchmark_results (
    Id                  SERIAL          PRIMARY KEY,
    -- ISO timestamp of the benchmark run (groups all probes from one run)
    Run_At              TIMESTAMPTZ     NOT NULL,
    Model_Id            VARCHAR(100)    NOT NULL,
    Task_Type           VARCHAR(50)     NOT NULL CHECK (Task_Type IN ('selector_healing', 'failure_summarization')),
    Available           BOOLEAN         NOT NULL DEFAULT FALSE,
    Latency_Ms          INTEGER         NULL,
    Prompt_Tokens       INTEGER         NULL,
    Completion_Tokens   INTEGER         NULL,
    Response_Parseable  BOOLEAN         NULL,
    Quality_Score       NUMERIC(5,4)    NULL CHECK (Quality_Score >= 0 AND Quality_Score <= 1),
    Error_Message       TEXT            NULL,
    -- Audit columns
    Created_Date        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    Updated_Date        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    Created_By          VARCHAR(100)    NOT NULL DEFAULT 'system',
    Updated_By          VARCHAR(100)    NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_llm_benchmark_results_run_at
    ON llm_benchmark_results (Run_At);

CREATE INDEX IF NOT EXISTS idx_llm_benchmark_results_model
    ON llm_benchmark_results (Model_Id);

COMMIT;
