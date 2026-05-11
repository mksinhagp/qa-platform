-- Stored Procedure: sp_email_validation_runs_update
-- Purpose: Update the status, timing, and error detail of an email validation run
-- Parameters:
--   i_id: email_validation_runs.id
--   i_status: new status (pending|delivered|not_found|error|timed_out)
--   i_received_at: timestamp when email arrived (null if not found)
--   i_delivery_latency_ms: latency in ms (null if not found)
--   i_poll_count: number of IMAP poll attempts made
--   i_error_message: error detail if status=error
--   i_updated_by: operator login or 'system'
-- Returns: o_id, o_status

CREATE OR REPLACE FUNCTION sp_email_validation_runs_update(
    i_id INTEGER,
    i_status VARCHAR(50),
    i_received_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    i_delivery_latency_ms INTEGER DEFAULT NULL,
    i_poll_count INTEGER DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_updated_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE email_validation_runs
    SET
        status = i_status,
        received_at = COALESCE(i_received_at, received_at),
        delivery_latency_ms = COALESCE(i_delivery_latency_ms, delivery_latency_ms),
        poll_count = COALESCE(i_poll_count, poll_count),
        error_message = COALESCE(i_error_message, error_message),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_updated_by
    WHERE id = i_id;

    RETURN QUERY SELECT i_id, i_status;
END;
$$;
