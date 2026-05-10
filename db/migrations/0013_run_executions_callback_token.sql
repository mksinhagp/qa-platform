BEGIN
-- Migration 0013: Add callback_token column to run_executions
-- The runner receives a one-time token per execution at run start.
-- It presents this token when posting results or approval requests
-- so the dashboard can validate the source without a full auth session.

ALTER TABLE run_executions
    ADD COLUMN IF NOT EXISTS callback_token VARCHAR(255) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_run_executions_callback_token
    ON run_executions(callback_token)
    WHERE callback_token IS NOT NULL;

END;
