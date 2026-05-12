-- Stored Procedure: sp_email_inbox_bindings_v2_list
-- Purpose: List email inbox bindings, optionally filtered by site/env/persona/flow
CREATE OR REPLACE FUNCTION sp_email_inbox_bindings_v2_list(
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL,
    i_persona_id VARCHAR(100) DEFAULT NULL,
    i_flow_key VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    o_id INTEGER,
    o_email_provider_id INTEGER,
    o_provider_name VARCHAR(255),
    o_provider_type VARCHAR(50),
    o_inbox_address VARCHAR(255),
    o_site_id INTEGER,
    o_site_environment_id INTEGER,
    o_persona_id VARCHAR(100),
    o_flow_key VARCHAR(100),
    o_role_tag VARCHAR(100),
    o_campaign VARCHAR(255),
    o_priority INTEGER,
    o_is_active BOOLEAN,
    o_notes TEXT,
    o_created_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        eib.id, eib.email_provider_id,
        ep.name, ep.provider_type,
        eib.inbox_address, eib.site_id, eib.site_environment_id,
        eib.persona_id, eib.flow_key, eib.role_tag, eib.campaign,
        eib.priority, eib.is_active, eib.notes, eib.created_date
    FROM email_inbox_bindings_v2 eib
    JOIN email_providers ep ON ep.id = eib.email_provider_id
    WHERE eib.is_active = TRUE
      AND (i_site_id IS NULL OR eib.site_id = i_site_id)
      AND (i_site_environment_id IS NULL OR eib.site_environment_id = i_site_environment_id)
      AND (i_persona_id IS NULL OR eib.persona_id = i_persona_id OR eib.persona_id IS NULL)
      AND (i_flow_key IS NULL OR eib.flow_key = i_flow_key OR eib.flow_key IS NULL)
    ORDER BY eib.priority DESC, eib.created_date ASC;
END;
$$;
