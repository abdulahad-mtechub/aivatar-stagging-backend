const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "reusable_backend_db",
});

const sql = `
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
`;

async function fix() {
  try {
    console.log("Checking database connection...");
    await pool.query('SELECT NOW()');
    console.log("Connected. Creating mini_goals table...");
    await pool.query(sql);
    console.log("✅ mini_goals table created successfully!");
  } catch (err) {
    console.error("❌ Error fixing database:", err);
  } finally {
    await pool.end();
  }
}

fix();
