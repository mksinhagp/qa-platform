-- Stored Procedure: sp_email_timing_results_insert
-- Purpose: Record the outcome of an email delivery timing check for a test run execution
CREATE OR REPLACE FUNCTION sp_email_timing_results_insert(
    i_run_execution_id INTEGER,
    i_email_type VARCHAR(50),
    i_delivery_latency_ms INTEGER DEFAULT NULL,
    i_sla_status VARCHAR(50) DEFAULT 'unknown',
    i_timeout_occurred BOOLEAN DEFAULT FALSE,
    i_correlation_token VARCHAR(255) DEFAULT NULL,
    i_provider_type VARCHAR(50) DEFAULT NULL,
    i_error_message TEXT DEFAULT NULL,
    i_email_timing_sla_id INTEGER DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_type VARCHAR(50),
    o_sla_status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_timing_results (
        run_execution_id, email_timing_sla_id, email_type,
        delivery_latency_ms, sla_status, timeout_occurred,
        correlation_token, provider_type, error_message,
        created_by, updated_by
    ) VALUES (
        i_run_execution_id, i_email_timing_sla_id, i_email_type,
        i_delivery_latency_ms, i_sla_status, i_timeout_occurred,
        i_correlation_token, i_provider_type, i_error_message,
        i_created_by, i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_email_type, i_sla_status;
END;
$$;
