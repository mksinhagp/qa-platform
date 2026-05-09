BEGIN
-- Seed file: Device profiles
-- Covers common device types and viewports for testing

-- Desktop - 1920x1080
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'desktop_1920x1080',
    'desktop',
    1920,
    1080,
    1.0,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    FALSE,
    'landscape',
    'Standard desktop monitor 1920x1080',
    TRUE,
    'system',
    'system'
);

-- Desktop - 1366x768 (laptop)
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'laptop_1366x768',
    'laptop',
    1366,
    768,
    1.0,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    FALSE,
    'landscape',
    'Common laptop resolution 1366x768',
    TRUE,
    'system',
    'system'
);

-- Tablet - iPad portrait
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'tablet_ipad_portrait',
    'tablet',
    768,
    1024,
    2.0,
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    TRUE,
    'portrait',
    'iPad in portrait mode 768x1024',
    TRUE,
    'system',
    'system'
);

-- Tablet - iPad landscape
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'tablet_ipad_landscape',
    'tablet',
    1024,
    768,
    2.0,
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    TRUE,
    'landscape',
    'iPad in landscape mode 1024x768',
    TRUE,
    'system',
    'system'
);

-- Mobile - iPhone 14 Pro portrait
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'mobile_iphone_14_pro_portrait',
    'mobile',
    393,
    852,
    3.0,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    TRUE,
    'portrait',
    'iPhone 14 Pro portrait 393x852',
    TRUE,
    'system',
    'system'
);

-- Mobile - iPhone 14 Pro landscape
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'mobile_iphone_14_pro_landscape',
    'mobile',
    852,
    393,
    3.0,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    TRUE,
    'landscape',
    'iPhone 14 Pro landscape 852x393',
    TRUE,
    'system',
    'system'
);

-- Mobile - Android portrait
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'mobile_android_portrait',
    'mobile',
    360,
    800,
    2.0,
    'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    TRUE,
    'portrait',
    'Android phone portrait 360x800',
    TRUE,
    'system',
    'system'
);

-- Low-end mobile
INSERT INTO device_profiles (
    name,
    device_type,
    viewport_width,
    viewport_height,
    device_pixel_ratio,
    user_agent,
    is_touch,
    screen_orientation,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'mobile_low_end_portrait',
    'low_end_mobile',
    320,
    568,
    1.0,
    'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    TRUE,
    'portrait',
    'Low-end mobile device 320x568',
    TRUE,
    'system',
    'system'
);
END;
