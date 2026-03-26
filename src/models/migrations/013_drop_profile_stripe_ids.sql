-- Migration: Remove stripe ids from profiles table (store only plan_key)

ALTER TABLE profiles
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

