-- 031_mini_goals.sql

CREATE TABLE IF NOT EXISTS mini_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES reward_management(id) ON DELETE SET NULL, 
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'skipped', 'snoozed')),
  type VARCHAR(50) DEFAULT 'custom',
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mini_goals_user_id ON mini_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_mini_goals_rule_id ON mini_goals(rule_id);
CREATE INDEX IF NOT EXISTS idx_mini_goals_status ON mini_goals(status);

-- Add updated_at trigger logic (assuming it exists or just update manually)
-- Standard trigger for updated_at in many setups:
-- CREATE TRIGGER set_timestamp BEFORE UPDATE ON mini_goals FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
