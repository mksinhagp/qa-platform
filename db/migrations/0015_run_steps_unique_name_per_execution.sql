BEGIN
-- Migration 0015: Add unique constraint on (run_execution_id, step_name) in run_steps.
-- Required so that sp_run_executions_update_result can use ON CONFLICT DO UPDATE
-- to overwrite pre-inserted approval step rows with their final status (passed/failed/skipped)
-- rather than silently dropping the update with ON CONFLICT DO NOTHING.

ALTER TABLE run_steps
    ADD CONSTRAINT uq_run_steps_execution_step_name
    UNIQUE (run_execution_id, step_name);

END;
