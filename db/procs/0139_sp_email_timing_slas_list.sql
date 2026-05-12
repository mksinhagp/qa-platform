-- Stored Procedure: sp_email_timing_slas_list
-- Purpose: List all email timing SLA definitions for a given site
CREATE OR REPLACE FUNCTION sp_email_timing_slas_list(
    i_site_id INTEGER
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_type VARCHAR(50),
    o_max_delivery_ms INTEGER,
    o_warn_delivery_ms INTEGER,
    o_is_active BOOLEAN,
    o_notes TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ets.id, ets.email_type, ets.max_delivery_ms, ets.warn_delivery_ms,
        ets.is_active, ets.notes, ets.created_date
    FROM email_timing_slas ets
    WHERE ets.site_id = i_site_id
    ORDER BY ets.email_type;
END;
$$;
