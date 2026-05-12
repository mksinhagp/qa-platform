-- Stored Procedure: sp_email_inbox_bindings_v2_resolve
-- Purpose: Find the best-matching inbox binding for a given context
-- Uses priority ordering: most specific match wins (most non-NULL dimension columns)
CREATE OR REPLACE FUNCTION sp_email_inbox_bindings_v2_resolve(
    i_site_id INTEGER,
    i_site_environment_id INTEGER DEFAULT NULL,
    i_persona_id VARCHAR(100) DEFAULT NULL,
    i_flow_key VARCHAR(100) DEFAULT NULL,
    i_role_tag VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_provider_id INTEGER,
    o_provider_name VARCHAR(255),
    o_provider_type VARCHAR(50),
    o_inbox_address VARCHAR(255),
    o_priority INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        eib.id, eib.email_provider_id,
        ep.name, ep.provider_type,
        eib.inbox_address, eib.priority
    FROM email_inbox_bindings_v2 eib
    JOIN email_providers ep ON ep.id = eib.email_provider_id
    WHERE eib.is_active = TRUE
      AND ep.is_active = TRUE
      AND eib.site_id = i_site_id
      AND (eib.site_environment_id IS NULL OR eib.site_environment_id = i_site_environment_id)
      AND (eib.persona_id IS NULL OR eib.persona_id = i_persona_id)
      AND (eib.flow_key IS NULL OR eib.flow_key = i_flow_key)
      AND (eib.role_tag IS NULL OR eib.role_tag = i_role_tag)
    ORDER BY
        -- More specific matches first (non-null columns score higher)
        (CASE WHEN eib.site_environment_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN eib.persona_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN eib.flow_key IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN eib.role_tag IS NOT NULL THEN 1 ELSE 0 END) DESC,
        eib.priority DESC
    LIMIT 1;
END;
$$;
