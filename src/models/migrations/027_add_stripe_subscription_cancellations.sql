BEGIN;

ALTER TABLE stripe_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE stripe_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP;

DROP TABLE IF EXISTS stripe_subscription_cancellations;

COMMIT;
