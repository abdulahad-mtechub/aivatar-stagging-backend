require("dotenv").config();
const { pool } = require("../src/config/database");

async function migrate() {
  try {
    console.log("Adding columns to meals table...");
    await pool.query(`
      ALTER TABLE meals 
      ADD COLUMN IF NOT EXISTS quantity VARCHAR(100),
      ADD COLUMN IF NOT EXISTS is_in_grocery BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_bought BOOLEAN DEFAULT false;
    `);
    console.log("✅ Migration completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
