-- Stored Procedure: sp_site_capabilities_batch_upsert
-- Purpose: Upsert multiple capabilities for a site at once (used by onboarding wizard)
-- Parameters:
--   i_site_id:          sites.id
--   i_capability_keys:  array of capability keys (parallel to i_enabled_flags)
--   i_enabled_flags:    array of booleans (parallel to i_capability_keys)
--   i_created_by:       operator login or 'system'
-- Returns: o_upserted_count — number of rows inserted or updated

CREATE OR REPLACE FUNCTION sp_site_capabilities_batch_upsert(
    i_site_id         INTEGER,
    i_capability_keys TEXT[],
    i_enabled_flags   BOOLEAN[],
    i_created_by      VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_upserted_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_idx   INTEGER;
BEGIN
    FOR v_idx IN 1..array_length(i_capability_keys, 1) LOOP
        INSERT INTO site_capabilities (
            site_id, capability_key, is_enabled, created_by, updated_by
        ) VALUES (
            i_site_id,
            i_capability_keys[v_idx],
            COALESCE(i_enabled_flags[v_idx], TRUE),
            i_created_by,
            i_created_by
        )
        ON CONFLICT (site_id, capability_key)
        DO UPDATE SET
            is_enabled   = EXCLUDED.is_enabled,
            updated_date = CURRENT_TIMESTAMP,
            updated_by   = i_created_by;

        v_count := v_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_count;
END;
$$;
