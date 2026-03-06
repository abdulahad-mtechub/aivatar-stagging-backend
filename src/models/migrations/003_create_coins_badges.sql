-- =============================================
-- Migration 003: Coins, Rewards & Badge System
-- =============================================

-- Reward Management Table (Rule Engine)
CREATE TABLE IF NOT EXISTS reward_management (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  module_type VARCHAR(50),
  trigger_event VARCHAR(100),
  reward_type VARCHAR(50),
  type VARCHAR(50) DEFAULT 'generic',
  points_amount INTEGER NOT NULL DEFAULT 10 CHECK (points_amount >= 10),
  frequency_limit VARCHAR(50),
  events_per_day INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Earned Reward Points (Earnings Log)
CREATE TABLE IF NOT EXISTS user_earned_reward_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
  module_type VARCHAR(50),
  point_earned_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Redeem Coin History (Redemptions Log)
CREATE TABLE IF NOT EXISTS redeem_coin_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
  module_type VARCHAR(50),
  point_redem_date TIMESTAMP DEFAULT NOW(),
  redeem_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Points Transaction (Consolidated Audit Log)
CREATE TABLE IF NOT EXISTS points_transaction (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earned', 'redeemed')),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES reward_management(id) ON DELETE CASCADE,
  points_amount INTEGER NOT NULL DEFAULT 0,
  module_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Badges Table
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  max_points INTEGER NOT NULL,
  badge_image TEXT,
  color VARCHAR(50),
  color_value VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_earned_user_id ON user_earned_reward_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_earned_rule_id ON user_earned_reward_points(rule_id);
CREATE INDEX IF NOT EXISTS idx_redeem_user_id ON redeem_coin_history(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_user_id ON points_transaction(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_type ON points_transaction(type);
CREATE INDEX IF NOT EXISTS idx_badges_max_points ON badges(max_points);
