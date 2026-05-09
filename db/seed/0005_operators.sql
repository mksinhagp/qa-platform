-- Seed file: Default admin operator and RBAC setup
-- Password: admin123
-- Hash generated with argon2id (m=131072, t=3, p=2)

-- Insert capabilities
INSERT INTO capabilities (name, description, created_by, updated_by) VALUES
    ('operator.manage', 'Manage operators and roles', 'system', 'system'),
    ('site_credentials.manage', 'Manage site credentials, payment profiles, email inboxes', 'system', 'system'),
    ('run.execute', 'Execute test runs', 'system', 'system'),
    ('run.read', 'Read test run results', 'system', 'system'),
    ('secret.reveal', 'Reveal secret values from vault', 'system', 'system')
ON CONFLICT DO NOTHING;

-- Insert admin role
INSERT INTO roles (name, description, is_system, created_by, updated_by) VALUES
    ('admin', 'Full system administrator', TRUE, 'system', 'system')
ON CONFLICT DO NOTHING;

-- Assign all capabilities to admin role
INSERT INTO role_capabilities (role_id, capability_id, created_by, updated_by)
SELECT r.id, c.id, 'system', 'system'
FROM roles r, capabilities c
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Insert admin operator
INSERT INTO operators (
    login,
    password_hash,
    full_name,
    email,
    active,
    created_by,
    updated_by
) VALUES (
    'admin',
    '$argon2id$v=19$m=131072,t=3,p=2$LuSmVjH3z3/hptSHSmWq7w$XPXP5DgNBKHGeTvFpVY5gg7dQuXBmdBm+MurD3uPsI4',
    'Admin User',
    'admin@example.com',
    TRUE,
    'system',
    'system'
) ON CONFLICT DO NOTHING;

-- Assign admin role to admin operator
INSERT INTO operator_role_assignments (operator_id, role_id, assigned_by, created_by, updated_by)
SELECT o.id, r.id, 'system', 'system', 'system'
FROM operators o, roles r
WHERE o.login = 'admin' AND r.name = 'admin'
ON CONFLICT DO NOTHING;
