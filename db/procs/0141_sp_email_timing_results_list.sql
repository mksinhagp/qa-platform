-- Stored Procedure: sp_email_timing_results_list
-- Purpose: List all email timing results for a given run execution, joined with SLA thresholds
CREATE OR REPLACE FUNCTION sp_email_timing_results_list(
    i_run_execution_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_type VARCHAR(50),
    o_delivery_latency_ms INTEGER,
    o_sla_status VARCHAR(50),
    o_timeout_occurred BOOLEAN,
    o_correlation_token VARCHAR(255),
    o_provider_type VARCHAR(50),
    o_error_message TEXT,
    o_max_delivery_ms INTEGER,
    o_warn_delivery_ms INTEGER,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        etr.id, etr.email_type, etr.delivery_latency_ms,
        etr.sla_status, etr.timeout_occurred,
        etr.correlation_token, etr.provider_type, etr.error_message,
        ets.max_delivery_ms, ets.warn_delivery_ms,
        etr.created_date
    FROM email_timing_results etr
    LEFT JOIN email_timing_slas ets ON ets.id = etr.email_timing_sla_id
    WHERE etr.run_execution_id = i_run_execution_id
    ORDER BY etr.created_date ASC;
END;
$$;
