require("dotenv").config();
const { pool } = require("../src/config/database");

async function migrate() {
  try {
    await pool.query("ALTER TABLE user_streaks ADD COLUMN IF NOT EXISTS activity_type VARCHAR(50) DEFAULT 'general';");
    console.log("✅ activity_type column added to user_streaks");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}
migrate();
