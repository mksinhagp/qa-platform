-- Stored Procedure: sp_email_timing_slas_insert
-- Purpose: Insert or update an email delivery SLA definition for a site/email_type
CREATE OR REPLACE FUNCTION sp_email_timing_slas_insert(
    i_site_id INTEGER,
    i_email_type VARCHAR(50),
    i_max_delivery_ms INTEGER DEFAULT 300000,
    i_warn_delivery_ms INTEGER DEFAULT 60000,
    i_is_active BOOLEAN DEFAULT TRUE,
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_type VARCHAR(50),
    o_max_delivery_ms INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_timing_slas (
        site_id, email_type, max_delivery_ms, warn_delivery_ms,
        is_active, notes, created_by, updated_by
    ) VALUES (
        i_site_id, i_email_type, i_max_delivery_ms, i_warn_delivery_ms,
        i_is_active, i_notes, i_created_by, i_created_by
    )
    ON CONFLICT (site_id, email_type)
    DO UPDATE SET
        max_delivery_ms = EXCLUDED.max_delivery_ms,
        warn_delivery_ms = EXCLUDED.warn_delivery_ms,
        is_active = EXCLUDED.is_active,
        notes = COALESCE(EXCLUDED.notes, email_timing_slas.notes),
        updated_date = CURRENT_TIMESTAMP,
        updated_by = i_created_by
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_email_type, i_max_delivery_ms;
END;
$$;
