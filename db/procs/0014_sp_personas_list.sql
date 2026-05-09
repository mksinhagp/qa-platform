BEGIN
-- Stored procedure: List all personas with optional filters
-- Returns: TABLE with all persona columns

CREATE OR REPLACE FUNCTION sp_personas_list(
    i_is_system BOOLEAN DEFAULT NULL,
    i_age_band VARCHAR(50) DEFAULT NULL,
    i_device_class VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
    o_id VARCHAR(100),
    o_display_name VARCHAR(255),
    o_age_band VARCHAR(50),
    o_device_class VARCHAR(50),
    o_network_profile VARCHAR(50),
    o_typing_wpm INTEGER,
    o_typing_error_rate DECIMAL(3,2),
    o_reading_wpm INTEGER,
    o_comprehension_grade_level INTEGER,
    o_hesitation_ms_per_decision INTEGER,
    o_retry_tolerance INTEGER,
    o_distraction_probability DECIMAL(3,2),
    o_assistive_tech VARCHAR(50),
    o_motor_profile VARCHAR(50),
    o_language_proficiency VARCHAR(50),
    o_payment_familiarity VARCHAR(50),
    o_abandons_on TEXT[],
    o_description TEXT,
    o_is_system BOOLEAN,
    o_created_date TIMESTAMP WITH TIME ZONE,
    o_updated_date TIMESTAMP WITH TIME ZONE,
    o_created_by VARCHAR(255),
    o_updated_by VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.display_name,
        p.age_band,
        p.device_class,
        p.network_profile,
        p.typing_wpm,
        p.typing_error_rate,
        p.reading_wpm,
        p.comprehension_grade_level,
        p.hesitation_ms_per_decision,
        p.retry_tolerance,
        p.distraction_probability,
        p.assistive_tech,
        p.motor_profile,
        p.language_proficiency,
        p.payment_familiarity,
        p.abandons_on,
        p.description,
        p.is_system,
        p.created_date,
        p.updated_date,
        p.created_by,
        p.updated_by
    FROM personas p
    WHERE
        (i_is_system IS NULL OR p.is_system = i_is_system)
        AND (i_age_band IS NULL OR p.age_band = i_age_band)
        AND (i_device_class IS NULL OR p.device_class = i_device_class)
    ORDER BY p.display_name;
END;
$$;
END;
