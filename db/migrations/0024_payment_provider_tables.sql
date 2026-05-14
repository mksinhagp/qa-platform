BEGIN
-- Migration 0024: Payment provider tables for Phase 17
-- Tables: payment_providers, payment_transactions, payment_scenarios

-- payment_providers table: Payment provider configurations (Authorize.net, Stripe, PayPal, etc.)
CREATE TABLE IF NOT EXISTS payment_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(50) NOT NULL, -- 'authorize_net', 'stripe', 'paypal', etc.
    is_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
    api_login_id_secret_id INTEGER REFERENCES secret_records(id) ON DELETE SET NULL, -- For Authorize.net
    api_transaction_key_secret_id INTEGER REFERENCES secret_records(id) ON DELETE SET NULL, -- For Authorize.net
    api_key_secret_id INTEGER REFERENCES secret_records(id) ON DELETE SET NULL, -- For Stripe/PayPal
    api_secret_secret_id INTEGER REFERENCES secret_records(id) ON DELETE SET NULL, -- For Stripe/PayPal
    merchant_id VARCHAR(255),
    environment_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(name, provider_type, is_sandbox)
);

CREATE INDEX idx_payment_providers_provider_type ON payment_providers(provider_type);
CREATE INDEX idx_payment_providers_is_active ON payment_providers(is_active);

-- payment_scenarios table: Test scenarios for payment testing
CREATE TABLE IF NOT EXISTS payment_scenarios (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    scenario_type VARCHAR(50) NOT NULL, -- 'success', 'decline', 'avs_failure', 'cvv_failure', 'duplicate', 'void', 'refund'
    description TEXT,
    expected_result VARCHAR(50) NOT NULL, -- 'approved', 'declined', 'error'
    test_card_number VARCHAR(255), -- Encrypted or reference to test card
    test_cvv VARCHAR(10),
    test_expiry_month INTEGER,
    test_expiry_year INTEGER,
    test_amount DECIMAL(10,2) DEFAULT 1.00,
    avs_zip_code VARCHAR(20),
    avs_address VARCHAR(100),
    expected_response_code VARCHAR(50),
    expected_response_reason VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_payment_scenarios_scenario_type ON payment_scenarios(scenario_type);
CREATE INDEX idx_payment_scenarios_is_active ON payment_scenarios(is_active);

-- payment_transactions table: Track payment attempts and results
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    run_execution_id INTEGER REFERENCES run_executions(id) ON DELETE CASCADE,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER REFERENCES site_environments(id) ON DELETE CASCADE,
    persona_id VARCHAR(255) REFERENCES personas(id) ON DELETE SET NULL,
    payment_provider_id INTEGER REFERENCES payment_providers(id) ON DELETE SET NULL,
    payment_profile_id INTEGER REFERENCES payment_profiles(id) ON DELETE SET NULL,
    payment_scenario_id INTEGER REFERENCES payment_scenarios(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'authorize', 'capture', 'void', 'refund'
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    provider_transaction_id VARCHAR(255), -- External transaction ID from provider
    provider_response_code VARCHAR(50),
    provider_response_reason VARCHAR(500),
    provider_response_text TEXT,
    status VARCHAR(50) NOT NULL, -- 'pending', 'approved', 'declined', 'error', 'voided', 'refunded'
    ui_confirmation TEXT, -- UI confirmation message/text
    email_receipt_verified BOOLEAN DEFAULT FALSE,
    email_receipt_details TEXT,
    admin_reconciled BOOLEAN DEFAULT FALSE,
    admin_reconciliation_details TEXT,
    error_message TEXT,
    redacted_card_number VARCHAR(20), -- Only last 4 or masked version
    redacted_cvv VARCHAR(10), -- Masked version
    test_data_generated BOOLEAN DEFAULT FALSE,
    test_data_cleanup_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'cleanup_requested', 'cleanup_completed', 'cleanup_failed'
    approval_id INTEGER REFERENCES approvals(id) ON DELETE SET NULL, -- For risky operations
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_payment_transactions_run_execution_id ON payment_transactions(run_execution_id);
CREATE INDEX idx_payment_transactions_site_id ON payment_transactions(site_id);
CREATE INDEX idx_payment_transactions_payment_provider_id ON payment_transactions(payment_provider_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_provider_transaction_id ON payment_transactions(provider_transaction_id);
CREATE INDEX idx_payment_transactions_created_date ON payment_transactions(created_date);

-- payment_provider_bindings table: Bind payment providers to sites/environments
CREATE TABLE IF NOT EXISTS payment_provider_bindings (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    site_environment_id INTEGER NOT NULL REFERENCES site_environments(id) ON DELETE CASCADE,
    payment_provider_id INTEGER NOT NULL REFERENCES payment_providers(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255) NOT NULL,
    UNIQUE(site_environment_id, payment_provider_id)
);

CREATE INDEX idx_payment_provider_bindings_site_id ON payment_provider_bindings(site_id);
CREATE INDEX idx_payment_provider_bindings_env_id ON payment_provider_bindings(site_environment_id);
CREATE INDEX idx_payment_provider_bindings_provider_id ON payment_provider_bindings(payment_provider_id);
CREATE INDEX idx_payment_provider_bindings_is_active ON payment_provider_bindings(is_active);
END
