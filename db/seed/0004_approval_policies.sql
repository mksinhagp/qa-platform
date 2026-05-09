BEGIN
-- Seed file: Default approval policies (master plan §8.1)
-- Seeds the approval_policies table with the 10 default action categories and their default approval strengths.
-- These are system-level defaults; QA admins can override per site environment via the approval_policies table.

-- Read-only API health probe: No approval required
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'api_health_probe',
    'none',
    'Read-only API health probe. No user interaction or data mutation.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Browsing / search interactions: No approval required
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'browsing_search',
    'none',
    'Browsing and search interactions. Read-only navigation with no side effects.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Form fill (no submit): No approval required
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'form_fill',
    'none',
    'Form field entry without submission. No data sent to server.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Registration submit: One-click approval
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'registration_submit',
    'one_click',
    'Registration form submission. Creates a new account on the target site.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Login attempt with saved credential: One-click approval
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'login_attempt',
    'one_click',
    'Login attempt using a saved credential from the vault.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Cart add/remove: One-click approval
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'cart_modify',
    'one_click',
    'Add or remove items from a shopping cart. Reversible action.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Checkout submit (payment): Strong approval (typed reason, profile confirm)
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'checkout_payment',
    'strong',
    'Checkout submission involving payment. Requires typed reason and payment profile confirmation.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Admin write (create/update): Strong approval (typed reason)
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'admin_write',
    'strong',
    'Administrative create or update operation on the target site. Requires typed reason.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Admin delete / cancel / refund: Strong approval (typed reason + optional second approver)
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'admin_delete',
    'strong',
    'Administrative delete, cancel, or refund operation. Requires typed reason. Second approver toggle configurable.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

-- Vault administration: Strong approval (re-enter master password)
INSERT INTO approval_policies (
    action_category, default_strength, description,
    is_system, created_by, updated_by
) VALUES (
    'vault_administration',
    'strong',
    'Vault administrative action (bootstrap, rotate, re-key). Requires re-entering the master password.',
    TRUE, 'system', 'system'
) ON CONFLICT (action_category) DO NOTHING;

END;
