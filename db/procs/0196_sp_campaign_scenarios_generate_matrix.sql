BEGIN
-- Stored Procedure 0196: Generate campaign scenario matrix
-- Materializes all combinations of campaign dimensions into campaign_scenarios
CREATE OR REPLACE FUNCTION sp_campaign_scenarios_generate_matrix(
    i_campaign_id INTEGER,
    i_regenerate BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    o_total_scenarios INTEGER,
    o_generated INTEGER,
    o_skipped INTEGER
) AS $$
DECLARE
    v_campaign RECORD;
    v_total_scenarios INTEGER := 0;
    v_generated INTEGER := 0;
    v_skipped INTEGER := 0;
    v_scenario_hash VARCHAR(255);
BEGIN
    -- Get campaign details
    SELECT * INTO v_campaign
    FROM qa_campaigns
    WHERE id = i_campaign_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found';
    END IF;

    -- If regenerate, delete existing scenarios
    IF i_regenerate THEN
        DELETE FROM campaign_scenarios WHERE campaign_id = i_campaign_id;
    END IF;

    -- Generate scenario matrix by cross-joining all dimension arrays
    -- This is a simplified version - a full implementation would handle NULL arrays and empty combinations
    
    -- For each persona
    IF v_campaign.persona_ids IS NOT NULL AND array_length(v_campaign.persona_ids, 1) > 0 THEN
        FOR v_persona_id IN SELECT unnest(v_campaign.persona_ids) LOOP
            
            -- For each device profile
            IF v_campaign.device_profile_ids IS NOT NULL AND array_length(v_campaign.device_profile_ids, 1) > 0 THEN
                FOR v_device_profile_id IN SELECT unnest(v_campaign.device_profile_ids) LOOP
                    
                    -- For each network profile
                    IF v_campaign.network_profile_ids IS NOT NULL AND array_length(v_campaign.network_profile_ids, 1) > 0 THEN
                        FOR v_network_profile_id IN SELECT unnest(v_campaign.network_profile_ids) LOOP
                            
                            -- For each browser type
                            IF v_campaign.browser_types IS NOT NULL AND array_length(v_campaign.browser_types, 1) > 0 THEN
                                FOR v_browser_type IN SELECT unnest(v_campaign.browser_types) LOOP
                                    
                                    -- For each payment scenario
                                    IF v_campaign.payment_scenario_ids IS NOT NULL AND array_length(v_campaign.payment_scenario_ids, 1) > 0 THEN
                                        FOR v_payment_scenario_id IN SELECT unnest(v_campaign.payment_scenario_ids) LOOP
                                            
                                            -- For each email provider
                                            IF v_campaign.email_provider_ids IS NOT NULL AND array_length(v_campaign.email_provider_ids, 1) > 0 THEN
                                                FOR v_email_provider_id IN SELECT unnest(v_campaign.email_provider_ids) LOOP
                                                    
                                                    -- For each flow type
                                                    IF v_campaign.flow_types IS NOT NULL AND array_length(v_campaign.flow_types, 1) > 0 THEN
                                                        FOR v_flow_type IN SELECT unnest(v_campaign.flow_types) LOOP
                                                            
                                                            -- Generate scenario hash
                                                            v_scenario_hash := md5(
                                                                v_persona_id::text || '|' ||
                                                                v_device_profile_id::text || '|' ||
                                                                v_network_profile_id::text || '|' ||
                                                                v_browser_type || '|' ||
                                                                v_payment_scenario_id::text || '|' ||
                                                                v_email_provider_id::text || '|' ||
                                                                v_flow_type
                                                            );
                                                            
                                                            v_total_scenarios := v_total_scenarios + 1;
                                                            
                                                            -- Try to insert, skip if duplicate
                                                            BEGIN
                                                                INSERT INTO campaign_scenarios (
                                                                    campaign_id, persona_id, device_profile_id, network_profile_id,
                                                                    browser_type, payment_scenario_id, email_provider_id, flow_type,
                                                                    scenario_hash
                                                                )
                                                                VALUES (
                                                                    i_campaign_id, v_persona_id, v_device_profile_id, v_network_profile_id,
                                                                    v_browser_type, v_payment_scenario_id, v_email_provider_id, v_flow_type,
                                                                    v_scenario_hash
                                                                );
                                                                v_generated := v_generated + 1;
                                                            EXCEPTION WHEN unique_violation THEN
                                                                v_skipped := v_skipped + 1;
                                                            END;
                                                            
                                                        END LOOP;
                                                    ELSE
                                                        -- No flow types, skip
                                                        CONTINUE;
                                                    END IF;
                                                    
                                                END LOOP;
                                            ELSE
                                                -- No email providers, skip
                                                CONTINUE;
                                            END IF;
                                            
                                        END LOOP;
                                    ELSE
                                        -- No payment scenarios, skip
                                        CONTINUE;
                                    END IF;
                                    
                                END LOOP;
                            ELSE
                                -- No browser types, skip
                                CONTINUE;
                            END IF;
                            
                        END LOOP;
                    ELSE
                        -- No network profiles, skip
                        CONTINUE;
                    END IF;
                    
                END LOOP;
            ELSE
                -- No device profiles, skip
                CONTINUE;
            END IF;
            
        END LOOP;
    ELSE
        -- No personas, skip
        RAISE NOTICE 'No personas defined for campaign';
    END IF;

    RETURN QUERY SELECT v_total_scenarios, v_generated, v_skipped;
END;
$$ LANGUAGE plpgsql;
END
