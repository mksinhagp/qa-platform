BEGIN
-- Migration 0004: Persona, device, and network profile tables
-- Tables: personas, device_profiles, network_profiles

-- personas table: Persona definitions (ships seeded with v1 library)
CREATE TABLE IF NOT EXISTS personas (
    id VARCHAR(100) PRIMARY KEY, -- e.g. 'elderly_first_time'
    display_name VARCHAR(255) NOT NULL,
    age_band VARCHAR(50) NOT NULL, -- 'child', 'teen', 'adult', 'older_adult', 'senior'
    device_class VARCHAR(50) NOT NULL, -- 'desktop', 'laptop', 'tablet', 'mobile', 'low_end_mobile'
    network_profile VARCHAR(50) NOT NULL, -- 'fast', 'normal', 'slow_3g', 'flaky'
    typing_wpm INTEGER NOT NULL DEFAULT 60,
    typing_error_rate DECIMAL(3,2) NOT NULL DEFAULT 0.02, -- 0..1
    reading_wpm INTEGER NOT NULL DEFAULT 200,
    comprehension_grade_level INTEGER NOT NULL DEFAULT 8,
    hesitation_ms_per_decision INTEGER NOT NULL DEFAULT 500,
    retry_tolerance INTEGER NOT NULL DEFAULT 3,
    distraction_probability DECIMAL(3,2) NOT NULL DEFAULT 0.05, -- 0..1
    assistive_tech VARCHAR(50) NOT NULL DEFAULT 'none', -- 'none', 'screen_reader', 'high_contrast', 'zoom_400'
    motor_profile VARCHAR(50) NOT NULL DEFAULT 'normal', -- 'normal', 'tremor', 'single_handed'
    language_proficiency VARCHAR(50) NOT NULL DEFAULT 'native', -- 'native', 'second_language'
    payment_familiarity VARCHAR(50) NOT NULL DEFAULT 'high', -- 'high', 'low'
    abandons_on TEXT[], -- e.g. ARRAY['captcha', 'phone_verification']
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_personas_age_band ON personas(age_band);
CREATE INDEX idx_personas_device_class ON personas(device_class);
CREATE INDEX idx_personas_is_system ON personas(is_system);

-- device_profiles table: Device + viewport + UA configurations
CREATE TABLE IF NOT EXISTS device_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    device_type VARCHAR(50) NOT NULL, -- 'desktop', 'laptop', 'tablet', 'mobile'
    viewport_width INTEGER NOT NULL,
    viewport_height INTEGER NOT NULL,
    device_pixel_ratio DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    user_agent TEXT,
    is_touch BOOLEAN NOT NULL DEFAULT FALSE,
    screen_orientation VARCHAR(20) NOT NULL DEFAULT 'portrait', -- 'portrait', 'landscape'
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_device_profiles_name ON device_profiles(name);
CREATE INDEX idx_device_profiles_device_type ON device_profiles(device_type);
CREATE INDEX idx_device_profiles_is_system ON device_profiles(is_system);

-- network_profiles table: Throughput / latency / loss profiles
CREATE TABLE IF NOT EXISTS network_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    download_kbps INTEGER NOT NULL,
    upload_kbps INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    packet_loss_percent DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_by VARCHAR(255) NOT NULL DEFAULT 'system'
);

CREATE INDEX idx_network_profiles_name ON network_profiles(name);
CREATE INDEX idx_network_profiles_is_system ON network_profiles(is_system);

END;
