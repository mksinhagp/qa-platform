-- Stored Procedure: sp_site_selector_entries_update
-- Purpose: Update a site selector entry by id (partial update; NULL = leave unchanged)
-- Parameters:
--   i_id:             site_selector_entries.id
--   i_label:          new label (NULL = leave unchanged)
--   i_selector_type:  new selector type (NULL = leave unchanged)
--   i_selector_value: new selector string (NULL = leave unchanged)
--   i_fallback_order: new fallback priority (NULL = leave unchanged)
--   i_is_active:      active flag (NULL = leave unchanged)
--   i_flow_key:       flow scope (NULL = leave unchanged)
--   i_notes:          notes (NULL = leave unchanged)
--   i_updated_by:     operator login or 'system'
-- Returns: o_id, o_element_key, o_selector_type

CREATE OR REPLACE FUNCTION sp_site_selector_entries_update(
    i_id             INTEGER,
    i_label          VARCHAR(255) DEFAULT NULL,
    i_selector_type  VARCHAR(50) DEFAULT NULL,
    i_selector_value TEXT DEFAULT NULL,
    i_fallback_order INTEGER DEFAULT NULL,
    i_is_active      BOOLEAN DEFAULT NULL,
    i_flow_key       VARCHAR(100) DEFAULT NULL,
    i_notes          TEXT DEFAULT NULL,
    i_updated_by     VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id            INTEGER,
    o_element_key   VARCHAR(100),
    o_selector_type VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE site_selector_entries
    SET
        label          = COALESCE(i_label, label),
        selector_type  = COALESCE(i_selector_type, selector_type),
        selector_value = COALESCE(i_selector_value, selector_value),
        fallback_order = COALESCE(i_fallback_order, fallback_order),
        is_active      = COALESCE(i_is_active, is_active),
        flow_key       = COALESCE(i_flow_key, flow_key),
        notes          = COALESCE(i_notes, notes),
        updated_date   = CURRENT_TIMESTAMP,
        updated_by     = i_updated_by
    WHERE id = i_id;

    RETURN QUERY
    SELECT sse.id, sse.element_key, sse.selector_type
    FROM site_selector_entries sse
    WHERE sse.id = i_id;
END;
$$;
