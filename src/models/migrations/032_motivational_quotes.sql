-- 032_motivational_quotes.sql

CREATE TABLE IF NOT EXISTS motivational_quotes (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  author VARCHAR(255),
  frequency VARCHAR(20) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'one-off')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
  scheduled_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motivational_quotes_frequency ON motivational_quotes(frequency);
CREATE INDEX IF NOT EXISTS idx_motivational_quotes_is_active ON motivational_quotes(is_active);
CREATE INDEX IF NOT EXISTS idx_motivational_quotes_scheduled_at ON motivational_quotes(scheduled_at);
