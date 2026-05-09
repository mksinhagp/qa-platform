BEGIN
-- Seed file: Network profiles
-- Covers common network conditions for testing

-- Fast network (fiber, high-speed broadband)
INSERT INTO network_profiles (
    name,
    download_kbps,
    upload_kbps,
    latency_ms,
    packet_loss_percent,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'fast',
    50000,
    20000,
    5,
    0.0,
    'Fast network: 50 Mbps download, 20 Mbps upload, 5ms latency, no packet loss',
    TRUE,
    'system',
    'system'
);

-- Normal network (typical broadband)
INSERT INTO network_profiles (
    name,
    download_kbps,
    upload_kbps,
    latency_ms,
    packet_loss_percent,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'normal',
    10000,
    5000,
    25,
    0.1,
    'Normal network: 10 Mbps download, 5 Mbps upload, 25ms latency, 0.1% packet loss',
    TRUE,
    'system',
    'system'
);

-- Slow 3G network
INSERT INTO network_profiles (
    name,
    download_kbps,
    upload_kbps,
    latency_ms,
    packet_loss_percent,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'slow_3g',
    750,
    250,
    100,
    1.0,
    'Slow 3G network: 750 Kbps download, 250 Kbps upload, 100ms latency, 1% packet loss',
    TRUE,
    'system',
    'system'
);

-- Flaky network (unstable connection)
INSERT INTO network_profiles (
    name,
    download_kbps,
    upload_kbps,
    latency_ms,
    packet_loss_percent,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'flaky',
    5000,
    2000,
    150,
    3.0,
    'Flaky network: 5 Mbps download, 2 Mbps upload, 150ms latency, 3% packet loss',
    TRUE,
    'system',
    'system'
);

-- Offline (no connectivity simulation)
INSERT INTO network_profiles (
    name,
    download_kbps,
    upload_kbps,
    latency_ms,
    packet_loss_percent,
    description,
    is_system,
    created_by,
    updated_by
) VALUES (
    'offline',
    0,
    0,
    0,
    100.0,
    'Offline: no connectivity simulation',
    TRUE,
    'system',
    'system'
);
END;
