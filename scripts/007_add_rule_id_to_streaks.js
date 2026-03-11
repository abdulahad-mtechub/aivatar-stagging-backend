require("dotenv").config();
const { pool } = require("../src/config/database");

async function migrate() {
  try {
    const query = `
      ALTER TABLE user_streaks 
      ADD COLUMN IF NOT EXISTS rule_id INTEGER REFERENCES reward_management(id) ON DELETE SET NULL;
    `;
    await pool.query(query);
    console.log("✅ rule_id column added to user_streaks table.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}
migrate();
