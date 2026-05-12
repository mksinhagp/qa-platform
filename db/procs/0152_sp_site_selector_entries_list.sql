-- Stored Procedure: sp_site_selector_entries_list
-- Purpose: List selector entries for a site, optionally filtered by element_key or flow_key
-- Parameters:
--   i_site_id:     sites.id
--   i_element_key: optional — restrict to a specific element key
--   i_flow_key:    optional — restrict to a specific flow scope
-- Returns: full selector entry record columns ordered by element_key, fallback_order

CREATE OR REPLACE FUNCTION sp_site_selector_entries_list(
    i_site_id     INTEGER,
    i_element_key VARCHAR(100) DEFAULT NULL,
    i_flow_key    VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    o_id             INTEGER,
    o_element_key    VARCHAR(100),
    o_label          VARCHAR(255),
    o_selector_type  VARCHAR(50),
    o_selector_value TEXT,
    o_fallback_order INTEGER,
    o_is_active      BOOLEAN,
    o_flow_key       VARCHAR(100),
    o_notes          TEXT,
    o_created_date   TIMESTAMP WITH TIME ZONE,
    o_updated_date   TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sse.id,
        sse.element_key,
        sse.label,
        sse.selector_type,
        sse.selector_value,
        sse.fallback_order,
        sse.is_active,
        sse.flow_key,
        sse.notes,
        sse.created_date,
        sse.updated_date
    FROM site_selector_entries sse
    WHERE sse.site_id = i_site_id
      AND (i_element_key IS NULL OR sse.element_key = i_element_key)
      AND (i_flow_key IS NULL OR sse.flow_key = i_flow_key)
    ORDER BY sse.element_key, sse.fallback_order;
END;
$$;
