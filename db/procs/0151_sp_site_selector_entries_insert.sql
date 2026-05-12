-- Stored Procedure: sp_site_selector_entries_insert
-- Purpose: Insert a new site selector entry
-- Parameters:
--   i_site_id:        sites.id
--   i_element_key:    logical element identifier (e.g. 'username_field')
--   i_label:          human-readable label
--   i_selector_type:  'css' | 'xpath' | 'text' | 'role'
--   i_selector_value: the actual selector string
--   i_fallback_order: priority when multiple selectors exist for same element_key
--   i_is_active:      whether this selector is active
--   i_flow_key:       optional flow scope (links to site_flow_mappings.flow_key)
--   i_notes:          optional notes
--   i_created_by:     operator login or 'system'
-- Returns: o_id, o_element_key, o_selector_type

CREATE OR REPLACE FUNCTION sp_site_selector_entries_insert(
    i_site_id        INTEGER,
    i_element_key    VARCHAR(100),
    i_label          VARCHAR(255),
    i_selector_type  VARCHAR(50) DEFAULT 'css',
    i_selector_value TEXT DEFAULT '',
    i_fallback_order INTEGER DEFAULT 0,
    i_is_active      BOOLEAN DEFAULT TRUE,
    i_flow_key       VARCHAR(100) DEFAULT NULL,
    i_notes          TEXT DEFAULT NULL,
    i_created_by     VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id            INTEGER,
    o_element_key   VARCHAR(100),
    o_selector_type VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO site_selector_entries (
        site_id, element_key, label, selector_type, selector_value,
        fallback_order, is_active, flow_key, notes, created_by, updated_by
    ) VALUES (
        i_site_id, i_element_key, i_label, i_selector_type, i_selector_value,
        i_fallback_order, i_is_active, i_flow_key, i_notes, i_created_by, i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_element_key, i_selector_type;
END;
$$;
