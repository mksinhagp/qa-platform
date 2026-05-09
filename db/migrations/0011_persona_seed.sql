BEGIN
-- Migration 0011: Seed v1 persona library, device profiles, and network profiles
-- This data is inserted once and treated as system records (is_system = TRUE)

-- ─── Personas ────────────────────────────────────────────────────────────────

INSERT INTO personas (id, display_name, age_band, device_class, network_profile, typing_wpm, typing_error_rate, reading_wpm, comprehension_grade_level, hesitation_ms_per_decision, retry_tolerance, distraction_probability, assistive_tech, motor_profile, language_proficiency, payment_familiarity, abandons_on, description, is_system, created_by, updated_by)
VALUES
  ('confident_desktop', 'Alex, 34 – Tech-savvy desktop user', 'adult', 'desktop', 'fast', 75, 0.01, 250, 12, 300, 5, 0.02, 'none', 'normal', 'native', 'high', ARRAY[]::TEXT[], 'Baseline persona. Fast typist, low hesitation, fast network, high payment comfort.', TRUE, 'system', 'system'),
  ('average_mobile', 'Maria, 28 – iPhone user, easily distracted', 'adult', 'mobile', 'normal', 45, 0.04, 200, 10, 600, 3, 0.15, 'none', 'normal', 'native', 'high', ARRAY['long_form', 'document_upload'], 'Distracted mobile user; representative of the majority of booking site visitors.', TRUE, 'system', 'system'),
  ('elderly_first_time', 'Eleanor, 72 – First-time online, low-end tablet', 'senior', 'tablet', 'slow_3g', 25, 0.08, 120, 5, 2000, 2, 0.05, 'zoom_400', 'normal', 'native', 'low', ARRAY['captcha', 'phone_verification', 'complex_forms', 'multi_step_payment'], 'Senior first-time user. 400% zoom, slow typing, abandons on friction points.', TRUE, 'system', 'system'),
  ('low_literacy_slow', 'Carlos, 41 – Grade-4 comprehension, second language', 'adult', 'mobile', 'slow_3g', 30, 0.06, 130, 4, 1800, 2, 0.10, 'none', 'normal', 'second_language', 'low', ARRAY['legal_text_wall', 'complex_forms', 'error_message_unclear'], 'Second-language adult with low reading comprehension. Needs simple copy and clear errors.', TRUE, 'system', 'system'),
  ('screen_reader_user', 'Jordan, 38 – Desktop, keyboard-only / screen reader', 'adult', 'desktop', 'normal', 55, 0.02, 180, 12, 800, 3, 0.02, 'screen_reader', 'normal', 'native', 'high', ARRAY['image_only_captcha', 'missing_aria_labels'], 'Keyboard-only navigation and accessibility-tree assertions. NVDA-style emulation.', TRUE, 'system', 'system'),
  ('motor_impaired_tremor', 'Sam, 52 – Mobile, hand tremor, needs large targets', 'adult', 'mobile', 'normal', 20, 0.07, 180, 10, 1200, 4, 0.03, 'none', 'tremor', 'native', 'high', ARRAY['small_tap_targets', 'drag_required'], 'Motor-impaired user with hand tremor. Needs 44px+ targets and tolerance for imprecise clicks.', TRUE, 'system', 'system')
ON CONFLICT (id) DO NOTHING;

-- ─── Device Profiles ─────────────────────────────────────────────────────────

INSERT INTO device_profiles (name, device_type, viewport_width, viewport_height, device_pixel_ratio, user_agent, is_touch, screen_orientation, description, is_system, created_by, updated_by)
VALUES
  ('Desktop 1920×1080', 'desktop', 1920, 1080, 1.0, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', FALSE, 'landscape', 'Standard desktop Chrome', TRUE, 'system', 'system'),
  ('Desktop 1440×900', 'desktop', 1440, 900, 1.0, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', FALSE, 'landscape', 'MacBook Pro 14"', TRUE, 'system', 'system'),
  ('iPhone 14 Pro', 'mobile', 393, 852, 3.0, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', TRUE, 'portrait', 'iPhone 14 Pro – representative high-end mobile', TRUE, 'system', 'system'),
  ('Android Mid-range', 'mobile', 412, 915, 2.6, 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36', TRUE, 'portrait', 'Pixel 7 – mid-range Android', TRUE, 'system', 'system'),
  ('iPad Air', 'tablet', 820, 1180, 2.0, 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', TRUE, 'portrait', 'iPad Air – representative tablet', TRUE, 'system', 'system'),
  ('Low-end Android', 'mobile', 360, 740, 2.0, 'Mozilla/5.0 (Linux; Android 10; SM-A115M) AppleWebKit/537.36 Mobile Safari/537.36', TRUE, 'portrait', 'Samsung A11 – low-end mobile', TRUE, 'system', 'system')
ON CONFLICT (name) DO NOTHING;

-- ─── Network Profiles ────────────────────────────────────────────────────────

INSERT INTO network_profiles (name, download_kbps, upload_kbps, latency_ms, packet_loss_percent, description, is_system, created_by, updated_by)
VALUES
  ('Fast (100 Mbps)', 102400, 51200, 5, 0.0, 'Fast broadband / Wi-Fi connection. Baseline.', TRUE, 'system', 'system'),
  ('Normal (20 Mbps)', 20480, 10240, 20, 0.0, 'Typical home broadband / 4G LTE connection.', TRUE, 'system', 'system'),
  ('Slow 3G', 400, 200, 300, 0.0, 'Slow 3G mobile network. Edge / rural coverage.', TRUE, 'system', 'system'),
  ('Flaky (packet loss)', 5120, 2560, 100, 5.0, 'Unreliable connection with 5% packet loss. Trains / public Wi-Fi.', TRUE, 'system', 'system')
ON CONFLICT (name) DO NOTHING;

END;
