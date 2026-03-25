-- Migration: Create Stripe transaction + subscription tables
-- This project verifies payment after checkout using session_id (no webhooks).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Stores the Stripe Checkout Session that the user paid for.
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  plan_key VARCHAR(100) NOT NULL,
  stripe_customer_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_total BIGINT,
  currency VARCHAR(10),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_transactions_user_id ON stripe_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_plan_key ON stripe_transactions(plan_key);

-- Stores the active Stripe subscription after verification.
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES stripe_transactions(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_key VARCHAR(100) NOT NULL,
  status VARCHAR(50),
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_stripe_subscriptions_transaction UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_plan_key ON stripe_subscriptions(plan_key);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);

