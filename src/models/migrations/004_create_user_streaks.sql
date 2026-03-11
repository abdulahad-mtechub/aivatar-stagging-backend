-- Daily User Streaks Table
CREATE TABLE IF NOT EXISTS user_streaks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  steak_added_date TIMESTAMP DEFAULT NOW(),
  is_streak INTEGER DEFAULT 1, -- 1 for active, 0 for expired
  is_restored BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_is_streak ON user_streaks(is_streak);
CREATE INDEX IF NOT EXISTS idx_user_streaks_added_date ON user_streaks(steak_added_date);
