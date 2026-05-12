BEGIN
-- Migration 0027: Add idempotency_key column to payment_transactions
-- Allows the runner callback to retry safely without creating duplicate rows.
-- The runner generates a UUID per payment operation and passes it as the
-- idempotency_key; the upsert SP uses ON CONFLICT to update existing rows.

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) DEFAULT NULL;

-- Unique index for idempotent upserts — NULL keys are ignored by UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_idempotency_key
    ON payment_transactions(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

END
