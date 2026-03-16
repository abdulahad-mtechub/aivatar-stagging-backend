require("dotenv").config();
const { pool } = require("../src/config/database");

async function migrate() {
  try {
    console.log("Applying database migrations for Reports...");
    
    // 1. Update profiles table
    await pool.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS target_calories INTEGER DEFAULT 2000,
      ADD COLUMN IF NOT EXISTS target_protein FLOAT DEFAULT 150.0,
      ADD COLUMN IF NOT EXISTS target_carbs FLOAT DEFAULT 200.0,
      ADD COLUMN IF NOT EXISTS target_fats FLOAT DEFAULT 70.0,
      ADD COLUMN IF NOT EXISTS target_weight FLOAT;
    `);

    // 2. Create user_measurements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_measurements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        weight FLOAT,
        waist FLOAT,
        chest FLOAT,
        hips FLOAT,
        arm FLOAT,
        recorded_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT uq_user_measurement_date UNIQUE (user_id, recorded_date)
      );
      CREATE INDEX IF NOT EXISTS idx_user_measurements_user_id ON user_measurements(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_measurements_recorded_date ON user_measurements(recorded_date);
    `);

    console.log("✅ Migration completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
