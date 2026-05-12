-- Stored Procedure: sp_email_inbox_bindings_v2_insert
-- Purpose: Insert a new inbox binding linking an email provider to a site/env/persona/flow context
CREATE OR REPLACE FUNCTION sp_email_inbox_bindings_v2_insert(
    i_email_provider_id INTEGER,
    i_inbox_address VARCHAR(255),
    i_site_id INTEGER DEFAULT NULL,
    i_site_environment_id INTEGER DEFAULT NULL,
    i_persona_id VARCHAR(100) DEFAULT NULL,
    i_flow_key VARCHAR(100) DEFAULT NULL,
    i_role_tag VARCHAR(100) DEFAULT NULL,
    i_campaign VARCHAR(255) DEFAULT NULL,
    i_priority INTEGER DEFAULT 0,
    i_is_active BOOLEAN DEFAULT TRUE,
    i_notes TEXT DEFAULT NULL,
    i_created_by VARCHAR(255) DEFAULT 'system'
)
RETURNS TABLE (
    o_id INTEGER,
    o_inbox_address VARCHAR(255),
    o_priority INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO email_inbox_bindings_v2 (
        email_provider_id, inbox_address, site_id, site_environment_id,
        persona_id, flow_key, role_tag, campaign, priority,
        is_active, notes, created_by, updated_by
    ) VALUES (
        i_email_provider_id, i_inbox_address, i_site_id, i_site_environment_id,
        i_persona_id, i_flow_key, i_role_tag, i_campaign, i_priority,
        i_is_active, i_notes, i_created_by, i_created_by
    )
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, i_inbox_address, i_priority;
END;
$$;
